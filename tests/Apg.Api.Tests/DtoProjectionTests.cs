using Apg.Api.Contracts;
using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Api.Tests;

/// <summary>
/// The DTO contract Phases 3 to 8 code against. A field missing here is what forces a later phase to
/// recompute a domain value in TypeScript, so these tests assert presence as much as correctness.
/// </summary>
public class DtoProjectionTests
{
    /// <summary>Thursday of the pinned week — Sunday 23 August 2026.</summary>
    private static readonly DateOnly Sunday = new(2026, 8, 23);

    /// <summary>
    /// One space needing 100, one availability offering 90, and three matches between them:
    /// 40 confirmed, 30 drafted, 25 cancelled. Every figure on both DTOs can be checked by hand
    /// against those numbers.
    /// </summary>
    private static WorkingSet Fixture(
        ProcessorSpaceStatus spaceStatus = ProcessorSpaceStatus.Booked,
        LivestockAvailabilityStatus availabilityStatus = LivestockAvailabilityStatus.Booked) =>
        new(
            [
                new ProcessorSpace
                {
                    Id = 1,
                    Processor = "ANZCO",
                    Plant = "Rangitikei",
                    StockClass = "Nat Beef - Premium",
                    QuantityRequired = 100,
                    DeliveryDate = Sunday.AddDays(4), // Thursday 27 August 2026
                    DeliveryTime = "Morning",
                    Notes = "Yard 3",
                    Status = spaceStatus,
                },
            ],
            [
                new LivestockAvailability
                {
                    Id = 1,
                    StockClass = "Prime",
                    QuantityAvailable = 90,
                    LocationId = 7,
                    AvailableFrom = Sunday.AddDays(1), // Monday 24 August 2026
                    AvailabilityDetails = "Ready from the front paddock",
                    TransactionType = TransactionType.FinanceStock,
                    Notes = "Call first",
                    Status = availabilityStatus,
                },
            ],
            [
                Match(1, 40, MatchStatus.Confirmed),
                Match(2, 30, MatchStatus.Drafted),
                Match(3, 25, MatchStatus.Cancelled),
            ],
            [new Location { Id = 7, Name = "Alford Farms HQ" }],
            [new Farmer { Id = 42, LocationId = 7, Name = "Mark Dale", Mobile = "021 555 0100" }]);

    private static Match Match(int id, int quantity, MatchStatus status) => new()
    {
        Id = id,
        ProcessorSpaceId = 1,
        LivestockAvailabilityId = 1,
        QuantityMatched = quantity,
        PricePerKg = 6.45m,
        TransportCompany = "Rangitane Transport",
        Status = status,
        CancellationReason = status == MatchStatus.Cancelled
            ? MatchCancellationReason.ChangeFromProcessor
            : null,
        CreatedAt = new DateTimeOffset(2026, 8, 20, 9, 0, 0, TimeSpan.FromHours(12)),
    };

    private static ProcessorSpaceDto Space(WorkingSet? set = null) =>
        MatchingProjection.ProcessorSpaces(set ?? Fixture()).Single();

    private static LivestockAvailabilityDto Availability(WorkingSet? set = null) =>
        MatchingProjection.LivestockAvailability(set ?? Fixture()).Single();

    // ---------------------------------------------------------------------------------------------
    // Processor Space
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public void A_space_carries_its_stored_fields()
    {
        var dto = Space();

        Assert.Equal(1, dto.Id);
        Assert.Equal("ANZCO", dto.Processor);
        Assert.Equal("Rangitikei", dto.Plant);
        Assert.Equal("Nat Beef - Premium", dto.StockClass);
        Assert.Equal(100, dto.QuantityRequired);
        Assert.Equal("Morning", dto.DeliveryTime);
        Assert.Equal("Yard 3", dto.Notes);
        Assert.Equal(ProcessorSpaceStatus.Booked, dto.Status);
    }

