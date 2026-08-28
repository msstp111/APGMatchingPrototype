using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Domain.Tests;

/// <summary>
/// What a drag is allowed to produce: the default quantity, the asymmetric caps, and the one refusal.
/// </summary>
public class MatchCreationTests
{
    [Fact]
    public void The_default_quantity_is_the_smaller_of_the_two_unmatched_figures()
    {
        var space = Given.Space(quantityRequired: 100);
        var availability = Given.Availability(quantityAvailable: 60);

        var proposal = MatchCreation.Propose(space, [], availability, []);

        Assert.True(proposal.IsAllowed);
        Assert.Equal(60, proposal.Quantity);
        Assert.Null(proposal.RefusalMessage);
    }

    [Fact]
    public void The_default_accounts_for_matches_already_on_both_records()
    {
        var space = Given.Space(quantityRequired: 100, id: 1);
        var availability = Given.Availability(quantityAvailable: 90, id: 1);

        var matches = new List<Match>
        {
            Given.Match(30, MatchStatus.Drafted, id: 1, spaceId: 1, availabilityId: 2),
            Given.Match(20, MatchStatus.Confirmed, id: 2, spaceId: 2, availabilityId: 1),
        };

        // Space has 70 left, availability has 70 left.
        var proposal = MatchCreation.Propose(space, matches, availability, matches);

        Assert.Equal(70, proposal.Quantity);
    }

    /// <summary>
    /// Resolved question 1: the supply side is hard-capped, the demand side is not. A meatworks can
    /// be sent more animals than it asked for; a farmer cannot supply animals they do not have.
    /// </summary>
    [Fact]
    public void The_ceiling_comes_from_the_supply_side_only()
    {
        var space = Given.Space(quantityRequired: 20);
        var availability = Given.Availability(quantityAvailable: 500);

        var proposal = MatchCreation.Propose(space, [], availability, []);

        Assert.Equal(20, proposal.Quantity);
        Assert.Equal(500, proposal.Maximum);
    }

    [Fact]
    public void A_record_with_nothing_left_is_refused_with_the_exact_message()
    {
        var space = Given.Space(quantityRequired: 100, id: 1);
        var availability = Given.Availability(quantityAvailable: 40, id: 1);
        var matches = Given.Matches((40, MatchStatus.Confirmed));

        var proposal = MatchCreation.Propose(space, [], availability, matches);

        Assert.False(proposal.IsAllowed);
        Assert.Equal("There is no unmatched quantity", proposal.RefusalMessage);
        Assert.Equal(0, proposal.Quantity);
    }

    [Fact]
    public void An_already_over_filled_space_is_refused_with_the_same_message()
    {
        // The default would be negative rather than zero, and a negative default must refuse just as
        // an exhausted one does.
        var space = Given.Space(quantityRequired: 50, id: 1);
        var availability = Given.Availability(quantityAvailable: 100, id: 1);
        var spaceMatches = Given.Matches((80, MatchStatus.Confirmed));

        var proposal = MatchCreation.Propose(space, spaceMatches, availability, []);

        Assert.False(proposal.IsAllowed);
        Assert.Equal(MatchCreation.NoUnmatchedQuantity, proposal.RefusalMessage);
    }

    [Fact]
    public void The_refusal_message_is_exactly_the_wording_the_spec_quotes()
    {
        Assert.Equal("There is no unmatched quantity", MatchCreation.NoUnmatchedQuantity);
    }

    /// <summary>
    /// Resolved question 13. The match being edited is already subtracted out of the record's
    /// unmatched figure, so without adding it back the operator could not even keep the quantity they
    /// already have.
    /// </summary>
    [Fact]
    public void Editing_a_match_adds_its_own_quantity_back_to_the_ceiling()
    {
        var availability = Given.Availability(quantityAvailable: 100, id: 1);
        var existing = Given.Match(40, MatchStatus.Drafted, id: 1, availabilityId: 1);
        var matches = new List<Match>
        {
            existing,
            Given.Match(25, MatchStatus.Confirmed, id: 2, availabilityId: 1),
        };

        // 100 available, 65 matched, so 35 unmatched — plus this match's own 40.
        Assert.Equal(35, MatchQuantities.ForAvailability(availability, matches).Unmatched);
        Assert.Equal(75, MatchCreation.MaxMatchQuantity(availability, matches, existing));
    }

    /// <summary>
    /// The spec's own wording for this ceiling — the availability record's <em>original</em>
    /// quantity — would permit the over-commit resolved question 1 forbids. This asserts the
    /// difference.
    /// </summary>
    [Fact]
    public void The_edit_ceiling_is_remaining_supply_plus_the_match_not_the_original_quantity()
    {
        var availability = Given.Availability(quantityAvailable: 100, id: 1);
        var existing = Given.Match(40, MatchStatus.Drafted, id: 1, availabilityId: 1);
        var matches = new List<Match>
        {
            existing,
            Given.Match(25, MatchStatus.Confirmed, id: 2, availabilityId: 1),
        };

        var ceiling = MatchCreation.MaxMatchQuantity(availability, matches, existing);

        Assert.NotEqual(availability.QuantityAvailable, ceiling);
        Assert.True(ceiling < availability.QuantityAvailable);
    }

    [Fact]
    public void A_cancelled_match_has_nothing_to_add_back()
    {
        // A cancelled match consumed no supply, so adding its quantity back would hand out the same
        // animals twice.
        var availability = Given.Availability(quantityAvailable: 100, id: 1);
        var cancelled = Given.Match(40, MatchStatus.Cancelled, id: 1, availabilityId: 1);
        var matches = new List<Match>
        {
            cancelled,
            Given.Match(25, MatchStatus.Confirmed, id: 2, availabilityId: 1),
        };

        Assert.Equal(75, MatchCreation.MaxMatchQuantity(availability, matches, cancelled));
    }

    /// <summary>
    /// Resolved question 8: every drag creates a new match. Nothing here dedupes, merges or tops up
    /// an existing pairing.
    /// </summary>
    [Fact]
    public void A_pair_that_already_matches_is_still_offered_a_new_match()
    {
        var space = Given.Space(quantityRequired: 100, id: 1);
        var availability = Given.Availability(quantityAvailable: 100, id: 1);
        var existing = Given.Matches((30, MatchStatus.Confirmed));

        var proposal = MatchCreation.Propose(space, existing, availability, existing);

        Assert.True(proposal.IsAllowed);
        Assert.Equal(70, proposal.Quantity);
    }

    [Theory]
    [InlineData(10, 10, 10)]
    [InlineData(10, 3, 3)]
    [InlineData(3, 10, 3)]
    [InlineData(-5, 10, -5)]
    public void DefaultMatchQuantity_is_the_minimum_of_the_two(int space, int availability, int expected)
    {
        Assert.Equal(expected, MatchCreation.DefaultMatchQuantity(space, availability));
    }
}
