using System.Text.Json;
using Apg.Api.Contracts;
using Apg.Domain.Entities;
using Apg.Domain.Matching;
using Apg.Domain.Time;

namespace Apg.Api.Tests;

/// <summary>
/// The wire format. Asserted against <see cref="ApiJson.Options"/>, which is the same object the host
/// serialises with — a second copy of the options here would be exactly the drift these tests exist
/// to catch.
/// </summary>
public class DtoSerialisationTests
{
    private static JsonElement Serialise<T>(T value) =>
        JsonDocument.Parse(JsonSerializer.Serialize(value, ApiJson.Options)).RootElement;

    /// <summary>
    /// A business date has no time and no zone. <c>yyyy-MM-dd</c> is what the client receives, and it
    /// must never construct a JavaScript <c>Date</c> from it — that would hand the browser's timezone
    /// a decision this design settles on the server.
    /// </summary>
    [Fact]
    public void A_DateOnly_goes_over_the_wire_as_an_ISO_date_with_no_zone_and_no_time()
    {
        var json = Serialise(new { date = new DateOnly(2026, 8, 23) });

        Assert.Equal("2026-08-23", json.GetProperty("date").GetString());
    }

    [Fact]
    public void A_DateOnly_round_trips_without_drifting()
    {
        // Every day of a week either side of both daylight-saving Sundays: a serialiser that went via
        // a UTC instant would shift some of these by a day.
        var dates = Enumerable.Range(-7, 15)
            .SelectMany(offset => new[]
            {
                new DateOnly(2026, 4, 5).AddDays(offset),
                new DateOnly(2026, 9, 27).AddDays(offset),
            })
            .ToList();

        var json = JsonSerializer.Serialize(dates, ApiJson.Options);
        var round = JsonSerializer.Deserialize<List<DateOnly>>(json, ApiJson.Options);

        Assert.Equal(dates, round);
    }

    [Fact]
    public void Enums_go_over_the_wire_as_strings()
    {
        // So the client's own types stay readable, and so adding a status later cannot silently
        // renumber an existing one.
        var json = Serialise(new
        {
            matchStatus = MatchStatus.Drafted,
            spaceStatus = ProcessorSpaceStatus.Booked,
            availabilityStatus = LivestockAvailabilityStatus.Pending,
            transactionType = TransactionType.FinanceStock,
            quantityState = QuantityState.Over,
            reason = MatchCancellationReason.ChangeFromAgentOrFarmer,
        });

        Assert.Equal("Drafted", json.GetProperty("matchStatus").GetString());
        Assert.Equal("Booked", json.GetProperty("spaceStatus").GetString());
        Assert.Equal("Pending", json.GetProperty("availabilityStatus").GetString());
        Assert.Equal("FinanceStock", json.GetProperty("transactionType").GetString());
        Assert.Equal("Over", json.GetProperty("quantityState").GetString());
        Assert.Equal("ChangeFromAgentOrFarmer", json.GetProperty("reason").GetString());
    }

    [Fact]
    public void Property_names_are_camelCase()
    {
        var json = Serialise(SeededSpace());

        Assert.True(json.TryGetProperty("matchedInclDraft", out _));
        Assert.True(json.TryGetProperty("weekCommencingLabel", out _));
        Assert.False(json.TryGetProperty("MatchedInclDraft", out _));
    }

    /// <summary>
    /// The rule that keeps week banding out of the browser: every date on the wire ships with a
    /// preformatted label beside it, and every record ships the Sunday of its own week.
    /// </summary>
    [Fact]
    public void Every_date_on_a_space_ships_with_a_label_and_a_week_commencing()
    {
        var json = Serialise(SeededSpace());

        AssertDateWithLabel(json, "deliveryDate", "deliveryDateLabel");
        AssertDateWithLabel(json, "weekCommencing", "weekCommencingLabel");
    }

    [Fact]
    public void Every_date_on_an_availability_record_ships_with_a_label_and_a_week_commencing()
    {
        var json = Serialise(SeededAvailability());

        AssertDateWithLabel(json, "availableFrom", "availableFromLabel");
        AssertDateWithLabel(json, "weekCommencing", "weekCommencingLabel");
        AssertDateWithShortLabel(json, "availableFrom", "availableFromShortLabel");
    }

    [Fact]
    public void A_week_band_ships_its_Sunday_with_both_of_its_labels()
    {
        var json = Serialise(SeededBands().First());

        AssertDateWithLabel(json, "weekCommencing", "weekCommencingLabel");
        AssertDateWithShortLabel(json, "weekCommencing", "weekOfLabel");
        AssertHasAll(json, "isCurrentWeek", "isPastWeek");
    }