    [Fact]
    public void A_space_carries_both_matched_sums_and_the_unmatched_figure()
    {
        var dto = Space();

        // 40 confirmed + 30 drafted; the cancelled 25 counts towards neither.
        Assert.Equal(70, dto.MatchedInclDraft);
        Assert.Equal(40, dto.MatchedExclDraft);
        Assert.Equal(30, dto.Unmatched);
        Assert.Equal(QuantityState.Under, dto.QuantityState);
        Assert.Equal("Under-filled", dto.QuantityStateLabel);
    }

    [Fact]
    public void A_space_carries_its_delivery_date_as_both_an_ISO_value_and_a_label()
    {
        var dto = Space();

        Assert.Equal(new DateOnly(2026, 8, 27), dto.DeliveryDate);
        Assert.Equal("27-08-26", dto.DeliveryDateLabel);
    }

    [Fact]
    public void A_space_carries_the_week_its_delivery_date_falls_in()
    {
        var dto = Space();

        Assert.Equal(Sunday, dto.WeekCommencing);
        Assert.Equal(DayOfWeek.Sunday, dto.WeekCommencing.DayOfWeek);
        Assert.Equal("23-08-26", dto.WeekCommencingLabel);
    }

    [Fact]
    public void A_space_with_a_draft_outstanding_reports_that_it_cannot_be_confirmed()
    {
        Assert.False(Space().CanConfirm);
    }

    [Fact]
    public void A_space_whose_live_matches_are_all_confirmed_reports_that_it_can_be()
    {
        var set = Fixture() with
        {
            Matches = [Match(1, 40, MatchStatus.Confirmed), Match(3, 25, MatchStatus.Cancelled)],
        };

        Assert.True(Space(set).CanConfirm);
    }

    // ---------------------------------------------------------------------------------------------
    // Livestock Availability
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public void An_availability_record_carries_its_stored_fields()
    {
        var dto = Availability();

        Assert.Equal(1, dto.Id);
        Assert.Equal("Prime", dto.StockClass);
        Assert.Equal(90, dto.QuantityAvailable);
        Assert.Equal(7, dto.LocationId);
        Assert.Equal("Ready from the front paddock", dto.AvailabilityDetails);
        Assert.Equal(TransactionType.FinanceStock, dto.TransactionType);
        Assert.Equal("Call first", dto.Notes);
    }

    /// <summary>
    /// Resolved question 10: each location belongs to exactly one farmer, so picking the location
    /// determines the farmer and their contact details. The card shows a name, not an id.
    /// </summary>
    [Fact]
    public void An_availability_record_carries_the_farmer_resolved_from_its_location()
    {
        var dto = Availability();

        Assert.Equal("Alford Farms HQ", dto.LocationName);
        Assert.Equal(42, dto.FarmerId);
        Assert.Equal("Mark Dale", dto.FarmerName);
        Assert.Equal("021 555 0100", dto.FarmerMobile);
    }

    [Fact]
    public void An_availability_record_carries_both_matched_sums_and_the_unmatched_figure()
    {
        var dto = Availability();

        Assert.Equal(70, dto.MatchedInclDraft);
        Assert.Equal(40, dto.MatchedExclDraft);
        Assert.Equal(20, dto.Unmatched);
        Assert.Equal(QuantityState.Under, dto.QuantityState);
        Assert.Equal("Under-committed", dto.QuantityStateLabel);
    }

    [Fact]
    public void An_availability_record_carries_its_dates_as_both_ISO_values_and_labels()
    {
        var dto = Availability();

        Assert.Equal(new DateOnly(2026, 8, 24), dto.AvailableFrom);
        Assert.Equal("24-08-26", dto.AvailableFromLabel);
        Assert.Equal(Sunday, dto.WeekCommencing);
        Assert.Equal("23-08-26", dto.WeekCommencingLabel);
    }

    /// <summary>
    /// The status on the wire is the <em>derived</em> one, not the stored column. Here the record is
    /// stored as Booked but has live matches, so it derives as Pending.
    /// </summary>
    [Fact]
    public void An_availability_records_status_is_derived_rather_than_read_from_storage()
    {
        var dto = Availability();

        Assert.Equal(LivestockAvailabilityStatus.Pending, dto.Status);
    }

