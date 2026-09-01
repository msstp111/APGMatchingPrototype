using Apg.Domain.Entities;

namespace Apg.Domain.Matching;

/// <summary>
/// The two matched sums and the unmatched figure. Every card, dialog and colour decision in the
/// prototype is downstream of this class, and there is exactly one implementation of it.
/// </summary>
public static class MatchQuantities
{
    /// <summary>
    /// Sum of quantity matched across every match that is not Cancelled — <b>drafts included</b>.
    /// APG-only, and the figure <see cref="QuantityTally.Unmatched"/> is computed from.
    /// </summary>
    public static int MatchedInclDraft(IEnumerable<Match> matches) =>
        matches.Where(IsLive).Sum(m => m.QuantityMatched);

    /// <summary>
    /// Sum across matches that are neither Cancelled nor Drafted. Shown to processors and farmers,
    /// labelled simply "Quantity Matched".
    /// </summary>
    public static int MatchedExclDraft(IEnumerable<Match> matches) =>
        matches.Where(m => IsLive(m) && m.Status != MatchStatus.Drafted).Sum(m => m.QuantityMatched);

    /// <summary>A match that still counts. Cancelled matches consume no quantity on either side.</summary>
    public static bool IsLive(Match match) => match.Status != MatchStatus.Cancelled;

    /// <summary>
    /// The core arithmetic. <paramref name="matchesForThisRecord"/> must already be scoped to one
    /// record; the overloads below do that scoping for you and are what callers should reach for.
    /// </summary>
    public static QuantityTally Tally(int original, IEnumerable<Match> matchesForThisRecord)
    {
        var scoped = matchesForThisRecord as IReadOnlyCollection<Match> ?? matchesForThisRecord.ToList();

        return new QuantityTally(original, MatchedInclDraft(scoped), MatchedExclDraft(scoped));
    }

    /// <summary>
    /// The matches that consume a Processor Space's quantity: its own, still live, and <b>not</b> tied
    /// to a cancelled availability record.
    /// </summary>
    /// <remarks>
    /// Public because two other rules need exactly this set — the confirm gate, and nothing else may
    /// re-derive it. Note which status is consulted: tallying a space asks about the <em>availability
    /// record</em> on the other end, never about the space itself. A cancelled space's own figures are
    /// untouched by its own cancellation.
    /// </remarks>
    public static IReadOnlyList<Match> ConsumingSpace(
        ProcessorSpace space,
        IEnumerable<Match> matches,
        CancelledRecords cancelled) =>
        matches
            .Where(m => m.ProcessorSpaceId == space.Id && IsLive(m) && !cancelled.AvailabilityOf(m))
            .ToList();

    /// <inheritdoc cref="ConsumingSpace"/>
    public static IReadOnlyList<Match> ConsumingAvailability(
        LivestockAvailability availability,
        IEnumerable<Match> matches,
        CancelledRecords cancelled) =>
        matches
            .Where(m => m.LivestockAvailabilityId == availability.Id && IsLive(m) && !cancelled.SpaceOf(m))
            .ToList();

    /// <summary>
    /// A Processor Space's arithmetic. Filters <paramref name="matches"/> by the space's own id, so
    /// handing it the whole match set is safe rather than silently wrong — the failure mode of the
    /// alternative is a plausible number that is not this record's.
    /// </summary>
    /// <remarks>
    /// <paramref name="cancelled"/> is required rather than optional because the answer is wrong
    /// without it and wrong in the direction that hides supply: a match to a cancelled availability
    /// record would go on filling this space forever. Pass <see cref="CancelledRecords.None"/> only
    /// when there genuinely are no records — a unit test over hand-built matches.
    /// </remarks>
    public static QuantityTally ForSpace(
        ProcessorSpace space,
        IEnumerable<Match> matches,
        CancelledRecords cancelled) =>
        Tally(space.QuantityRequired, ConsumingSpace(space, matches, cancelled));

    /// <inheritdoc cref="ForSpace"/>
    public static QuantityTally ForAvailability(
        LivestockAvailability availability,
        IEnumerable<Match> matches,
        CancelledRecords cancelled) =>
        Tally(
            availability.QuantityAvailable,
            ConsumingAvailability(availability, matches, cancelled));
}
