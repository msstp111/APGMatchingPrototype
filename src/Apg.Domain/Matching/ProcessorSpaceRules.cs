using Apg.Domain.Entities;

namespace Apg.Domain.Matching;

/// <summary>
/// The Processor Space side's rules.
/// </summary>
/// <remarks>
/// <b>There is deliberately no function here that derives a Processor Space's status.</b> Unlike the
/// availability side, a space's status is not a consequence of its matches: it is Booked on creation,
/// Confirmed only by an explicit APG action, and Cancelled explicitly. Providing a derivation would
/// invite a later phase to call it and overwrite a decision a human made.
/// </remarks>
public static class ProcessorSpaceRules
{
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
    /// Confirmed" covers both and cannot rot when notifications arrive. The
    /// <see cref="ProcessorSpaceStatus.Booked"/> clause is an addition: without it a Cancelled space,
    /// or one already Confirmed, would report that it could be confirmed, and the suppression would
    /// have to live in the client.
    /// </para>
    /// <para>
    /// Note the shape is the same as the availability side's Confirmed clause. That is not a
    /// coincidence and the two should stay in step.
    /// </para>
    /// </remarks>
    public static bool CanConfirm(ProcessorSpace space, IEnumerable<Match> matches)
    {
        if (space.Status != ProcessorSpaceStatus.Booked)
        {
            return false;
        }

        var live = matches
            .Where(m => m.ProcessorSpaceId == space.Id)
            .Where(MatchQuantities.IsLive)
            .ToList();

        return live.Count > 0 && live.TrueForAll(m => m.Status == MatchStatus.Confirmed);
    }
}
