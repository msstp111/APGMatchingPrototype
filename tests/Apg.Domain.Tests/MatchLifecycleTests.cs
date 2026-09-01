using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Domain.Tests;

/// <summary>
/// What may be done to a match at each status. The three acts are mutually exclusive, and the whole
/// point of the file is that they stay so — a drafted match deleted and a confirmed one cancelled
/// leave different records behind, and blurring the two loses a cancellation reason APG has to be able
/// to account for.
/// </summary>
public class MatchLifecycleTests
{
    [Theory]
    [InlineData(MatchStatus.Drafted, true)]
    [InlineData(MatchStatus.Notified, false)]
    [InlineData(MatchStatus.Confirmed, false)]
    [InlineData(MatchStatus.Cancelled, false)]
    public void Only_a_drafted_match_can_be_deleted(MatchStatus status, bool expected) =>
        Assert.Equal(expected, MatchLifecycle.CanDelete(Given.Match(60, status)));

    /// <summary>
    /// Confirming is Drafted-only. Notified is not a second entry into Confirmed: it has no UI
    /// transition in pass 1 (resolved question 2), and were notifications to arrive it would want its
    /// own explicit step rather than inheriting this one by accident.
    /// </summary>
    [Theory]
    [InlineData(MatchStatus.Drafted, true)]
    [InlineData(MatchStatus.Notified, false)]
    [InlineData(MatchStatus.Confirmed, false)]
    [InlineData(MatchStatus.Cancelled, false)]
    public void Only_a_drafted_match_can_be_confirmed(MatchStatus status, bool expected) =>
        Assert.Equal(expected, MatchLifecycle.CanConfirm(Given.Match(60, status)));

    /// <summary>
    /// Cancel is for matches <b>past</b> Drafted (Phase 6, 4.2). A draft is deleted instead, and an
    /// already-cancelled match is finished.
    /// </summary>
    [Theory]
    [InlineData(MatchStatus.Drafted, false)]
    [InlineData(MatchStatus.Notified, true)]
    [InlineData(MatchStatus.Confirmed, true)]
    [InlineData(MatchStatus.Cancelled, false)]
    public void Cancel_is_for_matches_past_drafted(MatchStatus status, bool expected) =>
        Assert.Equal(expected, MatchLifecycle.CanCancel(Given.Match(60, status)));

    /// <summary>
    /// The two remedies never overlap: at every status, at most one of delete and cancel is offered.
    /// A match that could be both would let the same mistake be undone two ways with two different
    /// records left behind.
    /// </summary>
    [Theory]
    [InlineData(MatchStatus.Drafted)]
    [InlineData(MatchStatus.Notified)]
    [InlineData(MatchStatus.Confirmed)]
    [InlineData(MatchStatus.Cancelled)]
    public void Delete_and_cancel_are_never_both_available(MatchStatus status)
    {
        var match = Given.Match(60, status);

        Assert.False(MatchLifecycle.CanDelete(match) && MatchLifecycle.CanCancel(match));
    }

    [Fact]
    public void Confirming_moves_a_draft_to_confirmed_and_records_no_reason()
    {
        var match = Given.Match(60, MatchStatus.Drafted);

        MatchLifecycle.Confirm(match);

        Assert.Equal(MatchStatus.Confirmed, match.Status);
        Assert.Null(match.CancellationReason);
    }

    /// <summary>
    /// Confirming touches the match and nothing else. Its quantity is not rounded, its price is not
    /// cleared, and — the one that matters — its siblings and its parents are not given anything to
    /// react to.
    /// </summary>
    [Fact]
    public void Confirming_one_match_changes_only_that_match()
    {
        var space = Given.Space(quantityRequired: 100);
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = Given.Matches((60, MatchStatus.Drafted), (40, MatchStatus.Drafted));

        MatchLifecycle.Confirm(matches[0]);

        Assert.Equal(60, matches[0].QuantityMatched);
        Assert.Equal(MatchStatus.Drafted, matches[1].Status);
        Assert.Equal(ProcessorSpaceStatus.Booked, space.Status);
        Assert.Equal(LivestockAvailabilityStatus.Booked, availability.Status);
    }

    /// <summary>
    /// Confirming the last outstanding match on a fully matched availability record is what flips that
    /// record to Confirmed (Phase 6, 4.4) — and it does so through the <em>derivation</em>, not by
    /// anyone writing a status. The availability side derives; the space side does not.
    /// </summary>
    [Fact]
    public void Confirming_the_last_match_of_a_fully_matched_record_derives_it_Confirmed()
    {
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = Given.Matches((60, MatchStatus.Confirmed), (40, MatchStatus.Drafted));

        Assert.Equal(
            LivestockAvailabilityStatus.Pending,
            AvailabilityStatus.Derive(availability, matches));

        MatchLifecycle.Confirm(matches[1]);

        Assert.Equal(
            LivestockAvailabilityStatus.Confirmed,
            AvailabilityStatus.Derive(availability, matches));
    }

    /// <summary>
    /// Cancelling stays in <c>RecordCancellation</c>, which is the only path that sets Cancelled. This
    /// class answers whether; that one does it. If a Confirm-style mutator ever appears here for
    /// cancellation there will be two ways to cancel a match, and only one of them will demand a reason.
    /// </summary>
    [Fact]
    public void Nothing_here_cancels_a_match()
    {
        var mutators = typeof(MatchLifecycle)
            .GetMethods()
            .Where(m => m.ReturnType == typeof(void))
            .Select(m => m.Name)
            .ToList();

        Assert.Equal([nameof(MatchLifecycle.Confirm)], mutators);
    }
}
