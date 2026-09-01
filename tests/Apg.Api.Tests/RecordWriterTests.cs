using Apg.Api.Contracts;
using Apg.Api.Seeding;
using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Api.Tests;

/// <summary>
/// The write path behind the debug record forms, driven off the real generated seed with no database.
/// </summary>
/// <remarks>
/// Three of these carry the weight of the phase, and each is named for what it is guarding:
/// cancelling a record leaves every match intact; a processor's plants and stock classes are its own;
/// and lowering a quantity below what is already matched is <em>permitted</em>, because that is the
/// one intended route to the pink "Over-committed" state.
/// </remarks>
public class RecordWriterTests
{
    private static WorkingSet Set() => new(
        Clone(SeedFixture.Data.ProcessorSpaces),
        Clone(SeedFixture.Data.Availabilities),
        SeedFixture.Data.Matches,
        SeedFixture.Data.Locations,
        SeedFixture.Data.Farmers);

    [Fact]
    public void A_new_space_is_booked_and_keeps_what_it_was_given()
    {
        var request = new CreateProcessorSpaceRequest
        {
            Processor = "ANZCO",
            Plant = "Rangitikei",
            StockClass = "Nat Beef - Premium",
            QuantityRequired = 60,
            DeliveryDate = SeedFixture.Anchor.AddDays(9),
            DeliveryTime = "  AM kill  ",
            Notes = "   ",
        };

        Assert.Null(RecordWriter.RejectCreateSpace(request));

        var space = RecordWriter.NewSpace(request);

        Assert.Equal(ProcessorSpaceStatus.Booked, space.Status);
        Assert.Equal("ANZCO", space.Processor);
        Assert.Equal(60, space.QuantityRequired);
        Assert.Equal("AM kill", space.DeliveryTime);

        // An empty box is no value, not "" — the same rule the match writer applies.
        Assert.Null(space.Notes);
    }

    [Fact]
    public void A_plant_and_a_stock_class_have_to_belong_to_the_chosen_processor()
    {
        var wrongPlant = new CreateProcessorSpaceRequest
        {
            Processor = "ANZCO",
            // Alliance Group's plant, on an ANZCO space.
            Plant = "Lorneville",
            StockClass = "Cows",
            QuantityRequired = 40,
            DeliveryDate = SeedFixture.Anchor,
        };

        var wrongClass = wrongPlant with { Plant = "Rangitikei", StockClass = "Deer" };

        Assert.Contains(RecordWriter.PlantRequired, RecordWriter.RejectCreateSpace(wrongPlant));
        Assert.Contains(RecordWriter.StockClassRequired, RecordWriter.RejectCreateSpace(wrongClass));
    }

    [Fact]
    public void An_availability_stock_class_is_never_checked_against_a_processors_list()
    {
        // The two vocabularies do not align and there is no mapping between them. `Sire Bull` is a
        // supply class and no processor's; `Nat Beef - Ultra` is ANZCO's and no farmer's.
        var supplyClass = Create("Sire Bull");
        var demandClass = Create("Nat Beef - Ultra");

        Assert.Null(RecordWriter.RejectCreateAvailability(Set(), supplyClass));
        Assert.Equal(
            RecordWriter.StockClassRequired,
            RecordWriter.RejectCreateAvailability(Set(), demandClass));
    }

    [Fact]
    public void Quantities_below_one_are_refused_on_both_sides_and_past_dates_are_not()
    {
        var space = new CreateProcessorSpaceRequest
        {
            Processor = "SFF",
            Plant = "Finegand",
            StockClass = "Lamb",
            QuantityRequired = 0,
            // Deliberately in the past: APG enter records after the fact (requirement 6.3).
            DeliveryDate = SeedFixture.Anchor.AddDays(-30),
        };

        Assert.Equal(RecordWriter.QuantityBelowOne, RecordWriter.RejectCreateSpace(space));
        Assert.Null(RecordWriter.RejectCreateSpace(space with { QuantityRequired = 1 }));

        var availability = Create("Lamb") with { QuantityAvailable = 0 };

        Assert.Equal(
            RecordWriter.QuantityBelowOne,
            RecordWriter.RejectCreateAvailability(Set(), availability));
    }

    [Fact]
    public void A_missing_date_location_or_transaction_type_is_refused_by_name()
    {
        var set = Set();

        Assert.Equal(
            RecordWriter.DeliveryDateRequired,
            RecordWriter.RejectCreateSpace(new CreateProcessorSpaceRequest
            {
                Processor = "ANZCO",
                Plant = "Kokiri",
                StockClass = "Lamb",
                QuantityRequired = 300,
                DeliveryDate = null,
            }));

        Assert.Equal(
            RecordWriter.AvailableFromRequired,
            RecordWriter.RejectCreateAvailability(set, Create("Lamb") with { AvailableFrom = null }));

        Assert.Equal(
            RecordWriter.LocationRequired,
            RecordWriter.RejectCreateAvailability(set, Create("Lamb") with { LocationId = 0 }));

        Assert.Equal(
            RecordWriter.NoSuchLocation,
            RecordWriter.RejectCreateAvailability(set, Create("Lamb") with { LocationId = 999_999 }));

        Assert.Equal(
            RecordWriter.TransactionTypeRequired,
            RecordWriter.RejectCreateAvailability(set, Create("Lamb") with { TransactionType = null }));
    }

