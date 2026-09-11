using System.Text.Json;
using Apg.Api.Seeding;
using Apg.Domain.Entities;
using Apg.Domain.Matching;
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
        // One series per processor x its own stock classes, over the thirteen weeks the price table
        // spans: (10 ANZCO + 6 Alliance Group + 3 SFF) x 13. It was 182 until the 2026-09-11 stock
        // class revision added ANZCO's three lamb programmes and split Alliance Group's Cattle.
        Assert.Equal(247, SeedFixture.Data.Prices.Count);

        // The match status split is pinned so that a change to the seed is a deliberate one. It was
        // 8 / 15 / 2 until the 2026-09-11 stock class revision: the new classes lengthen the price
        // series and the per-processor walks, which moves the shared PRNG stream on, so the filler
        // pass draws different statuses. The demonstration spine's own matches are scripted and are
        // unaffected; only the filler moved.
        var byStatus = SeedFixture.Data.Matches.GroupBy(m => m.Status).ToDictionary(g => g.Key, g => g.Count());
        Assert.Equal(11, byStatus[MatchStatus.Drafted]);
        Assert.Equal(12, byStatus[MatchStatus.Confirmed]);
        Assert.Equal(2, byStatus[MatchStatus.Cancelled]);

        // Space statuses are pinned the same way, and for the same reason: the matching screen's
        // default filter is Status = Booked, so this split is what "showing 34 of 40" is made of.
        var spacesByStatus = SeedFixture.Data.ProcessorSpaces
            .GroupBy(s => s.Status)
            .ToDictionary(g => g.Key, g => g.Count());

        Assert.Equal(
            SeedDataGenerator.ProcessorSpaceCount
                - SeedDataGenerator.ConfirmedSpaceCount
                - SeedDataGenerator.CancelledSpaceCount,
            spacesByStatus[ProcessorSpaceStatus.Booked]);
        Assert.Equal(SeedDataGenerator.ConfirmedSpaceCount, spacesByStatus[ProcessorSpaceStatus.Confirmed]);
        Assert.Equal(SeedDataGenerator.CancelledSpaceCount, spacesByStatus[ProcessorSpaceStatus.Cancelled]);
    }

    /// <summary>
    /// The two rules the status pass has to respect, asserted against the domain rather than against
    /// the seeder's own bookkeeping.
    /// </summary>
    [Fact]
    public void Every_confirmed_space_is_one_the_domain_agrees_could_be_confirmed()
    {
        var matches = SeedFixture.Data.Matches;

        foreach (var space in SeedFixture.Data.ProcessorSpaces
                     .Where(s => s.Status == ProcessorSpaceStatus.Confirmed))
        {
            var its = matches.Where(m => m.ProcessorSpaceId == space.Id).ToList();

            Assert.Contains(its, MatchQuantities.IsLive);
            Assert.All(its.Where(MatchQuantities.IsLive), m => Assert.Equal(MatchStatus.Confirmed, m.Status));
        }
    }

    /// <summary>
    /// Cancelling a record never cascades to its matches (a deliberate rule, so APG can arrange
    /// alternatives before notifying anyone), and the seed shows it rather than leaving a later phase
    /// to demonstrate it from nothing.
    /// </summary>
    [Fact]
    public void At_least_one_cancelled_space_still_holds_live_matches()
    {
        var cancelled = SeedFixture.Data.ProcessorSpaces
            .Where(s => s.Status == ProcessorSpaceStatus.Cancelled)
            .Select(s => s.Id)
            .ToHashSet();

        Assert.Contains(
            SeedFixture.Data.Matches.Where(MatchQuantities.IsLive),
            m => cancelled.Contains(m.ProcessorSpaceId));
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
