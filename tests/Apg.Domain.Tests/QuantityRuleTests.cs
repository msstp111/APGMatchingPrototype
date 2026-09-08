using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Domain.Tests;

/// <summary>
/// The two matched sums, the unmatched figure and the fill state. Everything the matching screen
/// shows is downstream of these, and none of them fails loudly when it is wrong.
/// </summary>
public class QuantityRuleTests
{
    [Fact]
    public void A_record_with_no_matches_has_matched_nothing()
    {
        var space = Given.Space(quantityRequired: 100);

        var tally = MatchQuantities.ForSpace(space, [], CancelledRecords.None);

        Assert.Equal(0, tally.MatchedInclDraft);
        Assert.Equal(0, tally.MatchedExclDraft);
        Assert.Equal(100, tally.Unmatched);
        Assert.Equal(QuantityState.Under, tally.State);
    }

    [Fact]
    public void Cancelled_matches_consume_no_quantity_on_either_sum()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches((40, MatchStatus.Cancelled), (25, MatchStatus.Cancelled));

        var tally = MatchQuantities.ForSpace(space, matches, CancelledRecords.None);

        Assert.Equal(0, tally.MatchedInclDraft);
        Assert.Equal(0, tally.MatchedExclDraft);
        Assert.Equal(100, tally.Unmatched);
    }

    /// <summary>
    /// The boundary the whole class exists for. One Drafted match and one Confirmed match must give
    /// two <em>different</em> sums; if they ever agree, one of the two rules has been copied from the
    /// other and the "Quantity Matched" a processor sees is quietly overstated by every open draft.
    /// </summary>
    [Fact]
    public void The_Drafted_boundary_separates_the_two_sums()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches((30, MatchStatus.Drafted), (45, MatchStatus.Confirmed));

        var tally = MatchQuantities.ForSpace(space, matches, CancelledRecords.None);

        Assert.Equal(75, tally.MatchedInclDraft);
        Assert.Equal(45, tally.MatchedExclDraft);
        Assert.NotEqual(tally.MatchedInclDraft, tally.MatchedExclDraft);
    }

    /// <summary>
    /// <see cref="QuantityTally.Drafted"/> is the gap between the two sums, and it exists so the
    /// expanded card can state how much of a record's commitment is still provisional instead of
    /// leaving the operator to add up the match table. Asserted against both sums rather than against
    /// a literal, because the value only means anything as their difference.
    /// </summary>
    [Fact]
    public void Drafted_is_the_gap_between_the_two_sums()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches(
            (30, MatchStatus.Drafted),
            (12, MatchStatus.Drafted),
            (45, MatchStatus.Confirmed),
            (9, MatchStatus.Cancelled));

        var tally = MatchQuantities.ForSpace(space, matches, CancelledRecords.None);

        Assert.Equal(42, tally.Drafted);
        Assert.Equal(tally.MatchedInclDraft - tally.MatchedExclDraft, tally.Drafted);
    }

    /// <summary>
    /// And it is zero — not the confirmed sum, and not the required quantity — when nothing is
    /// drafted. That is the case the expanded card prints beside a space that is ready to confirm.
    /// </summary>
    [Fact]
    public void Drafted_is_zero_when_no_match_is_drafted()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches((45, MatchStatus.Confirmed), (9, MatchStatus.Cancelled));

        Assert.Equal(0, MatchQuantities.ForSpace(space, matches, CancelledRecords.None).Drafted);
    }

    [Fact]
    public void Unmatched_is_taken_from_the_incl_Draft_sum_not_the_excl_Draft_one()
    {
        // A draft has already spoken for the stock as far as the operator is concerned, so it must
        // reduce what the matching screen offers. Taking unmatched off the excl-Draft sum instead
        // would offer the same animals to a second space.
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches((30, MatchStatus.Drafted), (45, MatchStatus.Confirmed));

        Assert.Equal(25, MatchQuantities.ForSpace(space, matches, CancelledRecords.None).Unmatched);
    }

    [Fact]
    public void A_mix_of_every_status_counts_each_one_correctly()
    {
        var space = Given.Space(quantityRequired: 200);
        var matches = Given.Matches(
            (10, MatchStatus.Drafted),
            (20, MatchStatus.Notified),
            (30, MatchStatus.Confirmed),
            (40, MatchStatus.Cancelled));

        var tally = MatchQuantities.ForSpace(space, matches, CancelledRecords.None);

        // Notified is live and not a draft, so it counts towards both sums.
        Assert.Equal(60, tally.MatchedInclDraft);
        Assert.Equal(50, tally.MatchedExclDraft);
        Assert.Equal(140, tally.Unmatched);
    }

    [Fact]
    public void A_space_filled_to_exactly_its_requirement_is_Exact()
    {
        var space = Given.Space(quantityRequired: 90);
        var matches = Given.Matches((50, MatchStatus.Confirmed), (40, MatchStatus.Drafted));

        var tally = MatchQuantities.ForSpace(space, matches, CancelledRecords.None);

        Assert.Equal(0, tally.Unmatched);
        Assert.Equal(QuantityState.Exact, tally.State);
    }

    [Fact]
    public void An_availability_record_matched_to_exactly_its_supply_is_Exact()
    {
        var availability = Given.Availability(quantityAvailable: 60);
        var matches = Given.Matches((35, MatchStatus.Confirmed), (25, MatchStatus.Confirmed));

        var tally = MatchQuantities.ForAvailability(availability, matches, CancelledRecords.None);

        Assert.Equal(0, tally.Unmatched);
        Assert.Equal(QuantityState.Exact, tally.State);
    }

    /// <summary>
    /// Over-filling the demand side is permitted (resolved question 1), and it is the one place the
    /// unmatched figure legitimately goes negative.
    /// </summary>
    [Fact]
    public void An_over_filled_space_reports_negative_unmatched_and_the_Over_state()
    {
        var space = Given.Space(quantityRequired: 100);
        var matches = Given.Matches((70, MatchStatus.Confirmed), (45, MatchStatus.Drafted));

        var tally = MatchQuantities.ForSpace(space, matches, CancelledRecords.None);

        Assert.Equal(115, tally.MatchedInclDraft);
        Assert.Equal(-15, tally.Unmatched);
        Assert.Equal(QuantityState.Over, tally.State);
    }

    /// <summary>
    /// Over-committing supply should be unreachable, so the arithmetic must not quietly clamp it: the
    /// pink state exists precisely to make the bug visible on the card if it ever happens.
    /// </summary>
    [Fact]
    public void An_over_committed_availability_record_is_reported_honestly_rather_than_clamped()
    {
        var availability = Given.Availability(quantityAvailable: 50);
        var matches = Given.Matches((40, MatchStatus.Confirmed), (30, MatchStatus.Confirmed));

        var tally = MatchQuantities.ForAvailability(availability, matches, CancelledRecords.None);

        Assert.Equal(-20, tally.Unmatched);
        Assert.Equal(QuantityState.Over, tally.State);
        Assert.Equal("Over-committed", QuantityStateLabels.For(tally.State, MatchSide.LivestockAvailability));
    }

    /// <summary>
    /// The record-scoped overloads filter by the record's own id, so being handed the whole match set
    /// is safe. The alternative fails by producing a plausible number belonging to someone else.
    /// </summary>
    [Fact]
    public void The_record_overloads_ignore_matches_belonging_to_other_records()
    {
        var space = Given.Space(quantityRequired: 100, id: 1);
        var availability = Given.Availability(quantityAvailable: 100, id: 1);

        var allMatches = new List<Match>
        {
            Given.Match(30, MatchStatus.Confirmed, id: 1, spaceId: 1, availabilityId: 1),
            Given.Match(500, MatchStatus.Confirmed, id: 2, spaceId: 2, availabilityId: 2),
            Given.Match(20, MatchStatus.Confirmed, id: 3, spaceId: 1, availabilityId: 2),
            Given.Match(40, MatchStatus.Confirmed, id: 4, spaceId: 2, availabilityId: 1),
        };

        Assert.Equal(50, MatchQuantities.ForSpace(space, allMatches, CancelledRecords.None).MatchedInclDraft);
        Assert.Equal(70, MatchQuantities.ForAvailability(availability, allMatches, CancelledRecords.None).MatchedInclDraft);
    }

    [Theory]
    [InlineData(QuantityState.Under, "Under-filled", "Under-committed")]
    [InlineData(QuantityState.Exact, "Filled", "Fully committed")]
    [InlineData(QuantityState.Over, "Over-filled", "Over-committed")]
    public void Each_side_labels_the_same_state_in_its_own_words(
        QuantityState state,
        string spaceLabel,
        string availabilityLabel)
    {
        Assert.Equal(spaceLabel, QuantityStateLabels.For(state, MatchSide.ProcessorSpace));
        Assert.Equal(availabilityLabel, QuantityStateLabels.For(state, MatchSide.LivestockAvailability));
    }
}