    [Fact]
    public void An_edit_checks_the_plant_against_the_spaces_own_processor()
    {
        var set = Set();
        var space = set.Spaces.First(s => s.Processor == "ANZCO");

        var request = new UpdateProcessorSpaceRequest
        {
            Plant = "Lorneville",
            QuantityRequired = space.QuantityRequired,
            DeliveryDate = space.DeliveryDate,
        };

        Assert.Contains(RecordWriter.PlantRequired, RecordWriter.RejectUpdateSpace(space, request));
        Assert.Null(RecordWriter.RejectUpdateSpace(space, request with { Plant = "Eltham" }));

        // The processor and the stock class are not on the request at all (requirement 4.2), so an
        // edit cannot re-point a booked slot at another meatworks or another class.
        Assert.DoesNotContain(
            "Processor",
            typeof(UpdateProcessorSpaceRequest).GetProperties().Select(p => p.Name));
        Assert.DoesNotContain(
            "StockClass",
            typeof(UpdateProcessorSpaceRequest).GetProperties().Select(p => p.Name));
    }

    /// <summary>
    /// The rule this phase exists to prove, and the one most likely to be "helpfully" broken.
    /// </summary>
    /// <remarks>
    /// Cancelling a record does not cascade: its matches stay live, on their own cards, and have to be
    /// cancelled separately. That is what lets APG arrange alternatives before anyone is notified. Note
    /// the trap the assertions are written around — the counterparty availability record's
    /// <em>derived</em> status may legitimately be anything, but its <em>stored</em> status, and every
    /// field of every match, must not move.
    /// </remarks>
    [Fact]
    public void Cancelling_a_record_leaves_every_one_of_its_matches_intact()
    {
        var set = Set();
        var space = set.Spaces.First(s =>
            set.Matches.Any(m => m.ProcessorSpaceId == s.Id && MatchQuantities.IsLive(m)));

        var before = set.Matches
            .Where(m => m.ProcessorSpaceId == space.Id)
            .Select(m => (m.Id, m.Status, m.QuantityMatched, m.LivestockAvailabilityId))
            .ToList();

        var storedAvailabilityStatuses = set.Availabilities.ToDictionary(a => a.Id, a => a.Status);

        Assert.Null(RecordWriter.RejectCancelSpace(space));
        RecordCancellation.CancelProcessorSpace(space);

        var after = set.Matches
            .Where(m => m.ProcessorSpaceId == space.Id)
            .Select(m => (m.Id, m.Status, m.QuantityMatched, m.LivestockAvailabilityId))
            .ToList();

        Assert.Equal(before, after);
        Assert.NotEmpty(before);

        // Not one stored counterparty status moved either.
        Assert.All(set.Availabilities, a =>
            Assert.Equal(storedAvailabilityStatuses[a.Id], a.Status));

        // And the cancelled record still lists them, so the card that opens it shows the matches it
        // has just orphaned rather than an empty table.
        var projected = MatchingProjection.SpaceById(set, space.Id);

        Assert.NotNull(projected);
        Assert.Equal(ProcessorSpaceStatus.Cancelled, projected.Status);
        Assert.Equal(
            before.Where(m => m.Status != MatchStatus.Cancelled).Select(m => m.Id).Order(),
            projected.Matches.Select(m => m.Id).Order());

        // The far side lists them too, now carrying the cancelled parent's status — which is what the
        // counterparty column flags. Cancelling never cascades, so this pairing is a normal state.
        foreach (var match in before.Where(m => m.Status != MatchStatus.Cancelled))
        {
            var partner = MatchingProjection.AvailabilityById(set, match.LivestockAvailabilityId);

            Assert.NotNull(partner);
            var row = Assert.Single(partner.Matches, m => m.Id == match.Id);
            Assert.Equal(ProcessorSpaceStatus.Cancelled, row.SpaceStatus);
        }
    }