    /// <summary>
    /// The prose labels are the ones Phase 3's band header and carry-over card render, so a client
    /// tempted to build "Week of 16 Aug" out of an ISO string has no excuse: the string is on the wire.
    /// </summary>
    [Fact]
    public void The_prose_labels_carry_an_unpadded_day_and_a_three_letter_month()
    {
        var labels = SeededBands().Select(b => b.WeekOfLabel)
            .Append(SeededAvailability().AvailableFromShortLabel);

        Assert.All(labels, label => Assert.Matches("^[0-9]{1,2} [A-Z][a-z]{2}$", label));
    }

    [Fact]
    public void Every_date_on_a_match_ships_with_a_label()
    {
        var json = Serialise(SeededSpace()).GetProperty("matches").EnumerateArray().First();

        AssertDateWithLabel(json, "deliveryDate", "deliveryDateLabel");
        AssertDateWithLabel(json, "availableFrom", "availableFromLabel");
    }

    /// <summary>
    /// The whole point of the contract: if a card needs a number, the DTO carries it. A field missing
    /// from this list is what would force a later phase to work it out in TypeScript.
    /// </summary>
    [Fact]
    public void A_space_ships_every_computed_field_a_card_needs()
    {
        var json = Serialise(SeededSpace());

        AssertHasAll(
            json,
            "matchedInclDraft",
            "matchedExclDraft",
            "unmatched",
            "quantityState",
            "quantityStateLabel",
            "weekCommencing",
            "weekCommencingLabel",
            "canConfirm",
            "matches");
    }

    [Fact]
    public void An_availability_record_ships_every_computed_field_a_card_needs()
    {
        var json = Serialise(SeededAvailability());

        AssertHasAll(
            json,
            "status",
            "matchedInclDraft",
            "matchedExclDraft",
            "unmatched",
            "quantityState",
            "quantityStateLabel",
            "weekCommencing",
            "weekCommencingLabel",
            "availableFromShortLabel",
            "farmerId",
            "farmerName",
            "farmerMobile",
            "locationName",
            "matches");
    }

    [Fact]
    public void An_instant_keeps_its_offset_because_it_genuinely_has_one()
    {
        // CreatedAt is the one value here that is a moment rather than a business date.
        var json = Serialise(SeededSpace()).GetProperty("matches").EnumerateArray().First();
        var createdAt = json.GetProperty("createdAt").GetString();

        Assert.NotNull(createdAt);
        Assert.Contains("T", createdAt, StringComparison.Ordinal);
    }

    private static void AssertDateWithLabel(JsonElement json, string dateProperty, string labelProperty)
    {
        var date = json.GetProperty(dateProperty).GetString();
        var label = json.GetProperty(labelProperty).GetString();

        Assert.NotNull(date);
        Assert.NotNull(label);
        Assert.Matches("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", date);
        Assert.Equal(NzTime.DateLabel(DateOnly.Parse(date)), label);
    }

    private static void AssertDateWithShortLabel(
        JsonElement json,
        string dateProperty,
        string labelProperty)
    {
        var date = json.GetProperty(dateProperty).GetString();
        var label = json.GetProperty(labelProperty).GetString();

        Assert.NotNull(date);
        Assert.NotNull(label);
        Assert.Equal(NzTime.ShortDateLabel(DateOnly.Parse(date)), label);
    }

    private static void AssertHasAll(JsonElement json, params string[] properties)
    {
        var missing = properties.Where(p => !json.TryGetProperty(p, out _)).ToList();

        Assert.True(missing.Count == 0, $"The DTO is missing: {string.Join(", ", missing)}");
    }

    /// <summary>A real seeded space that has at least one live match, so the match array is populated.</summary>
    private static ProcessorSpaceDto SeededSpace() =>
        MatchingProjection.ProcessorSpaces(Set()).First(s => s.Matches.Count > 0);

    private static LivestockAvailabilityDto SeededAvailability() =>
        MatchingProjection.LivestockAvailability(Set()).First(a => a.Matches.Count > 0);

    private static IReadOnlyList<WeekBandDto> SeededBands() =>
        MatchingProjection.WeekBands(
            Set(),
            new FixedClock(new DateTimeOffset(2026, 8, 27, 12, 0, 0, TimeSpan.FromHours(12))));

    private static WorkingSet Set() => new(
        SeedFixture.Data.ProcessorSpaces,
        SeedFixture.Data.Availabilities,
        SeedFixture.Data.Matches,
        SeedFixture.Data.Locations,
        SeedFixture.Data.Farmers);
}