    [Fact]
    public void An_explicitly_cancelled_availability_record_ships_as_Cancelled()
    {
        var set = Fixture(availabilityStatus: LivestockAvailabilityStatus.Cancelled);

        Assert.Equal(LivestockAvailabilityStatus.Cancelled, Availability(set).Status);
    }

    // ---------------------------------------------------------------------------------------------
    // Matches
    // ---------------------------------------------------------------------------------------------

    /// <summary>
    /// Resolved question 4. Note this is a <em>different</em> thing from a cancelled match being
    /// excluded from the two sums: it is absent from the collection <b>and</b> counts towards
    /// neither sum, and conflating the two is how one of them gets got wrong.
    /// </summary>
    [Fact]
    public void Cancelled_matches_are_excluded_from_both_DTOs_match_collections()
    {
        Assert.Equal([1, 2], Space().Matches.Select(m => m.Id));
        Assert.Equal([1, 2], Availability().Matches.Select(m => m.Id));
    }

    [Fact]
    public void The_sums_are_taken_over_the_whole_match_set_not_over_the_shipped_collection()
    {
        var dto = Space();

        // Two matches ship; three exist. The sums must reflect the third's exclusion by status, not
        // by its absence from the list.
        Assert.Equal(2, dto.Matches.Count);
        Assert.Equal(70, dto.MatchedInclDraft);
    }

    [Fact]
    public void A_match_carries_its_own_fields()
    {
        var match = Space().Matches.Single(m => m.Id == 1);

        Assert.Equal(40, match.QuantityMatched);
        Assert.Equal(6.45m, match.PricePerKg);
        Assert.Equal("Rangitane Transport", match.TransportCompany);
        Assert.Equal(MatchStatus.Confirmed, match.Status);
        Assert.Null(match.CancellationReason);
        Assert.Equal(new DateTimeOffset(2026, 8, 20, 9, 0, 0, TimeSpan.FromHours(12)), match.CreatedAt);
    }

    /// <summary>
    /// One MatchDto carries both parents, so the same object renders inside either card without a
    /// lookup — including both stock classes, since the two vocabularies not lining up is the point
    /// of the screen.
    /// </summary>
    [Fact]
    public void A_match_carries_enough_of_both_parents_to_render_inside_either_card()
    {
        var match = Availability().Matches.Single(m => m.Id == 1);

        // The demand side, for rendering inside an availability record's expanded card.
        Assert.Equal(1, match.ProcessorSpaceId);
        Assert.Equal("ANZCO", match.Processor);
        Assert.Equal("Rangitikei", match.Plant);
        Assert.Equal("Nat Beef - Premium", match.SpaceStockClass);
        Assert.Equal(new DateOnly(2026, 8, 27), match.DeliveryDate);
        Assert.Equal("27-08-26", match.DeliveryDateLabel);
        Assert.Equal("Morning", match.DeliveryTime);

        // The supply side, for rendering inside a space's expanded card.
        Assert.Equal(1, match.LivestockAvailabilityId);
        Assert.Equal("Mark Dale", match.FarmerName);
        Assert.Equal("Alford Farms HQ", match.LocationName);
        Assert.Equal("Prime", match.AvailabilityStockClass);
        Assert.Equal("Ready from the front paddock", match.AvailabilityDetails);
        Assert.Equal(new DateOnly(2026, 8, 24), match.AvailableFrom);
        Assert.Equal("24-08-26", match.AvailableFromLabel);
    }

