namespace Apg.Domain.Entities;

/// <summary>
/// A farmer's stock on offer: the supply side of the broker.
/// The farmer is derived from the location (resolved question 10), so no farmer id is stored here.
/// </summary>
public class LivestockAvailability
{
    public int Id { get; set; }

    /// <summary>From the single availability stock class list — not a processor's list.</summary>
    public required string StockClass { get; set; }

    public int QuantityAvailable { get; set; }

    public int LocationId { get; set; }

    /// <summary>A business date: no time, no zone.</summary>
    public DateOnly AvailableFrom { get; set; }

    public string? AvailabilityDetails { get; set; }

    public TransactionType TransactionType { get; set; }

    public string? Notes { get; set; }

    /// <summary>
    /// Only <see cref="LivestockAvailabilityStatus.Cancelled"/> is meaningful as stored state; the
    /// live status is derived from the record's matches in Apg.Domain (Phase 1). Persisted as the
    /// creation value so an explicit cancellation has somewhere to live.
    /// </summary>
    public LivestockAvailabilityStatus Status { get; set; } = LivestockAvailabilityStatus.Booked;
}
