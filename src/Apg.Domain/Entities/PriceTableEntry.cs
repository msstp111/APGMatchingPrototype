namespace Apg.Domain.Entities;

/// <summary>
/// The default price per Kg shown when a match is drafted, keyed on
/// processor x Processor-Space stock class x week-commencing-Sunday (resolved question 7).
/// Seeded only; there is no maintenance UI in this prototype.
/// </summary>
public class PriceTableEntry
{
    public int Id { get; set; }

    public required string Processor { get; set; }

    /// <summary>A <em>Processor Space</em> stock class, never an availability one.</summary>
    public required string StockClass { get; set; }

    /// <summary>The Sunday at or before the delivery date.</summary>
    public DateOnly WeekCommencing { get; set; }

    public decimal PricePerKg { get; set; }
}
