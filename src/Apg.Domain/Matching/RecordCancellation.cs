using Apg.Domain.Entities;

namespace Apg.Domain.Matching;

/// <summary>
/// Cancelling records and matches — three separate acts that must stay separate.
/// </summary>
/// <remarks>
/// <b>Cancelling a Processor Space or an Availability record never cascades to its matches.</b> That
/// is deliberate, not an oversight: it lets APG arrange alternatives with the processors and farmers
/// on the other end before anyone is notified that their booking has gone. A cascade would fire off
/// that news the moment one record changed.
/// <para>
/// The two record helpers therefore take <b>no match collection at all</b>. They cannot cascade,
/// because they are not given anything to cascade to. That is the point of their signatures, and a
/// test asserts the behaviour as well — it is the single most likely rule for a future chat to
/// "helpfully" break.
/// </para>
/// </remarks>
public static class RecordCancellation
{
    /// <summary>Cancels a Processor Space. Touches nothing else.</summary>
    public static void CancelProcessorSpace(ProcessorSpace space) =>
        space.Status = ProcessorSpaceStatus.Cancelled;

    /// <summary>
    /// Cancels a Livestock Availability record. Touches nothing else — and note the record will keep
    /// deriving as Cancelled even while live matches hang off it, which is the intended state.
    /// </summary>
    public static void CancelAvailability(LivestockAvailability availability) =>
        availability.Status = LivestockAvailabilityStatus.Cancelled;

    /// <summary>Refused when a record has already been cancelled — there is nothing left to do to it.</summary>
    public const string SpaceAlreadyCancelled = "This processor space is already cancelled";

    /// <inheritdoc cref="SpaceAlreadyCancelled"/>
    public const string AvailabilityAlreadyCancelled =
        "This livestock availability record is already cancelled";

    /// <summary>
    /// Whether a Processor Space may be cancelled: anything but an already-cancelled one.
    /// </summary>
    /// <remarks>
    /// It takes the space and nothing else, for the same reason
    /// <see cref="CancelProcessorSpace"/> does. A gate that had to be handed the match set would be a
    /// gate that could come to depend on it — "no, there are matches" is exactly the cascade this file
    /// exists to make impossible. A Confirmed space is cancellable: a booking can fall through after it
    /// has been agreed, which is the case cancelling is for.
    /// </remarks>
    public static bool CanCancelProcessorSpace(ProcessorSpace space) =>
        space.Status != ProcessorSpaceStatus.Cancelled;

    /// <inheritdoc cref="CanCancelProcessorSpace"/>
    public static bool CanCancelAvailability(LivestockAvailability availability) =>
        availability.Status != LivestockAvailabilityStatus.Cancelled;

    /// <summary>
    /// Cancels a single match, which is the only way a match's status ever becomes Cancelled. A
    /// reason is required: the three are a change from the agent or farmer, a change from the
    /// processor, or an internal APG decision.
    /// </summary>
    /// <remarks>
    /// A Drafted match is plain-deleted rather than cancelled (resolved question 3) — a mis-drag is
    /// simply removed. Deletion is Phase 6's, and is not a status change.
    /// </remarks>
    public static void CancelMatch(Match match, MatchCancellationReason reason)
    {
        match.Status = MatchStatus.Cancelled;
        match.CancellationReason = reason;
    }
}
