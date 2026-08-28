using Apg.Domain.Entities;
using Apg.Domain.Pricing;

namespace Apg.Domain.Tests;

/// <summary>
/// The default price lookup: processor x <b>Processor Space</b> stock class x week-commencing Sunday.
/// </summary>
public class PriceTableTests
{
    private static readonly DateOnly Sunday = new(2026, 8, 23);

    private static PriceTable Table() => new(
    [
        new PriceTableEntry
        {
            Id = 1,
            Processor = "ANZCO",
            StockClass = "Nat Beef - Premium",
            WeekCommencing = Sunday,
            PricePerKg = 6.45m,
        },
        new PriceTableEntry
        {
            Id = 2,
            Processor = "ANZCO",
            StockClass = "Nat Beef - Premium",
            WeekCommencing = Sunday.AddDays(7),
            PricePerKg = 6.60m,
        },
        new PriceTableEntry
        {
            Id = 3,
            Processor = "SFF",
            StockClass = "Nat Beef - Premium",
            WeekCommencing = Sunday,
            PricePerKg = 6.10m,
        },
    ]);

    [Fact]
    public void A_seeded_combination_returns_its_price()
    {
        Assert.Equal(6.45m, Table().DefaultPricePerKg("ANZCO", "Nat Beef - Premium", Sunday));
    }

    [Fact]
    public void The_price_is_keyed_on_the_processor_as_well_as_the_stock_class()
    {
        Assert.Equal(6.10m, Table().DefaultPricePerKg("SFF", "Nat Beef - Premium", Sunday));
    }

    [Fact]
    public void The_price_is_keyed_on_the_week()
    {
        Assert.Equal(6.60m, Table().DefaultPricePerKg("ANZCO", "Nat Beef - Premium", Sunday.AddDays(7)));
    }

    /// <summary>
    /// A missing combination returns null and the caller decides. Inventing a fallback would put a
    /// made-up number in front of someone about to commit to it.
    /// </summary>
    [Fact]
    public void A_missing_combination_returns_null_rather_than_a_fallback()
    {
        Assert.Null(Table().DefaultPricePerKg("Alliance Group", "Nat Beef - Premium", Sunday));
        Assert.Null(Table().DefaultPricePerKg("ANZCO", "Lamb - Y", Sunday));
        Assert.Null(Table().DefaultPricePerKg("ANZCO", "Nat Beef - Premium", Sunday.AddDays(70)));
    }

    /// <summary>
    /// A mid-week date normalises to its Sunday, so a caller passing a delivery date straight through
    /// finds the row rather than silently missing it and showing an unpriced match.
    /// </summary>
    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(3)]
    [InlineData(6)]
    public void Any_day_of_the_week_finds_that_weeks_price(int dayOffset)
    {
        Assert.Equal(
            6.45m,
            Table().DefaultPricePerKg("ANZCO", "Nat Beef - Premium", Sunday.AddDays(dayOffset)));
    }

    [Fact]
    public void A_space_is_priced_from_its_own_delivery_week()
    {
        var space = new ProcessorSpace
        {
            Id = 1,
            Processor = "ANZCO",
            Plant = "Rangitikei",
            StockClass = "Nat Beef - Premium",
            QuantityRequired = 100,
            // Wednesday of the following week.
            DeliveryDate = Sunday.AddDays(10),
        };

        Assert.Equal(6.60m, Table().DefaultPricePerKg(space));
    }

    /// <summary>
    /// Resolved question 7. The availability record's stock class never enters the lookup — the two
    /// vocabularies do not map onto each other, and it is the meatworks that prices the class it buys.
    /// </summary>
    [Fact]
    public void An_availability_stock_class_is_not_a_key_into_this_table()
    {
        Assert.Null(Table().DefaultPricePerKg("ANZCO", "Prime", Sunday));
    }
}
