namespace Apg.Domain.Entities;

/// <summary>
/// A meatworks' committed slot: the demand side of the broker.
/// Stores raw values only — every matched sum and unmatched figure is computed from the match set.
/// </summary>
public class ProcessorSpace
{
    public int Id { get; set; }

    /// <summary>ANZCO, Alliance Group or SFF. The list lives in the API SeedConfig.</summary>
    public required string Processor { get; set; }

    public required string Plant { get; set; }

    /// <summary>
    /// From this processor's own stock class list. Processor Space stock classes and Livestock
    /// Availability stock classes are two non-aligned vocabularies; there is no mapping between them.
    /// </summary>
    public required string StockClass { get; set; }

    public int QuantityRequired { get; set; }

    /// <summary>A business date: no time, no zone.</summary>
    public DateOnly DeliveryDate { get; set; }

    /// <summary>One optional free-text field in pass 1 (resolved question 9).</summary>
    public string? DeliveryTime { get; set; }

    public string? Notes { get; set; }

    /// <summary>Not derived. Booked on creation, Confirmed only by an explicit APG action.</summary>
    public ProcessorSpaceStatus Status { get; set; } = ProcessorSpaceStatus.Booked;
}
