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
    /// Notifying is Drafted-only. Past Drafted the processor has already been told, and a second
    /// notify would be a reminder — which needs a medium to travel on, and there is none.
    /// </summary>
    [Theory]
    [InlineData(MatchStatus.Drafted, true)]
    [InlineData(MatchStatus.Notified, false)]
    [InlineData(MatchStatus.Confirmed, false)]
    [InlineData(MatchStatus.Cancelled, false)]
    public void Only_a_drafted_match_can_be_notified(MatchStatus status, bool expected) =>
        Assert.Equal(
            expected,
            MatchLifecycle.CanNotify(Given.Match(60, status), Given.Space(quantityRequired: 100)));

    /// <summary>
    /// And only ANZCO's (Mark, 2026-09-11). Notification is not part of Alliance Group's or SFF's
    /// process at all, so <b>no</b> match of theirs is notifiable at any status — which is why the
    /// client hides the button rather than disabling it.
    /// </summary>
    [Theory]
    [InlineData("ANZCO", true)]
    [InlineData("Alliance Group", false)]
    [InlineData("SFF", false)]
    [InlineData("Some Processor We Have Never Heard Of", false)]
    public void Only_a_processor_that_receives_notifications_can_be_notified(
        string processor,
        bool expected)
    {
        var space = Given.Space(quantityRequired: 100, processor: processor);

        Assert.Equal(expected, MatchLifecycle.CanNotify(Given.Match(60, MatchStatus.Drafted), space));
    }

    /// <summary>
    /// When both clauses fail, the processor's is the one reported. "Only a drafted match can be
    /// notified" would send the operator looking for a draft to notify, when no SFF match at any
    /// status ever can be.
    /// </summary>
    [Fact]
    public void The_processor_clause_is_the_one_explained_when_both_fail()
    {
        var space = Given.Space(quantityRequired: 100, processor: "SFF");
        var confirmed = Given.Match(60, MatchStatus.Confirmed);

        var reason = MatchLifecycle.NotifyBlockedReason(confirmed, space);

        Assert.Equal("SFF does not receive match notifications", reason);
        Assert.DoesNotContain("drafted", reason, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Both live statuses are entries into Confirmed (2026-09-11, amending resolved question 2).
    /// Notified is <em>not</em> inheriting Drafted's transition by accident — it is named, because
    /// notifying is a step APG may take and a match that skipped it must still be confirmable, and
    /// because a Notified match that could only be cancelled would be a dead end on the board.
    /// </summary>
    [Theory]
    [InlineData(MatchStatus.Drafted, true)]
    [InlineData(MatchStatus.Notified, true)]
    [InlineData(MatchStatus.Confirmed, false)]
    [InlineData(MatchStatus.Cancelled, false)]
    public void A_live_unconfirmed_match_can_be_confirmed(MatchStatus status, bool expected) =>
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

    /// <summary>
    /// The whole of what notifying does. It is worth a test of its own precisely because the method
    /// is one line: the temptation with a status called Notified is to have it also stamp a sent-at,
    /// queue a message or touch the parents, and every one of those would be a claim this prototype
    /// cannot back. The status moves; nothing else in the object graph does.
    /// </summary>
    [Fact]
    public void Notifying_moves_a_draft_to_notified_and_does_nothing_else()
    {
        var space = Given.Space(quantityRequired: 100);
        var availability = Given.Availability(quantityAvailable: 100);
        var matches = Given.Matches((60, MatchStatus.Drafted), (40, MatchStatus.Drafted));

        MatchLifecycle.Notify(matches[0]);

        Assert.Equal(MatchStatus.Notified, matches[0].Status);
        Assert.Equal(60, matches[0].QuantityMatched);
        Assert.Null(matches[0].CancellationReason);
        Assert.Equal(MatchStatus.Drafted, matches[1].Status);
        Assert.Equal(ProcessorSpaceStatus.Booked, space.Status);
        Assert.Equal(LivestockAvailabilityStatus.Booked, availability.Status);
    }

    /// <summary>
    /// The lifecycle end to end, in the order the modal offers it. Drafted → Notified → Confirmed is
    /// the spec's own sequence, and it was unreachable in code until 2026-09-11.
    /// </summary>
    [Fact]
    public void A_match_can_be_notified_and_then_confirmed()
    {
        var match = Given.Match(60, MatchStatus.Drafted);

        MatchLifecycle.Notify(match);
        Assert.True(MatchLifecycle.CanConfirm(match));

        MatchLifecycle.Confirm(match);
        Assert.Equal(MatchStatus.Confirmed, match.Status);
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
            AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));

        MatchLifecycle.Confirm(matches[1]);

        Assert.Equal(
            LivestockAvailabilityStatus.Confirmed,
            AvailabilityStatus.Derive(availability, matches, CancelledRecords.None));
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
            .Order()
            .ToList();

        // Sorted, because reflection does not promise an order and the list is two names long now.
        Assert.Equal(
            [nameof(MatchLifecycle.Confirm), nameof(MatchLifecycle.Notify)],
            mutators);
    }
}
