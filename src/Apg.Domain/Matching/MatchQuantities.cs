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
    /// A Processor Space's arithmetic. Filters <paramref name="matches"/> by the space's own id, so
    /// handing it the whole match set is safe rather than silently wrong — the failure mode of the
    /// alternative is a plausible number that is not this record's.
    /// </summary>
    public static QuantityTally ForSpace(ProcessorSpace space, IEnumerable<Match> matches) =>
        Tally(space.QuantityRequired, matches.Where(m => m.ProcessorSpaceId == space.Id).ToList());

    /// <summary>
    /// A Livestock Availability record's arithmetic, scoped the same way.
    /// </summary>
    public static QuantityTally ForAvailability(LivestockAvailability availability, IEnumerable<Match> matches) =>
        Tally(
            availability.QuantityAvailable,
            matches.Where(m => m.LivestockAvailabilityId == availability.Id).ToList());
}