    [Fact]
    public void Cancelling_an_availability_record_likewise_leaves_its_matches_alone()
    {
        var set = Set();
        var record = set.Availabilities.First(a =>
            set.Matches.Any(m => m.LivestockAvailabilityId == a.Id && MatchQuantities.IsLive(m)));

        var before = set.Matches
            .Where(m => m.LivestockAvailabilityId == record.Id)
            .Select(m => (m.Id, m.Status, m.QuantityMatched))
            .ToList();

        var storedSpaceStatuses = set.Spaces.ToDictionary(s => s.Id, s => s.Status);

        Assert.Null(RecordWriter.RejectCancelAvailability(record));
        RecordCancellation.CancelAvailability(record);

        Assert.Equal(
            before,
            set.Matches
                .Where(m => m.LivestockAvailabilityId == record.Id)
                .Select(m => (m.Id, m.Status, m.QuantityMatched))
                .ToList());

        Assert.All(set.Spaces, s => Assert.Equal(storedSpaceStatuses[s.Id], s.Status));

        // Cancelling twice is refused rather than silently repeated.
        Assert.Equal(
            RecordCancellation.AvailabilityAlreadyCancelled,
            RecordWriter.RejectCancelAvailability(record));
    }

    /// <summary>
    /// The one intended route to the pink "Over-committed" state (requirements 4.4 and 4.5).
    /// </summary>
    /// <remarks>
    /// Supply is hard-capped at the point of the drag, so no amount of matching can over-commit a
    /// record. Reducing the quantity underneath the matches that already exist can, and must be allowed
    /// to: the spec contemplates a farmer selling stock elsewhere. The warning is the form's; the
    /// server's job is not to refuse it.
    /// </remarks>
    [Fact]
    public void Reducing_a_quantity_below_what_is_matched_is_allowed_and_produces_the_pink_state()
    {
        var set = Set();
        // Built from this clone, not from the shared fixture: this suite cancels records, and a ledger
        // read from the pristine seed would go on counting a match whose space it had just cancelled.
        var cancelled = CancelledRecords.In(set.Spaces, set.Availabilities);
        var record = set.Availabilities.First(a =>
            MatchQuantities.ForAvailability(a, set.Matches, cancelled).MatchedInclDraft > 1);

        var matched = MatchQuantities.ForAvailability(record, set.Matches, cancelled).MatchedInclDraft;
        var before = set.Matches
            .Where(m => m.LivestockAvailabilityId == record.Id)
            .Select(m => (m.Id, m.Status, m.QuantityMatched))
            .ToList();

        var request = new UpdateLivestockAvailabilityRequest
        {
            StockClass = record.StockClass,
            QuantityAvailable = matched - 1,
            LocationId = record.LocationId,
            AvailableFrom = record.AvailableFrom,
            TransactionType = record.TransactionType,
        };

        Assert.Null(RecordWriter.RejectUpdateAvailability(set, record, request));

        RecordWriter.ApplyAvailability(record, request);

        var projected = MatchingProjection.AvailabilityById(set, record.Id);

        Assert.NotNull(projected);
        Assert.Equal(QuantityState.Over, projected.QuantityState);
        Assert.Equal("Over-committed", projected.QuantityStateLabel);
        Assert.True(projected.Unmatched < 0);

        // The matches are untouched by it: the record is over-committed, not re-cut.
        Assert.Equal(
            before,
            set.Matches
                .Where(m => m.LivestockAvailabilityId == record.Id)
                .Select(m => (m.Id, m.Status, m.QuantityMatched))
                .ToList());
    }

    [Fact]
    public void Raising_a_space_quantity_leaves_it_under_filled_rather_than_refusing()
    {
        var set = Set();
        var cancelled = CancelledRecords.In(set.Spaces, set.Availabilities);
        var space = set.Spaces.First(s =>
            MatchQuantities.ForSpace(s, set.Matches, cancelled).MatchedInclDraft > 0);

        var request = new UpdateProcessorSpaceRequest
        {
            Plant = space.Plant,
            QuantityRequired = MatchQuantities.ForSpace(space, set.Matches, cancelled).MatchedInclDraft + 50,
            DeliveryDate = space.DeliveryDate,
            DeliveryTime = space.DeliveryTime,
            Notes = space.Notes,
        };

        Assert.Null(RecordWriter.RejectUpdateSpace(space, request));
        RecordWriter.ApplySpace(space, request);

        var projected = MatchingProjection.SpaceById(set, space.Id);

        Assert.NotNull(projected);
        Assert.Equal(QuantityState.Under, projected.QuantityState);
        Assert.Equal(50, projected.Unmatched);
    }

