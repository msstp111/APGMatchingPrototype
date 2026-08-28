using Apg.Domain.Entities;

namespace Apg.Domain.Tests;

/// <summary>
/// Small builders so a test reads as the case it is testing rather than as object construction.
/// Every value not named by a test is irrelevant to it and is filled in here.
/// </summary>
internal static class Given
{
    /// <summary>Sunday 23 August 2026 — the same pinned week the seed tests use.</summary>
    public static readonly DateOnly Week = new(2026, 8, 23);

    public static ProcessorSpace Space(
        int quantityRequired,
        int id = 1,
        ProcessorSpaceStatus status = ProcessorSpaceStatus.Booked) =>
        new()
        {
            Id = id,
            Processor = "ANZCO",
            Plant = "Rangitikei",
            StockClass = "Nat Beef - Premium",
            QuantityRequired = quantityRequired,
            DeliveryDate = Week.AddDays(3),
            Status = status,
        };

    public static LivestockAvailability Availability(
        int quantityAvailable,
        int id = 1,
        LivestockAvailabilityStatus status = LivestockAvailabilityStatus.Booked) =>
        new()
        {
            Id = id,
            StockClass = "Prime",
            QuantityAvailable = quantityAvailable,
            LocationId = 7,
            AvailableFrom = Week.AddDays(1),
            TransactionType = TransactionType.GrazingStock,
            Status = status,
        };

    public static Match Match(
        int quantity,
        MatchStatus status,
        int id = 1,
        int spaceId = 1,
        int availabilityId = 1) =>
        new()
        {
            Id = id,
            ProcessorSpaceId = spaceId,
            LivestockAvailabilityId = availabilityId,
            QuantityMatched = quantity,
            Status = status,
            CancellationReason = status == MatchStatus.Cancelled
                ? MatchCancellationReason.InternalDecisionByApg
                : null,
            CreatedAt = new DateTimeOffset(2026, 8, 20, 9, 0, 0, TimeSpan.FromHours(12)),
        };

    /// <summary>
    /// A set of matches against one pair, numbered from 1 so each has a distinct id — a shared id
    /// would let a bug that keys on it pass by accident.
    /// </summary>
    public static List<Match> Matches(params (int Quantity, MatchStatus Status)[] matches) =>
        matches.Select((m, i) => Match(m.Quantity, m.Status, id: i + 1)).ToList();
}
