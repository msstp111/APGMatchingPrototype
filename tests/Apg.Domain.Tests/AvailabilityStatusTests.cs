using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Domain.Tests;

/// <summary>
/// Every branch of the derived availability status, and the two near-misses either side of
/// Confirmed — which is where this rule goes wrong if it is going to.
/// </summary>
public class AvailabilityStatusTests
{
    [Fact]
    public void A_record_with_no_matches_is_Booked()
    {
        var availability = Given.Availability(quantityAvailable: 100);

        Assert.Equal(LivestockAvailabilityStatus.Booked, AvailabilityStatus.Derive(availability, [], CancelledRecords.None));
    }

    [Fact]
    public void A_record_whose_only_matches_were_cancelled_is_Booked_again()
    {
        // Cancelled matches do not count, so the record is simply back on offer.
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = Given.Matches((40, MatchStatus.Cancelled), (60, MatchStatus.Cancelled));

        Assert.Equal(LivestockAvailabilityStatus.Booked, AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));
    }

    [Fact]
    public void A_partly_matched_record_is_Pending()
    {
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = Given.Matches((40, MatchStatus.Confirmed));

        Assert.Equal(LivestockAvailabilityStatus.Pending, AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));
    }

    [Fact]
    public void A_fully_matched_record_with_every_match_confirmed_is_Confirmed()
    {
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = Given.Matches((60, MatchStatus.Confirmed), (40, MatchStatus.Confirmed));

        Assert.Equal(LivestockAvailabilityStatus.Confirmed, AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));
    }

    [Fact]
    public void Cancelled_matches_alongside_confirmed_ones_do_not_block_Confirmed()
    {
        // "Every match Confirmed or Cancelled" — a cancelled match is settled, not outstanding.
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = Given.Matches(
            (60, MatchStatus.Confirmed),
            (40, MatchStatus.Confirmed),
            (25, MatchStatus.Cancelled));

        Assert.Equal(LivestockAvailabilityStatus.Confirmed, AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));
    }

    /// <summary>
    /// The near-miss. Unmatched is zero, so the fill meter is green and the card looks settled — but
    /// one match is still a draft, and a draft is not an agreement. Pending, not Confirmed.
    /// </summary>
    [Fact]
    public void A_fully_matched_record_with_a_draft_outstanding_is_Pending_not_Confirmed()
    {
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = Given.Matches((60, MatchStatus.Confirmed), (40, MatchStatus.Drafted));

        Assert.Equal(0, MatchQuantities.ForAvailability(availability, matches, CancelledRecords.None).Unmatched);
        Assert.Equal(LivestockAvailabilityStatus.Pending, AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));
    }

    [Fact]
    public void A_notified_match_also_blocks_Confirmed()
    {
        // Notified is unreachable in pass 1, but it is live and not yet agreed, so it must behave
        // like a draft here rather than like a confirmation.
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = Given.Matches((60, MatchStatus.Confirmed), (40, MatchStatus.Notified));

        Assert.Equal(LivestockAvailabilityStatus.Pending, AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));
    }

    /// <summary>
    /// Resolved question 5: <c>== 0</c> exactly, never <c>&lt;= 0</c>. An over-committed record is a
    /// bug, and a bug must not read as the calmest status on the screen.
    /// </summary>
    [Fact]
    public void An_over_committed_record_is_Pending_because_the_test_is_exactly_zero_not_zero_or_less()
    {
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = Given.Matches((60, MatchStatus.Confirmed), (60, MatchStatus.Confirmed));

        Assert.Equal(-20, MatchQuantities.ForAvailability(availability, matches, CancelledRecords.None).Unmatched);
        Assert.Equal(LivestockAvailabilityStatus.Pending, AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));
    }

    [Fact]
    public void An_explicitly_cancelled_record_stays_Cancelled_however_its_matches_stand()
    {
        // Cancelling a record does not cascade, so a cancelled record can still carry live matches
        // while APG arranges an alternative. It must still read as Cancelled.
        var availability = Given.Availability(
            quantityAvailable: 100,
            status: LivestockAvailabilityStatus.Cancelled);
        var matches = Given.Matches((60, MatchStatus.Confirmed), (40, MatchStatus.Confirmed));

        Assert.Equal(LivestockAvailabilityStatus.Cancelled, AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));
    }

    [Fact]
    public void The_stored_status_is_otherwise_ignored_in_favour_of_the_derivation()
    {
        // A record stored as Booked but fully matched and confirmed derives as Confirmed. Only
        // Cancelled is meaningful as stored state.
        var availability = Given.Availability(
            quantityAvailable: 100,
            status: LivestockAvailabilityStatus.Booked);
        var matches = Given.Matches((100, MatchStatus.Confirmed));

        Assert.Equal(LivestockAvailabilityStatus.Confirmed, AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));
    }

    [Fact]
    public void Matches_belonging_to_other_records_do_not_affect_the_derivation()
    {
        var availability = Given.Availability(quantityAvailable: 100, id: 1);

        var allMatches = new List<Match>
        {
            Given.Match(100, MatchStatus.Confirmed, id: 1, availabilityId: 1),
            Given.Match(80, MatchStatus.Drafted, id: 2, availabilityId: 2),
        };

        Assert.Equal(LivestockAvailabilityStatus.Confirmed, AvailabilityStatus.Derive(availability, allMatches, CancelledRecords.None));
    }
}
