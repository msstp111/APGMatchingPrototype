using Apg.Domain.Entities;

namespace Apg.Domain.Matching;

/// <summary>
/// A Livestock Availability record's status is <b>derived from its matches</b>, not set. Only
/// Cancelled is stored, because only a cancellation is a decision rather than a consequence.
/// </summary>
public static class AvailabilityStatus
{
    /// <summary>
    /// The live status of <paramref name="availability"/>, given its matches.
    /// </summary>
    /// <remarks>
    /// <para>The branches, in order, and why each is where it is:</para>
    /// <list type="number">
    /// <item><description>
    /// Stored <see cref="LivestockAvailabilityStatus.Cancelled"/> wins outright. Cancelling a record
    /// never cascades to its matches, so a cancelled record can still have live ones hanging off it
    /// while APG arranges an alternative — and it must still read as Cancelled.
    /// </description></item>
    /// <item><description>
    /// No live matches → <see cref="LivestockAvailabilityStatus.Booked"/>. Cancelled matches do not
    /// count; a record whose only match was cancelled is back to being simply on offer.
    /// </description></item>
    /// <item><description>
    /// Unmatched <b>exactly zero</b> and every match Confirmed-or-Cancelled →
    /// <see cref="LivestockAvailabilityStatus.Confirmed"/>. Exactly zero, not "zero or less"
    /// (resolved question 5) — safe because a match is hard-capped at remaining supply, so negative
    /// unmatched on this side means something is wrong and the record must not read as settled.
    /// </description></item>
    /// <item><description>Anything else → <see cref="LivestockAvailabilityStatus.Pending"/>.</description></item>
    /// </list>
    /// </remarks>
    public static LivestockAvailabilityStatus Derive(
        LivestockAvailability availability,
        IEnumerable<Match> matches)
    {
        if (availability.Status == LivestockAvailabilityStatus.Cancelled)
        {
            return LivestockAvailabilityStatus.Cancelled;
        }

        var scoped = matches.Where(m => m.LivestockAvailabilityId == availability.Id).ToList();
        var live = scoped.Where(MatchQuantities.IsLive).ToList();

        if (live.Count == 0)
        {
            return LivestockAvailabilityStatus.Booked;
        }

        var unmatched = MatchQuantities.Tally(availability.QuantityAvailable, scoped).Unmatched;

        return unmatched == 0 && live.TrueForAll(m => m.Status == MatchStatus.Confirmed)
            ? LivestockAvailabilityStatus.Confirmed
            : LivestockAvailabilityStatus.Pending;
    }
}