    // ---------------------------------------------------------------------------------------------
    // Ordering and the wider set
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public void Both_endpoints_return_their_records_soonest_first()
    {
        var set = Fixture();
        var spaces = new List<ProcessorSpace>
        {
            new()
            {
                Id = 2,
                Processor = "SFF",
                Plant = "Finegand",
                StockClass = "Lamb",
                QuantityRequired = 50,
                DeliveryDate = Sunday.AddDays(1),
            },
            set.Spaces[0],
        };

        var availabilities = new List<LivestockAvailability>
        {
            new()
            {
                Id = 2,
                StockClass = "Lamb",
                QuantityAvailable = 30,
                LocationId = 7,
                AvailableFrom = Sunday.AddDays(-3),
                TransactionType = TransactionType.Other,
            },
            set.Availabilities[0],
        };

        var reordered = set with { Spaces = spaces, Availabilities = availabilities };

        Assert.Equal([2, 1], MatchingProjection.ProcessorSpaces(reordered).Select(s => s.Id));
        Assert.Equal([2, 1], MatchingProjection.LivestockAvailability(reordered).Select(a => a.Id));
    }

    [Fact]
    public void A_record_with_no_matches_still_carries_every_computed_field()
    {
        var set = Fixture() with { Matches = [] };
        var space = Space(set);
        var availability = Availability(set);

        Assert.Empty(space.Matches);
        Assert.Equal(0, space.MatchedInclDraft);
        Assert.Equal(100, space.Unmatched);
        Assert.False(space.CanConfirm);
        Assert.Equal("23-08-26", space.WeekCommencingLabel);

        Assert.Empty(availability.Matches);
        Assert.Equal(90, availability.Unmatched);
        Assert.Equal(LivestockAvailabilityStatus.Booked, availability.Status);
    }

    [Fact]
    public void An_availability_record_whose_location_has_no_farmer_still_projects()
    {
        // Defensive: the seed guarantees a farmer per location, but a missing one must leave a blank
        // on the card rather than take the endpoint down.
        var set = Fixture() with { Farmers = [] };
        var dto = Availability(set);

        Assert.Null(dto.FarmerId);
        Assert.Null(dto.FarmerName);
        Assert.Equal("Alford Farms HQ", dto.LocationName);
    }

    // ---------------------------------------------------------------------------------------------
    // Against the real seed
    // ---------------------------------------------------------------------------------------------

    [Fact]
    public void Every_seeded_record_projects_with_its_computed_fields_agreeing_with_the_domain()
    {
        var set = new WorkingSet(
            SeedFixture.Data.ProcessorSpaces,
            SeedFixture.Data.Availabilities,
            SeedFixture.Data.Matches,
            SeedFixture.Data.Locations,
            SeedFixture.Data.Farmers);

        var spaces = MatchingProjection.ProcessorSpaces(set);
        var availabilities = MatchingProjection.LivestockAvailability(set);

        Assert.Equal(SeedFixture.Data.ProcessorSpaces.Count, spaces.Count);
        Assert.Equal(SeedFixture.Data.Availabilities.Count, availabilities.Count);

        foreach (var dto in spaces)
        {
            var space = SeedFixture.Data.ProcessorSpaces.Single(s => s.Id == dto.Id);
            var tally = MatchQuantities.ForSpace(space, SeedFixture.Data.Matches);

            Assert.Equal(tally.MatchedInclDraft, dto.MatchedInclDraft);
            Assert.Equal(tally.MatchedExclDraft, dto.MatchedExclDraft);
            Assert.Equal(tally.Unmatched, dto.Unmatched);
            Assert.Equal(tally.State, dto.QuantityState);
            Assert.Equal(DayOfWeek.Sunday, dto.WeekCommencing.DayOfWeek);
            Assert.DoesNotContain(dto.Matches, m => m.Status == MatchStatus.Cancelled);
        }

        foreach (var dto in availabilities)
        {
            var availability = SeedFixture.Data.Availabilities.Single(a => a.Id == dto.Id);
            var tally = MatchQuantities.ForAvailability(availability, SeedFixture.Data.Matches);

            Assert.Equal(tally.Unmatched, dto.Unmatched);
            Assert.Equal(
                AvailabilityStatus.Derive(availability, SeedFixture.Data.Matches),
                dto.Status);
            Assert.Equal(DayOfWeek.Sunday, dto.WeekCommencing.DayOfWeek);
            Assert.NotNull(dto.FarmerName);
        }
    }
}
