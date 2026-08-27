using System.Text.Json;
using Apg.Api.Seeding;
using Apg.Domain.Entities;
using Apg.Domain.Time;

namespace Apg.Api.Tests;

/// <summary>
/// Determinism and the date anchor. Two runs must produce identical data, and every date must be a
/// fixed offset from the Sunday that starts the current New Zealand week.
/// </summary>
public class SeedDeterminismTests
{
    private static readonly JsonSerializerOptions Json = new() { WriteIndented = false };

    [Fact]
    public void Generating_twice_from_the_same_anchor_produces_identical_data()
    {
        var first = SeedDataGenerator.Generate(SeedFixture.Anchor, SeedFixture.Locations);
        var second = SeedDataGenerator.Generate(SeedFixture.Anchor, SeedFixture.Locations);

        Assert.Equal(JsonSerializer.Serialize(first, Json), JsonSerializer.Serialize(second, Json));
    }

    [Fact]
    public void A_locations_farmer_never_changes_between_runs_or_anchors()
    {
        // Farmers are generated from a PRNG seeded with the location id, not drawn from the shared
        // stream, so they survive both a different anchor and any reordering elsewhere in the seeder.
        var thisWeek = SeedDataGenerator.Generate(SeedFixture.Anchor, SeedFixture.Locations);
        var nextYear = SeedDataGenerator.Generate(SeedFixture.Anchor.AddDays(364), SeedFixture.Locations);

        Assert.Equal(
            JsonSerializer.Serialize(thisWeek.Farmers, Json),
            JsonSerializer.Serialize(nextYear.Farmers, Json));
    }

    [Fact]
    public void The_seeder_anchors_on_the_New_Zealand_week_not_the_UTC_one()
    {
        // Saturday 13:00 UTC is already Sunday in New Zealand. Anchoring on the UTC clock would put
        // the entire dataset a week early for twelve hours of every Saturday.
        var clock = new FixedClock(DateTimeOffset.Parse("2026-08-22T13:00:00Z"));

        Assert.Equal(new DateOnly(2026, 8, 23), NzTime.CurrentWeekCommencing(clock));
    }

    [Fact]
    public void The_anchor_is_a_Sunday_and_is_carried_on_the_generated_data()
    {
        Assert.Equal(DayOfWeek.Sunday, SeedFixture.Anchor.DayOfWeek);
        Assert.Equal(SeedFixture.Anchor, SeedFixture.Data.AnchorWeekCommencing);
    }

    [Fact]
    public void Every_business_date_is_an_offset_from_the_anchor_within_the_seeded_window()
    {
        var earliest = SeedFixture.Anchor.AddDays(SeedDataGenerator.FirstWeekOffset * 7);
        var latest = SeedFixture.Anchor.AddDays((SeedDataGenerator.LastWeekOffset * 7) + 6);

        Assert.All(SeedFixture.Data.ProcessorSpaces, s => Assert.InRange(s.DeliveryDate, earliest, latest));
        Assert.All(SeedFixture.Data.Availabilities, a => Assert.InRange(a.AvailableFrom, earliest, latest));
    }

    [Fact]
    public void Records_are_spread_across_every_week_of_the_window()
    {
        var spaceWeeks = SeedFixture.Data.ProcessorSpaces
            .Select(s => NzTime.WeekCommencing(s.DeliveryDate))
            .Distinct()
            .Count();

        var availabilityWeeks = SeedFixture.Data.Availabilities
            .Select(a => NzTime.WeekCommencing(a.AvailableFrom))
            .Distinct()
            .Count();

        const int expectedWeeks = SeedDataGenerator.LastWeekOffset - SeedDataGenerator.FirstWeekOffset + 1;

        Assert.Equal(expectedWeeks, spaceWeeks);
        Assert.Equal(expectedWeeks, availabilityWeeks);
    }

    [Fact]
    public void Delivery_dates_fall_on_weekdays()
    {
        Assert.All(SeedFixture.Data.ProcessorSpaces, s =>
        {
            Assert.NotEqual(DayOfWeek.Sunday, s.DeliveryDate.DayOfWeek);
            Assert.NotEqual(DayOfWeek.Saturday, s.DeliveryDate.DayOfWeek);
        });
    }

    [Fact]
    public void The_generated_counts_are_the_ones_the_build_log_records()
    {
        Assert.Equal(299, SeedFixture.Data.Locations.Count);
        Assert.Equal(299, SeedFixture.Data.Farmers.Count);
        Assert.Equal(SeedDataGenerator.ProcessorSpaceCount, SeedFixture.Data.ProcessorSpaces.Count);
        Assert.Equal(SeedDataGenerator.AvailabilityCount, SeedFixture.Data.Availabilities.Count);
        Assert.Equal(SeedDataGenerator.TargetMatchCount, SeedFixture.Data.Matches.Count);
        Assert.Equal(182, SeedFixture.Data.Prices.Count);

        // The match status split is recorded in the build log; Phase 1's tests are written against
        // these numbers, so a change to the seed has to be a change to the log too.
        var byStatus = SeedFixture.Data.Matches.GroupBy(m => m.Status).ToDictionary(g => g.Key, g => g.Count());
        Assert.Equal(8, byStatus[MatchStatus.Drafted]);
        Assert.Equal(15, byStatus[MatchStatus.Confirmed]);
        Assert.Equal(2, byStatus[MatchStatus.Cancelled]);
    }

    [Fact]
    public void Ids_are_unique_within_every_set()
    {
        AssertUniqueIds(SeedFixture.Data.Locations.Select(x => x.Id), nameof(SeedData.Locations));
        AssertUniqueIds(SeedFixture.Data.Farmers.Select(x => x.Id), nameof(SeedData.Farmers));
        AssertUniqueIds(SeedFixture.Data.ProcessorSpaces.Select(x => x.Id), nameof(SeedData.ProcessorSpaces));
        AssertUniqueIds(SeedFixture.Data.Availabilities.Select(x => x.Id), nameof(SeedData.Availabilities));
        AssertUniqueIds(SeedFixture.Data.Matches.Select(x => x.Id), nameof(SeedData.Matches));
        AssertUniqueIds(SeedFixture.Data.Prices.Select(x => x.Id), nameof(SeedData.Prices));
    }

    [Fact]
    public void Every_availability_record_resolves_to_a_seeded_location_and_farmer()
    {
        var farmersByLocation = SeedFixture.Data.Farmers.ToDictionary(f => f.LocationId);

        Assert.All(SeedFixture.Data.Availabilities, a => Assert.True(farmersByLocation.ContainsKey(a.LocationId)));
    }

    private static void AssertUniqueIds(IEnumerable<int> ids, string setName)
    {
        var list = ids.ToList();
        Assert.Equal(list.Count, list.Distinct().Count());
        Assert.All(list, id => Assert.True(id > 0, $"{setName} contains a non-positive id."));
    }
}
