using Apg.Api.Seeding;
using Apg.Domain.Matching;
using Apg.Domain.Time;

namespace Apg.Api.Tests;

/// <summary>
/// The seed's vocabularies, price table and PRNG. Everything invented lives in
/// <see cref="SeedConfig"/> so swapping in APG's real lists is a single-file edit.
/// </summary>
public class SeedConfigurationTests
{
    [Fact]
    public void Processor_space_stock_classes_are_exactly_the_specified_per_processor_lists()
    {
        var byProcessor = SeedConfig.ProcessorSpaceStockClasses.ToDictionary(p => p.Processor, p => p.StockClasses);

        Assert.Equal(
            ["Cows", "Prime", "Nat Beef - Ultra", "Nat Beef - Premium", "Bulls", "Lamb", "Mutton"],
            byProcessor["ANZCO"]);
        Assert.Equal(["Lamb", "Mutton", "Cattle", "Deer"], byProcessor["Alliance Group"]);

        // "Lamb", not "Lambs": APG confirmed SFF spells it the same way everyone else does. The two
        // vocabularies still do not align — Cows against Cow, Cattle against Mixed Cattle — and this
        // one word is not the reason they don't.
        Assert.Equal(["Lamb", "Prime", "Cows"], byProcessor["SFF"]);
    }

    /// <summary>
    /// The processor mix APG actually sees, and the reason it is a weighted list rather than a cycle:
    /// <c>Processors[i % 3]</c> aliased with the six-week spread, so every week held exactly one
    /// processor.
    /// </summary>
    [Fact]
    public void The_processor_mix_is_seventy_twenty_ten()
    {
        var byProcessor = SeedConfig.ProcessorMix.ToDictionary(p => p.Processor, p => p.Weight);

        Assert.Equal(70, byProcessor["ANZCO"]);
        Assert.Equal(20, byProcessor["Alliance Group"]);
        Assert.Equal(10, byProcessor["SFF"]);
        Assert.Equal(100, SeedConfig.ProcessorMix.Sum(p => p.Weight));
    }

    [Fact]
    public void The_availability_stock_class_list_is_the_single_separate_supply_side_list()
    {
        Assert.Equal(
            ["GFNB ultra", "GFNB premium", "Prime", "Cow", "Sire Bull", "Bull", "Mixed Cattle", "Lamb", "Mutton"],
            SeedConfig.AvailabilityStockClasses);
    }

    [Fact]
    public void Every_processor_has_plants_and_at_least_fifteen_carriers_exist()
    {
        // The plants are APG's real ones, transcribed from Data/Plants.csv: ANZCO 7, Alliance 7,
        // SFF 5. The original 3-to-5 bound described the invented list this replaced.
        Assert.All(SeedConfig.PlantsByProcessor, p => Assert.InRange(p.Plants.Length, 3, 10));
        Assert.True(SeedConfig.TransportCompanies.Length >= 15);
        Assert.Equal(SeedConfig.Processors.Length, SeedConfig.PlantsByProcessor.Length);
    }

    [Fact]
    public void The_plants_are_the_real_ones_from_the_data_folder()
    {
        Assert.Equal(
            ["Canterbury", "Eltham", "Kokiri", "Manawatu", "Marlborough", "Rakaia", "Rangitikei"],
            SeedConfig.PlantsByProcessor.First(p => p.Processor == "ANZCO").Plants);
        Assert.Equal(
            ["Dannevirke", "Levin", "Lorneville", "Mataura", "Nelson", "Pukeuri", "Smithfield"],
            SeedConfig.PlantsByProcessor.First(p => p.Processor == "Alliance Group").Plants);
        Assert.Equal(
            ["Belfast", "Finegand", "Pacific", "Pareora", "Waitane"],
            SeedConfig.PlantsByProcessor.First(p => p.Processor == "SFF").Plants);
    }

