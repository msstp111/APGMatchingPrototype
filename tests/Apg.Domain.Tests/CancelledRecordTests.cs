using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Domain.Tests;

/// <summary>
/// A match stops consuming the <b>other</b> record's quantity once its own record is cancelled.
/// </summary>
/// <remarks>
/// <para>
/// This is not a cascade and must not be confused with one. The match keeps its status, keeps its
/// quantity, stays on both cards and still has to be cancelled by hand — nothing about it changes.
/// What changes is what the record on the <em>other</em> end is entitled to say about its own stock: a
/// farmer whose 143 head were matched to a space that has since been cancelled has 143 head to sell
/// again, and a screen that goes on counting them is hiding supply.
/// </para>
/// <para>
/// The rule is <b>asymmetric</b>, which is the half a future change is most likely to get backwards.
/// It is always the counterparty's status that decides, never the record's own.
/// </para>
/// </remarks>
public class CancelledRecordTests
{
    private static readonly ProcessorSpace LiveSpace = Given.Space(quantityRequired: 100, id: 1);

    private static readonly ProcessorSpace DeadSpace =
        Given.Space(quantityRequired: 100, id: 2, status: ProcessorSpaceStatus.Cancelled);

    private static readonly LivestockAvailability Record = Given.Availability(quantityAvailable: 100);

    private static readonly List<Match> Matches =
    [
        Given.Match(30, MatchStatus.Confirmed, id: 1, spaceId: 1, availabilityId: 1),
        Given.Match(50, MatchStatus.Confirmed, id: 2, spaceId: 2, availabilityId: 1),
    ];

    private static CancelledRecords Cancelled() =>
        CancelledRecords.In([LiveSpace, DeadSpace], [Record]);

    [Fact]
    public void A_match_to_a_cancelled_space_stops_consuming_the_records_supply()
    {
        var before = MatchQuantities.ForAvailability(Record, Matches, CancelledRecords.None);
        var after = MatchQuantities.ForAvailability(Record, Matches, Cancelled());

        // 30 + 50 while nothing is cancelled; the 50 to the cancelled space then stops counting.
        Assert.Equal(80, before.MatchedInclDraft);
        Assert.Equal(20, before.Unmatched);

        Assert.Equal(30, after.MatchedInclDraft);
        Assert.Equal(30, after.MatchedExclDraft);
        Assert.Equal(70, after.Unmatched);
    }

    /// <summary>The other half of the same rule, and the one it is easiest to implement backwards.</summary>
    [Fact]
    public void A_cancelled_records_own_figures_are_untouched_by_its_own_cancellation()
    {
        var tally = MatchQuantities.ForSpace(DeadSpace, Matches, Cancelled());

        // The space is cancelled; its match is to a live record, so it still fills this space. Its own
        // card stays readable while somebody deals with the match it left behind.
        Assert.Equal(50, tally.MatchedInclDraft);
        Assert.Equal(50, tally.Unmatched);
    }

    [Fact]
    public void A_cancelled_match_and_a_match_to_a_cancelled_record_are_both_ignored()
    {
        List<Match> matches =
        [
            Given.Match(30, MatchStatus.Confirmed, id: 1, spaceId: 1, availabilityId: 1),
            Given.Match(50, MatchStatus.Confirmed, id: 2, spaceId: 2, availabilityId: 1),
            Given.Match(10, MatchStatus.Cancelled, id: 3, spaceId: 1, availabilityId: 1),
        ];

        Assert.Equal(30, MatchQuantities.ForAvailability(Record, matches, Cancelled()).MatchedInclDraft);
    }

    /// <summary>
    /// The record derives Booked, not Pending: nothing is holding its stock. The card still says
    /// otherwise — that is the red badge's job, and it reads the match, not the status.
    /// </summary>
    [Fact]
    public void A_record_whose_only_match_is_to_a_cancelled_space_is_Booked_again()
    {
        List<Match> onlyOrphan =
            [Given.Match(50, MatchStatus.Confirmed, id: 2, spaceId: 2, availabilityId: 1)];

        Assert.Equal(
            LivestockAvailabilityStatus.Pending,
            AvailabilityStatus.Derive(Record, onlyOrphan, CancelledRecords.None));

        Assert.Equal(
            LivestockAvailabilityStatus.Booked,
            AvailabilityStatus.Derive(Record, onlyOrphan, Cancelled()));
    }

    /// <summary>
    /// A space filled only by matches to cancelled records is not filled at all, so confirming it is
    /// refused — the same answer its own meter now gives.
    /// </summary>
    [Fact]
    public void A_space_cannot_be_confirmed_on_matches_to_cancelled_records()
    {
        var space = Given.Space(quantityRequired: 40, id: 3);
        var cancelledRecord =
            Given.Availability(quantityAvailable: 40, id: 9, status: LivestockAvailabilityStatus.Cancelled);

        List<Match> matches =
            [Given.Match(40, MatchStatus.Confirmed, id: 5, spaceId: 3, availabilityId: 9)];

        var cancelled = CancelledRecords.In([space], [cancelledRecord]);

        Assert.True(ProcessorSpaceRules.CanConfirm(space, matches, CancelledRecords.None));
        Assert.False(ProcessorSpaceRules.CanConfirm(space, matches, cancelled));
        Assert.Equal(
            ProcessorSpaceRules.NeedsConfirmedMatches,
            ProcessorSpaceRules.ConfirmBlockedReason(space, matches, cancelled));
    }

    /// <summary>
    /// The edit ceiling has to move with the same rule, or editing an orphaned match would hand out
    /// supply it never took: nothing was subtracted for it, so nothing may be added back.
    /// </summary>
    [Fact]
    public void The_edit_ceiling_adds_back_only_what_a_match_actually_consumed()
    {
        var orphan = Matches[1];
        var live = Matches[0];

        // The orphan consumed nothing, so the ceiling is simply what is left: 100 - 30.
        Assert.Equal(70, MatchCreation.MaxMatchQuantity(Record, Matches, orphan, Cancelled()));

        // The live match consumed 30, so its own quantity comes back on top of the remaining 70.
        Assert.Equal(100, MatchCreation.MaxMatchQuantity(Record, Matches, live, Cancelled()));
    }

    [Fact]
    public void A_freed_pair_can_be_matched_again()
    {
        var proposal = MatchCreation.Propose(LiveSpace, Matches, Record, Matches, Cancelled());

        // The space still needs 70 and the record has 70 free again, so the drag is allowed for 70.
        Assert.True(proposal.IsAllowed);
        Assert.Equal(70, proposal.Quantity);
        Assert.Equal(70, proposal.Maximum);
    }
}
