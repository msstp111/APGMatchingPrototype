namespace Apg.Domain.Entities;

/// <summary>
/// The join between a Processor Space and a Livestock Availability record, and a first-class entity
/// with its own quantity, price, carrier and status. The relationship is many-to-many: one space is
/// filled from several availability records, one availability record splits across several spaces.
/// Never model this as a foreign key on either side.
/// </summary>
/// <remarks>
/// Cancelling either parent record never cascades to its matches. That is deliberate: it lets APG
/// arrange alternatives before notifying anyone.
/// </remarks>
public class Match
{
    public int Id { get; set; }

    public int ProcessorSpaceId { get; set; }

    public int LivestockAvailabilityId { get; set; }

    public int QuantityMatched { get; set; }

    /// <summary>
    /// Defaulted from the price table at draft time — keyed on the <em>Processor Space</em> stock
    /// class (resolved question 7) — and editable thereafter.
    /// </summary>
    public decimal? PricePerKg { get; set; }

    public string? TransportCompany { get; set; }

    public MatchStatus Status { get; set; } = MatchStatus.Drafted;

    /// <summary>Required when, and only when, the match is Cancelled.</summary>
    public MatchCancellationReason? CancellationReason { get; set; }

    /// <summary>An instant, not a business date — this one genuinely has a time and a zone.</summary>
    public DateTimeOffset CreatedAt { get; set; }
}