    /// <summary>
    /// A record dated outside the loaded calendar has to come back with a calendar that contains it,
    /// or the client would place it nowhere and it would vanish off the screen.
    /// </summary>
    [Fact]
    public void The_week_calendar_grows_to_hold_a_record_created_beyond_it()
    {
        var set = Set();
        var clock = new FixedClock(new DateTimeOffset(2026, 8, 27, 12, 0, 0, TimeSpan.FromHours(12)));

        var before = MatchingProjection.WeekBands(set, clock);
        var far = SeedFixture.Anchor.AddDays(200);

        Assert.DoesNotContain(before, band => band.WeekCommencing == Apg.Domain.Time.NzTime.WeekCommencing(far));

        var grown = new WorkingSet(
            [.. set.Spaces, RecordWriter.NewSpace(new CreateProcessorSpaceRequest
            {
                Processor = "ANZCO",
                Plant = "Kokiri",
                StockClass = "Lamb",
                QuantityRequired = 400,
                DeliveryDate = far,
            })],
            set.Availabilities,
            set.Matches,
            set.Locations,
            set.Farmers);

        var after = MatchingProjection.WeekBands(grown, clock);

        Assert.Contains(after, band => band.WeekCommencing == Apg.Domain.Time.NzTime.WeekCommencing(far));

        // Still gapless and still ordered — the calendar grew, it did not sprout a hole.
        Assert.Equal(after.OrderBy(band => band.WeekCommencing).Select(b => b.WeekCommencing), after.Select(b => b.WeekCommencing));
        Assert.All(after, band => Assert.Equal(DayOfWeek.Sunday, band.WeekCommencing.DayOfWeek));
    }

    [Fact]
    public void The_reference_data_is_the_seed_configs_lists_and_keeps_the_two_vocabularies_apart()
    {
        var data = RecordWriter.ReferenceData();

        Assert.Equal(SeedConfig.Processors, data.Processors.Select(p => p.Name));
        Assert.Equal(SeedConfig.AvailabilityStockClasses, data.AvailabilityStockClasses);
        Assert.Equal(SeedConfig.TransactionTypes, data.TransactionTypes);

        foreach (var processor in data.Processors)
        {
            var expectedPlants = SeedConfig.PlantsByProcessor.Single(e => e.Processor == processor.Name).Plants;
            var expectedClasses = SeedConfig.ProcessorSpaceStockClasses
                .Single(e => e.Processor == processor.Name).StockClasses;

            Assert.Equal(expectedPlants, processor.Plants);
            Assert.Equal(expectedClasses, processor.StockClasses);
        }

        // ANZCO's classes are not Alliance Group's, which is the whole reason the picker narrows.
        var anzco = data.Processors.Single(p => p.Name == "ANZCO").StockClasses;
        var alliance = data.Processors.Single(p => p.Name == "Alliance Group").StockClasses;

        Assert.Contains("Nat Beef - Ultra", anzco);
        Assert.DoesNotContain("Nat Beef - Ultra", alliance);
        Assert.Contains("Deer", alliance);
        Assert.DoesNotContain("Deer", anzco);
    }

    [Fact]
    public void Every_location_offers_the_one_farmer_it_belongs_to()
    {
        var locations = RecordWriter.Locations(Set());

        Assert.Equal(SeedFixture.Data.Locations.Count, locations.Count);
        Assert.All(locations, location => Assert.False(string.IsNullOrWhiteSpace(location.FarmerName)));

        // Ordered by name, because the form types ahead over ~300 of them.
        Assert.Equal(
            locations.Select(l => l.Name).OrderBy(name => name, StringComparer.OrdinalIgnoreCase),
            locations.Select(l => l.Name));
    }

    private static CreateLivestockAvailabilityRequest Create(string stockClass) =>
        new()
        {
            StockClass = stockClass,
            QuantityAvailable = 120,
            LocationId = SeedFixture.Data.Locations[0].Id,
            AvailableFrom = SeedFixture.Anchor,
            TransactionType = TransactionType.GrazingStock,
        };

    /// <summary>
    /// The seed fixture is one shared, lazily generated object graph, so a test that mutates a record
    /// would change what every later test sees. These clones are what let this class cancel and edit.
    /// </summary>
    private static IReadOnlyList<ProcessorSpace> Clone(IReadOnlyList<ProcessorSpace> spaces) =>
        spaces.Select(s => new ProcessorSpace
        {
            Id = s.Id,
            Processor = s.Processor,
            Plant = s.Plant,
            StockClass = s.StockClass,
            QuantityRequired = s.QuantityRequired,
            DeliveryDate = s.DeliveryDate,
            DeliveryTime = s.DeliveryTime,
            Notes = s.Notes,
            Status = s.Status,
        }).ToList();

    /// <inheritdoc cref="Clone(IReadOnlyList{ProcessorSpace})"/>
    private static IReadOnlyList<LivestockAvailability> Clone(IReadOnlyList<LivestockAvailability> records) =>
        records.Select(a => new LivestockAvailability
        {
            Id = a.Id,
            StockClass = a.StockClass,
            QuantityAvailable = a.QuantityAvailable,
            LocationId = a.LocationId,
            AvailableFrom = a.AvailableFrom,
            AvailabilityDetails = a.AvailabilityDetails,
            TransactionType = a.TransactionType,
            Notes = a.Notes,
            Status = a.Status,
        }).ToList();
}