    [Fact]
    public void Every_stock_class_on_both_sides_appears_in_the_seeded_records()
    {
        // Guaranteed coverage matters: the demonstration cases pick records by stock class, and a
        // random pass could otherwise leave a class out entirely.
        foreach (var (processor, stockClasses) in SeedConfig.ProcessorSpaceStockClasses)
        {
            foreach (var stockClass in stockClasses)
            {
                Assert.Contains(
                    SeedFixture.Data.ProcessorSpaces,
                    s => s.Processor == processor && s.StockClass == stockClass);
            }
        }

        foreach (var stockClass in SeedConfig.AvailabilityStockClasses)
        {
            Assert.Contains(SeedFixture.Data.Availabilities, a => a.StockClass == stockClass);
        }
    }

    [Fact]
    public void Every_space_uses_a_plant_and_a_stock_class_belonging_to_its_own_processor()
    {
        foreach (var space in SeedFixture.Data.ProcessorSpaces)
        {
            var plants = SeedConfig.PlantsByProcessor.First(p => p.Processor == space.Processor).Plants;
            var classes = SeedConfig.ProcessorSpaceStockClasses.First(p => p.Processor == space.Processor).StockClasses;

            Assert.Contains(space.Plant, plants);
            Assert.Contains(space.StockClass, classes);
        }
    }

    [Fact]
    public void The_price_table_covers_every_processor_and_stock_class_for_the_whole_window()
    {
        var keys = SeedFixture.Data.Prices
            .Select(p => (p.Processor, p.StockClass, p.WeekCommencing))
            .ToHashSet();

        foreach (var (processor, stockClasses) in SeedConfig.ProcessorSpaceStockClasses)
        {
            foreach (var stockClass in stockClasses)
            {
                for (var week = -SeedDataGenerator.PriceWeeksBefore; week <= SeedDataGenerator.PriceWeeksAfter; week++)
                {
                    Assert.Contains((processor, stockClass, SeedFixture.Anchor.AddDays(week * 7)), keys);
                }
            }
        }
    }

    [Fact]
    public void Every_price_table_week_commences_on_a_Sunday_and_sits_in_a_realistic_band()
    {
        Assert.All(SeedFixture.Data.Prices, p =>
        {
            Assert.Equal(DayOfWeek.Sunday, p.WeekCommencing.DayOfWeek);

            var (min, max) = SeedConfig.PriceRange(p.StockClass);
            Assert.InRange(p.PricePerKg, min, max);
        });
    }

    [Fact]
    public void Prices_mostly_hold_week_to_week_and_occasionally_step()
    {
        var series = SeedFixture.Data.Prices
            .GroupBy(p => (p.Processor, p.StockClass))
            .Select(g => g.OrderBy(p => p.WeekCommencing).Select(p => p.PricePerKg).ToList())
            .ToList();

        var comparisons = 0;
        var changes = 0;

        foreach (var prices in series)
        {
            for (var i = 1; i < prices.Count; i++)
            {
                comparisons++;
                if (prices[i] != prices[i - 1])
                {
                    changes++;
                }
            }
        }

        Assert.True(changes > 0, "Prices never step; the seeded series is flat.");
        Assert.True(changes < comparisons / 2, "Prices change too often to read as a steady market.");
    }

    [Fact]
    public void Match_prices_come_from_the_price_table_for_the_spaces_own_delivery_week()
    {
        // Keyed on the PROCESSOR SPACE stock class, never the availability one (resolved question 7).
        var spaces = SeedFixture.Data.ProcessorSpaces.ToDictionary(s => s.Id);
        var prices = SeedFixture.Data.Prices
            .ToDictionary(p => (p.Processor, p.StockClass, p.WeekCommencing), p => p.PricePerKg);

        foreach (var match in SeedFixture.Data.Matches)
        {
            var space = spaces[match.ProcessorSpaceId];
            var listed = prices[(space.Processor, space.StockClass, NzTime.WeekCommencing(space.DeliveryDate))];

            Assert.NotNull(match.PricePerKg);

            // The default is editable, so the seed nudges a few of them. Anything further than
            // fifteen cents from the table price means the lookup key is wrong.
            Assert.True(
                Math.Abs(match.PricePerKg!.Value - listed) <= 0.15m,
                $"Match {match.Id} is priced at {match.PricePerKg} against a table price of {listed}.");
        }
    }

