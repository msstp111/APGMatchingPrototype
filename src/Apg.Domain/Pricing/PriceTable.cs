using Apg.Domain.Entities;
using Apg.Domain.Time;

namespace Apg.Domain.Pricing;

/// <summary>
/// The default price per Kg shown when a match is drafted, looked up by
/// processor x <b>Processor Space</b> stock class x week-commencing-Sunday (resolved question 7).
/// </summary>
/// <remarks>
/// <para>
/// Keyed on the Processor Space's stock class, never the Availability record's. The two vocabularies
/// do not map onto each other, and it is the meatworks that sets the price for the class it is
/// buying.
/// </para>
/// <para>
/// The price is a <em>default</em>. It is shown at draft time and stays editable on the match, so a
/// missing entry returns null and the caller decides what to do. Inventing a fallback price would
/// put a made-up number in front of someone about to commit to it.
/// </para>
/// </remarks>
public sealed class PriceTable
{
    private readonly Dictionary<(string Processor, string StockClass, DateOnly Week), decimal> _prices;

    public PriceTable(IEnumerable<PriceTableEntry> entries)
    {
        _prices = new Dictionary<(string, string, DateOnly), decimal>();

        foreach (var entry in entries)
        {
            // Last write wins rather than throwing on a duplicate: the table is seeded data behind a
            // unique index, and a price lookup is not the place to take the API down.
            _prices[(entry.Processor, entry.StockClass, NzTime.WeekCommencing(entry.WeekCommencing))] =
                entry.PricePerKg;
        }
    }

    /// <summary>
    /// The default price, or null when the table has no entry for that combination.
    /// </summary>
    /// <param name="weekCommencing">
    /// Any date in the week. It is normalised to its Sunday, so a caller passing a delivery date
    /// straight through still finds the row rather than silently missing it.
    /// </param>
    public decimal? DefaultPricePerKg(string processor, string processorSpaceStockClass, DateOnly weekCommencing) =>
        _prices.TryGetValue(
            (processor, processorSpaceStockClass, NzTime.WeekCommencing(weekCommencing)),
            out var price)
            ? price
            : null;

    /// <summary>
    /// The default price for a space, taking the week from its delivery date. This is the call site
    /// that matters — the drag prices the space it was dropped on.
    /// </summary>
    public decimal? DefaultPricePerKg(ProcessorSpace space) =>
        DefaultPricePerKg(space.Processor, space.StockClass, space.DeliveryDate);
}
