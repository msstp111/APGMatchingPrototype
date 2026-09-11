using Apg.Domain.Entities;

namespace Apg.Domain.Matching;

/// <summary>
/// The Processor Space side's rules.
/// </summary>
/// <remarks>
/// <b>There is deliberately no function here that derives a Processor Space's status.</b> Unlike the
/// availability side, a space's status is not a consequence of its matches: it is Booked on creation,
/// Confirmed only by an explicit APG action, and Cancelled explicitly. Providing a derivation would
/// invite a later phase to call it and overwrite a decision a human made. Both members below
/// <em>read</em> the stored status; neither computes one.
/// </remarks>
public static class ProcessorSpaceRules
{
    /// <summary>
    /// Why a Booked space is not yet confirmable. design-system.md 15 quotes this string, so it lives
    /// as a constant rather than as a sentence the client retypes.
    /// </summary>
    /// <remarks>
    /// It said "and no drafts" until 2026-09-11, which was true only while Notified was unreachable.
    /// A space whose every match is Notified has no drafts at all and still cannot be confirmed, so
    /// the sentence would have denied on screen exactly what the clause below asserts. The wording
    /// now states that clause itself.
    /// </remarks>
    public const string NeedsConfirmedMatches = "Needs every match confirmed, and at least one";

    /// <summary>Why a space that is already Confirmed offers nothing to confirm.</summary>
    public const string AlreadyConfirmed = "Already confirmed";

    /// <summary>Why a Cancelled space offers nothing to confirm.</summary>
    public const string SpaceIsCancelled = "This space is cancelled";

    /// <summary>Any future status that is neither Booked, Confirmed nor Cancelled.</summary>
    public const string NotOpenForConfirmation = "This space is not open for confirmation";

    /// <summary>
    /// Whether APG may confirm <paramref name="space"/>.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The gate is: the space is still <see cref="ProcessorSpaceStatus.Booked"/>, it has at least one
    /// live match, and <b>every</b> live match is Confirmed. Which is to say — there is something to
    /// confirm, and nothing about it is still provisional.
    /// </para>
    /// <para>
    /// Resolved question 12 words the match half as "at least one Confirmed match and no Drafted
    /// matches", written when Notified was out of scope. Notified is a live-but-not-yet-agreed status,
    /// so it blocks confirmation exactly as Drafted does; stating the rule as "every live match is
    /// Confirmed" covers both, and it did not rot when Notified became reachable on 2026-09-11 —
    /// only the sentence above had to change. The
    /// <see cref="ProcessorSpaceStatus.Booked"/> clause is an addition: without it a Cancelled space,
    /// or one already Confirmed, would report that it could be confirmed, and the suppression would
    /// have to live in the client.
    /// </para>
    /// <para>
    /// Note the shape is the same as the availability side's Confirmed clause. That is not a
    /// coincidence and the two should stay in step.
    /// </para>
    /// <para>
    /// Expressed through <see cref="ConfirmBlockedReason"/> so that the gate and the sentence explaining
    /// it are one piece of logic. A disabled Confirm button that cannot say why is what makes a
    /// non-technical operator conclude the application is broken (Phase 6, 5.3), and a second
    /// implementation of the gate to produce that sentence is how the two would come to disagree.
    /// </para>
    /// </remarks>
    public static bool CanConfirm(
        ProcessorSpace space,
        IEnumerable<Match> matches,
        CancelledRecords cancelled) =>
        ConfirmBlockedReason(space, matches, cancelled) is null;

    /// <summary>
    /// Why <paramref name="space"/> may not be confirmed, or null when it may.
    /// </summary>
    /// <remarks>
    /// Three distinct answers, because "Confirm is greyed out" needs three distinct explanations: the
    /// decision has already been taken, the space is cancelled, or the matches are not all agreed yet.
    /// A single catch-all sentence would read as wrong on two of the three.
    /// </remarks>
    public static string? ConfirmBlockedReason(
        ProcessorSpace space,
        IEnumerable<Match> matches,
        CancelledRecords cancelled)
    {
        switch (space.Status)
        {
            case ProcessorSpaceStatus.Confirmed:
                return AlreadyConfirmed;

            case ProcessorSpaceStatus.Cancelled:
                return SpaceIsCancelled;

            case ProcessorSpaceStatus.Booked:
                break;

            default:
                return NotOpenForConfirmation;
        }

        // The matches that actually fill this space: a match to a cancelled availability record fills
        // nothing, so it neither satisfies the gate nor blocks it. A space whose only match is one of
        // those has nothing confirmed against it and cannot be confirmed — which is the same answer
        // its meter gives, now that the match no longer counts towards it.
        var live = MatchQuantities.ConsumingSpace(space, matches, cancelled);

        return live.Count > 0 && live.All(m => m.Status == MatchStatus.Confirmed)
            ? null
            : NeedsConfirmedMatches;
    }
}