    [Fact]
    public void Quantities_are_realistic_for_the_species()
    {
        foreach (var space in SeedFixture.Data.ProcessorSpaces)
        {
            var (min, max) = SeedConfig.QuantityRange(space.StockClass);
            Assert.InRange(space.QuantityRequired, min - 10, max);
        }

        foreach (var availability in SeedFixture.Data.Availabilities)
        {
            var (min, max) = SeedConfig.QuantityRange(availability.StockClass);
            Assert.InRange(availability.QuantityAvailable, min - 10, max);
        }
    }

    [Fact]
    public void Mulberry32_is_a_fixed_algorithm_that_will_not_drift_with_the_framework()
    {
        // Golden values. If a .NET upgrade ever changes these, the demo dataset has changed shape
        // and this test is the only thing that will say so.
        var rng = new Mulberry32(1);

        Assert.Equal(2693262067u, rng.NextUInt());
        Assert.Equal(11749833u, rng.NextUInt());
        Assert.Equal(2265367787u, rng.NextUInt());
    }

    /// <summary>
    /// Every seeded stock class, on both sides, has an explicit entry in the domain's compatibility
    /// table.
    /// </summary>
    /// <remarks>
    /// <para>
    /// This is the half of <c>StockClassCompatibility</c> that its own unit tests cannot see. The
    /// table fails <em>open</em> — a class it has never heard of is compatible with everything — so a
    /// missing entry breaks nothing, shows up nowhere, and quietly turns "Filter on drag" into a
    /// no-op for that class. The only way to notice is to ask, from the side that owns the
    /// vocabularies.
    /// </para>
    /// <para>
    /// It lives here rather than in <c>Apg.Domain.Tests</c> because the vocabularies are
    /// <see cref="SeedConfig"/>'s and the domain deliberately does not know them: it maps whatever
    /// name it is handed. When APG swap these lists for their real ones, this test is what says which
    /// new classes the table has not been told about.
    /// </para>
    /// </remarks>
    [Fact]
    public void Every_seeded_stock_class_is_known_to_the_compatibility_table()
    {
        var classes = SeedConfig.ProcessorSpaceStockClasses
            .SelectMany(p => p.StockClasses)
            .Concat(SeedConfig.AvailabilityStockClasses)
            .Distinct()
            .ToList();

        var unknown = classes.Where(c => !StockClassCompatibility.IsKnown(c)).ToList();

        Assert.Empty(unknown);
    }

    /// <summary>
    /// Every seeded Processor Space class except Deer has somewhere to come from, and every seeded
    /// availability class has somewhere to go.
    /// </summary>
    /// <remarks>
    /// A pairing test over the real lists rather than over hand-picked names, so a class whose entry
    /// exists but pairs with nothing — a typo'd tag, an en dash in <c>Nat Beef - Ultra</c> — is caught
    /// as well as a missing one. Deer is the deliberate exception: Alliance Group books deer and the
    /// supply vocabulary has none, so grabbing a Deer space empties the far column, and the matching
    /// screen draws that state rather than treating it as an error.
    /// </remarks>
    [Fact]
    public void Every_seeded_class_has_a_counterpart_except_Alliance_Groups_Deer()
    {
        var spaceClasses = SeedConfig.ProcessorSpaceStockClasses
            .SelectMany(p => p.StockClasses)
            .Distinct()
            .ToList();

        var pairable = spaceClasses
            .Where(space => SeedConfig.AvailabilityStockClasses
                .Any(availability => StockClassCompatibility.AreCompatible(space, availability)))
            .ToList();

        Assert.Equal(spaceClasses.Where(c => c != "Deer"), pairable);

        Assert.All(SeedConfig.AvailabilityStockClasses, availability =>
            Assert.Contains(
                spaceClasses,
                space => StockClassCompatibility.AreCompatible(space, availability)));
    }

    [Fact]
    public void Farmers_have_a_name_and_a_New_Zealand_mobile_number()
    {
        Assert.All(SeedFixture.Data.Farmers, f =>
        {
            Assert.Contains(' ', f.Name);
            Assert.Contains(f.Mobile[..3], SeedConfig.MobilePrefixes);
        });
    }
}
