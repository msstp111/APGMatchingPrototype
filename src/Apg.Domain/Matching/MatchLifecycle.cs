using Apg.Domain.Entities;

namespace Apg.Domain.Matching;

/// <summary>
/// What may be done to a match once it exists: deleted, notified, confirmed, or cancelled with a reason.
/// </summary>
/// <remarks>
/// <para>
/// Delete, notify and cancel are <b>mutually exclusive by status</b>, and that is the whole rule. A
/// <see cref="MatchStatus.Drafted"/> match is plain-deleted — a mis-drag is simply removed, and no
/// reason is asked for (resolved question 3). Anything past Drafted has been communicated to somebody,
/// so it is cancelled with one of three reasons and kept. Nothing is ever both.
/// </para>
/// <para>
/// <b>Notified is reachable from 2026-09-11</b>, which amends resolved question 2. Pass 1 skipped it
/// because the notification mediums (in-app, SMS, email) are out of scope and a status called
/// Notified with nothing behind it was worse than no status at all. What changed is that the status
/// itself carries information APG wants on the board — this match has been put to the processor and
/// is awaiting their word — independently of how the message travels. <b>Nothing here sends
/// anything</b>, and nothing in this solution does: <see cref="Notify"/> moves the status and that is
/// its entire effect. The mediums remain deferred.
/// </para>
/// <para>
/// The lifecycle is therefore <c>Drafted → Notified → Confirmed</c>, with <c>Drafted → Confirmed</c>
/// still permitted: notifying is a step APG may take, not one it must. <see cref="CanConfirm"/>
/// accepts both live statuses, and it says so explicitly rather than by omission — a Notified match
/// inheriting Drafted's transition silently is exactly what the pass-1 comment here warned against.
/// </para>
/// <para>
/// <b>And only for ANZCO</b> (Mark, 2026-09-11). Notification is not part of Alliance Group's or
/// SFF's process at all, so for their matches the lifecycle really is <c>Drafted → Confirmed</c> and
/// the button does not appear. <see cref="ProcessorNotifications"/> holds that rule and the reasoning
/// behind it; <see cref="CanNotify"/> is the only thing that consults it.
/// </para>
/// <para>
/// Cancelling itself lives in <see cref="RecordCancellation.CancelMatch"/>, which stays the only path
/// that sets <see cref="MatchStatus.Cancelled"/>. This class decides <em>whether</em>; that one does it.
/// </para>
/// </remarks>
public static class MatchLifecycle
{
    /// <summary>Asked to delete a match that is past Drafted.</summary>
    public const string OnlyDraftedCanBeDeleted = "Only a drafted match can be deleted";

    /// <summary>Asked to notify a match that is not Drafted.</summary>
    public const string OnlyDraftedCanBeNotified = "Only a drafted match can be notified";

    /// <summary>Asked to confirm a match that is not Drafted or Notified.</summary>
    public const string OnlyALiveMatchCanBeConfirmed =
        "Only a drafted or notified match can be confirmed";

    /// <summary>Asked to cancel a draft, which is deleted instead.</summary>
    public const string ADraftIsDeletedNotCancelled =
        "A drafted match is deleted rather than cancelled";

    /// <summary>Asked to cancel a match that is already cancelled.</summary>
    public const string AlreadyCancelled = "This match is already cancelled";

    /// <summary>Asked to cancel without choosing one of the three reasons.</summary>
    public const string ReasonRequired = "Choose why this match is being cancelled";

    /// <summary>A mis-drag is removed outright, so only a draft may be deleted.</summary>
    public static bool CanDelete(Match match) => match.Status == MatchStatus.Drafted;

    /// <summary>
    /// Whether this match may be notified: its processor has notification in its lifecycle, and the
    /// match is still <see cref="MatchStatus.Drafted"/>.
    /// </summary>
    /// <remarks>
    /// Expressed through <see cref="NotifyBlockedReason"/> so the gate and the sentence explaining it
    /// are one piece of logic, exactly as <c>ProcessorSpaceRules.CanConfirm</c> is. The client hides
    /// the button rather than disabling it, so the sentence is the server's refusal and not a
    /// tooltip — but a crafted request and the absent control still have to agree about why.
    /// </remarks>
    public static bool CanNotify(Match match, ProcessorSpace space) =>
        NotifyBlockedReason(match, space) is null;

    /// <summary>
    /// Why <paramref name="match"/> may not be notified, or null when it may.
    /// </summary>
    /// <remarks>
    /// <b>The processor clause is tested first, and the order is the answer, not an accident.</b> For
    /// a confirmed SFF match both clauses are true, and "only a drafted match can be notified" would
    /// invite the operator to go and find a draft — when no SFF match, at any status, is ever
    /// notifiable. The more fundamental fact wins.
    /// </remarks>
    public static string? NotifyBlockedReason(Match match, ProcessorSpace space) =>
        !ProcessorNotifications.Receives(space.Processor)
            ? ProcessorNotifications.NotifyingIsNotPartOfTheirProcess(space.Processor)
            : match.Status != MatchStatus.Drafted
                ? OnlyDraftedCanBeNotified
                : null;

    /// <summary>
    /// Drafted or Notified → Confirmed. Both live, not-yet-agreed statuses are entries into Confirmed,
    /// because notifying is optional and a match that skipped it must still be confirmable.
    /// </summary>
    public static bool CanConfirm(Match match) =>
        match.Status is MatchStatus.Drafted or MatchStatus.Notified;

    /// <summary>Past Drafted and still live: a draft is deleted, and a cancelled match is done.</summary>
    public static bool CanCancel(Match match) =>
        match.Status is not (MatchStatus.Drafted or MatchStatus.Cancelled);

    /// <summary>
    /// Marks a match as notified to the processor. <b>It sends nothing.</b> The notification mediums
    /// are deferred beyond pass 1, and this is deliberately the whole of the transition: the status is
    /// the record that APG has put this match to the processor, and the message — however it
    /// eventually travels — is a separate concern that must not be implied by this write.
    /// </summary>
    public static void Notify(Match match) => match.Status = MatchStatus.Notified;

    /// <summary>
    /// Confirms a match. Touches nothing but the match — confirming one match says nothing about its
    /// siblings, and a Processor Space is confirmed by its own explicit action rather than by this one.
    /// </summary>
    public static void Confirm(Match match) => match.Status = MatchStatus.Confirmed;
}
