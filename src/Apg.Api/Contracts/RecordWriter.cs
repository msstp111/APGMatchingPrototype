using Apg.Api.Seeding;
using Apg.Domain.Entities;
using Apg.Domain.Matching;
using Apg.Domain.Time;

namespace Apg.Api.Contracts;

/// <summary>
/// The rules the debug record forms have to satisfy, expressed over a loaded working set.
/// </summary>
/// <remarks>
/// <para>
/// The sibling of <see cref="MatchWriter"/>, and deliberately the same shape: <b>pure and static over
/// a <see cref="WorkingSet"/></b> rather than a service over the <c>DbContext</c>, so the tests drive
/// it off the real generated seed with no database at all. The endpoint loads, calls, saves.
/// </para>
/// <para>
/// <b>Every rule here is about the shape of a request, never about quantities against matches.</b>
/// Reducing a record's quantity below what is already matched is legal and is the one intended route
/// to the pink "Over-committed" state (Phase 7, 4.4 and 4.5) — the form warns and the operator decides.
/// Nothing in this file may grow a clause that blocks it.
/// </para>
/// <para>
/// The vocabularies come from <see cref="SeedConfig"/>, which the roadmap designates as the single
/// home for every invented list (resolved question 11). Validating against them here is the server-side
/// half of the picker rule: a processor's plants and its stock classes are its own, and a crafted
/// request must not be able to do what the form prevents.
/// </para>
/// </remarks>
public static class RecordWriter
{
    public const string NoSuchAvailability = "There is no such livestock availability record";

    public const string ProcessorRequired = "Choose a processor";

    public const string PlantRequired = "Choose a plant";

    public const string StockClassRequired = "Choose a stock class";

    public const string LocationRequired = "Choose a location";

    public const string TransactionTypeRequired = "Choose a transaction type";

    public const string DeliveryDateRequired = "Choose a delivery date";

    public const string AvailableFromRequired = "Choose an available-from date";

    public const string QuantityBelowOne = "A quantity must be at least 1 head";

    public const string NoSuchLocation = "There is no such location";

    /// <summary>
    /// How far past the last record the space form's week picker reaches. A quarter: APG book slots a
    /// season ahead, and a picker that stops at the last record already entered could never be the one
    /// that enters the first record of a new week.
    /// </summary>
    public const int WeeksAhead = 13;

    /// <summary>
    /// How far before the earliest record it reaches. Small on purpose — the backlog is what the
    /// records themselves supply, and this is only the cushion for entering one a little earlier still.
    /// </summary>
    public const int WeeksBehind = 2;

    /// <summary>
    /// The vocabularies the two forms pick from, straight off <see cref="SeedConfig"/>, plus the weeks
    /// the space form's delivery-date pair may pick from.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The vocabularies are deliberately not derived from the loaded records the way the filter row's
    /// options are. A stock class no space happens to use today is still a valid choice for a new one,
    /// and a form that offered only what already exists could never introduce anything.
    /// </para>
    /// <para>
    /// <b>The weeks are the exception, and have to be.</b> They are a calendar, not a vocabulary, and
    /// the picker has to be able to express the date of every record it might be opened on: a week
    /// missing from the list is an <c>Edit</c> that opens with an empty week control and cannot be
    /// saved until the operator moves the delivery date. So the span covers every loaded record and the
    /// current week both, exactly as <see cref="MatchingProjection.WeekBands"/> does, and then reaches
    /// <see cref="WeeksAhead"/> weeks past the end of it — see <see cref="SelectableWeeks"/>.
    /// </para>
    /// </remarks>
    public static ReferenceDataDto ReferenceData(WorkingSet set, TimeProvider clock) =>
        new()
        {
            Processors = SeedConfig.Processors
                .Select(processor => new ProcessorOptionDto
                {
                    Name = processor,
                    Plants = PlantsOf(processor),
                    StockClasses = StockClassesOf(processor),
                })
                .ToList(),
            AvailabilityStockClasses = SeedConfig.AvailabilityStockClasses.ToList(),
            TransactionTypes = SeedConfig.TransactionTypes.ToList(),
            Weeks = SelectableWeeks(set, clock),
        };

    /// <summary>
    /// Every week the space form may book into, each carrying its own seven days.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The span is <see cref="WeeksBehind"/> weeks before the earliest date anything holds to
    /// <see cref="WeeksAhead"/> weeks after the latest, with today's week folded in so the range is
    /// never empty and never entirely historic. Both ends look at the availability records as well as
    /// the spaces: the two columns are drawn from one calendar, and a form whose reach stopped at the
    /// demand side would refuse a delivery date the supply column is already showing stock for.
    /// </para>
    /// <para>
    /// The seven days come from <see cref="NzTime.DaysOfWeek"/> rather than from a loop here, because
    /// the Sunday start is a week rule and this file keeps none of those.
    /// </para>
    /// </remarks>
    public static IReadOnlyList<WeekOptionDto> SelectableWeeks(WorkingSet set, TimeProvider clock)
    {
        var currentWeek = NzTime.CurrentWeekCommencing(clock);

        var dates = set.Spaces.Select(space => space.DeliveryDate)
            .Concat(set.Availabilities.Select(availability => availability.AvailableFrom))
            .Append(currentWeek)
            .ToList();

        var first = NzTime.PlusWeeks(dates.Min(), -WeeksBehind);
        var last = NzTime.PlusWeeks(dates.Max(), WeeksAhead);

        return NzTime.WeeksFrom(first, last)
            .Select(week => new WeekOptionDto
            {
                WeekCommencing = week,
                WeekCommencingLabel = NzTime.DateLabel(week),
                IsCurrentWeek = week == currentWeek,
                Days = NzTime.DaysOfWeek(week)
                    .Select(day => new DayOptionDto
                    {
                        Date = day,
                        WeekdayLabel = NzTime.WeekdayLabel(day),
                        DateLabel = NzTime.DateLabel(day),
                    })
                    .ToList(),
            })
            .ToList();
    }

    /// <summary>
    /// Every location, with the farmer it belongs to, ordered by name for the type-ahead.
    /// </summary>
    /// <remarks>
    /// One farmer per location (resolved question 10), so choosing the location settles the farmer and
    /// the form can show back who was picked. There are ~300 of them, which is why the control types
    /// ahead rather than opening a menu of all of them.
    /// </remarks>
    public static IReadOnlyList<LocationOptionDto> Locations(WorkingSet set)
    {
        var farmers = set.Farmers
            .GroupBy(farmer => farmer.LocationId)
            .ToDictionary(group => group.Key, group => group.First());

        return set.Locations
            .OrderBy(location => location.Name, StringComparer.OrdinalIgnoreCase)
            .Select(location => new LocationOptionDto
            {
                Id = location.Id,
                Name = location.Name,
                FarmerName = farmers.GetValueOrDefault(location.Id)?.Name,
                FarmerMobile = farmers.GetValueOrDefault(location.Id)?.Mobile,
            })
            .ToList();
    }

    /// <summary>Why a new Processor Space may not be created, or null when it may.</summary>
    public static string? RejectCreateSpace(CreateProcessorSpaceRequest request)
    {
        var processor = Trimmed(request.Processor);

        if (processor is null || !SeedConfig.Processors.Contains(processor))
        {
            return ProcessorRequired;
        }

        return RejectPlant(processor, request.Plant)
            ?? RejectStockClass(processor, request.StockClass)
            ?? RejectQuantity(request.QuantityRequired)
            ?? (request.DeliveryDate is null ? DeliveryDateRequired : null);
    }

    /// <summary>The space a validated create request becomes: always <c>Booked</c> (requirement 2.8).</summary>
    public static ProcessorSpace NewSpace(CreateProcessorSpaceRequest request) =>
        new()
        {
            Processor = Trimmed(request.Processor)!,
            Plant = Trimmed(request.Plant)!,
            StockClass = Trimmed(request.StockClass)!,
            QuantityRequired = request.QuantityRequired,
            DeliveryDate = request.DeliveryDate!.Value,
            DeliveryTime = Trimmed(request.DeliveryTime),
            Notes = Trimmed(request.Notes),
            Status = ProcessorSpaceStatus.Booked,
        };

    /// <summary>
    /// Why an edit to a Processor Space may not be applied, or null when it may.
    /// </summary>
    /// <remarks>
    /// The plant is checked against the space's <b>existing</b> processor, because the processor is not
    /// editable (requirement 4.2). There is no clause about matches: raising or lowering the quantity
    /// is exactly the edit 4.4 asks to be allowed through.
    /// </remarks>
    public static string? RejectUpdateSpace(ProcessorSpace? space, UpdateProcessorSpaceRequest request)
    {
        if (space is null)
        {
            return MatchWriter.NoSuchSpace;
        }

        return RejectPlant(space.Processor, request.Plant)
            ?? RejectQuantity(request.QuantityRequired)
            ?? (request.DeliveryDate is null ? DeliveryDateRequired : null);
    }

    /// <summary>Writes the five editable fields onto <paramref name="space"/>. Status is untouched.</summary>
    public static void ApplySpace(ProcessorSpace space, UpdateProcessorSpaceRequest request)
    {
        space.Plant = Trimmed(request.Plant)!;
        space.QuantityRequired = request.QuantityRequired;
        space.DeliveryDate = request.DeliveryDate!.Value;
        space.DeliveryTime = Trimmed(request.DeliveryTime);
        space.Notes = Trimmed(request.Notes);
    }

    /// <summary>Why a new Livestock Availability record may not be created, or null when it may.</summary>
    /// <remarks>
    /// Its stock class is checked against the single supply-side list and against <b>no</b> processor's
    /// list. The two vocabularies do not align, there is no mapping between them, and cross-checking
    /// them here would invent one.
    /// </remarks>
    public static string? RejectCreateAvailability(
        WorkingSet set,
        CreateLivestockAvailabilityRequest request) =>
        RejectAvailabilityStockClass(request.StockClass)
        ?? RejectQuantity(request.QuantityAvailable)
        ?? RejectLocation(set, request.LocationId)
        ?? RejectTransactionType(request.TransactionType)
        ?? (request.AvailableFrom is null ? AvailableFromRequired : null);

    /// <summary>The record a validated create request becomes: always <c>Booked</c> (requirement 3.8).</summary>
    public static LivestockAvailability NewAvailability(CreateLivestockAvailabilityRequest request) =>
        new()
        {
            StockClass = Trimmed(request.StockClass)!,
            QuantityAvailable = request.QuantityAvailable,
            LocationId = request.LocationId,
            AvailableFrom = request.AvailableFrom!.Value,
            AvailabilityDetails = Trimmed(request.AvailabilityDetails),
            TransactionType = request.TransactionType!.Value,
            Notes = Trimmed(request.Notes),
            Status = LivestockAvailabilityStatus.Booked,
        };

    /// <summary>
    /// Why an edit to an availability record may not be applied, or null when it may.
    /// </summary>
    /// <remarks>
    /// <b>Every attribute is editable</b> (requirement 4.3), including the quantity — and lowering it
    /// below what is already matched is permitted here on purpose. That is the one intended route to
    /// the pink "Over-committed" state, and the spec contemplates it plainly: a farmer can sell stock
    /// elsewhere. The client warns and names the consequence; this does not refuse it.
    /// </remarks>
    public static string? RejectUpdateAvailability(
        WorkingSet set,
        LivestockAvailability? availability,
        UpdateLivestockAvailabilityRequest request)
    {
        if (availability is null)
        {
            return NoSuchAvailability;
        }

        return RejectAvailabilityStockClass(request.StockClass)
            ?? RejectQuantity(request.QuantityAvailable)
            ?? RejectLocation(set, request.LocationId)
            ?? RejectTransactionType(request.TransactionType)
            ?? (request.AvailableFrom is null ? AvailableFromRequired : null);
    }

    /// <summary>Writes every editable field. The stored status is untouched.</summary>
    public static void ApplyAvailability(
        LivestockAvailability availability,
        UpdateLivestockAvailabilityRequest request)
    {
        availability.StockClass = Trimmed(request.StockClass)!;
        availability.QuantityAvailable = request.QuantityAvailable;
        availability.LocationId = request.LocationId;
        availability.AvailableFrom = request.AvailableFrom!.Value;
        availability.AvailabilityDetails = Trimmed(request.AvailabilityDetails);
        availability.TransactionType = request.TransactionType!.Value;
        availability.Notes = Trimmed(request.Notes);
    }

    /// <summary>
    /// Why a Processor Space may not be cancelled, or null when it may.
    /// </summary>
    /// <remarks>
    /// <b>Note what is not asked.</b> The space's matches are never consulted, here or in the endpoint:
    /// cancelling a record does not cascade to them and must not be blocked by them. They stay live,
    /// on their own cards, and are cancelled separately — which is what lets APG arrange alternatives
    /// before anyone is notified (Phase 7, 5.2).
    /// </remarks>
    public static string? RejectCancelSpace(ProcessorSpace? space) =>
        space is null
            ? MatchWriter.NoSuchSpace
            : RecordCancellation.CanCancelProcessorSpace(space)
                ? null
                : RecordCancellation.SpaceAlreadyCancelled;

    /// <inheritdoc cref="RejectCancelSpace"/>
    public static string? RejectCancelAvailability(LivestockAvailability? availability) =>
        availability is null
            ? NoSuchAvailability
            : RecordCancellation.CanCancelAvailability(availability)
                ? null
                : RecordCancellation.AvailabilityAlreadyCancelled;

    private static IReadOnlyList<string> PlantsOf(string processor) =>
        SeedConfig.PlantsByProcessor
            .Where(entry => entry.Processor == processor)
            .SelectMany(entry => entry.Plants)
            .ToList();

    private static IReadOnlyList<string> StockClassesOf(string processor) =>
        SeedConfig.ProcessorSpaceStockClasses
            .Where(entry => entry.Processor == processor)
            .SelectMany(entry => entry.StockClasses)
            .ToList();

    private static string? RejectPlant(string processor, string? plant)
    {
        var value = Trimmed(plant);

        return value is not null && PlantsOf(processor).Contains(value)
            ? null
            : $"{PlantRequired}. {processor}'s plants are {string.Join(", ", PlantsOf(processor))}";
    }

    /// <summary>The Processor Space side: that processor's own list, and no other's.</summary>
    private static string? RejectStockClass(string processor, string? stockClass)
    {
        var value = Trimmed(stockClass);

        return value is not null && StockClassesOf(processor).Contains(value)
            ? null
            : $"{StockClassRequired}. {processor}'s stock classes are {string.Join(", ", StockClassesOf(processor))}";
    }

    private static string? RejectAvailabilityStockClass(string? stockClass)
    {
        var value = Trimmed(stockClass);

        return value is not null && SeedConfig.AvailabilityStockClasses.Contains(value)
            ? null
            : StockClassRequired;
    }

    /// <summary>Integers at least 1 (requirement 6.2). A quantity of zero is not a record.</summary>
    private static string? RejectQuantity(int quantity) => quantity < 1 ? QuantityBelowOne : null;

    private static string? RejectLocation(WorkingSet set, int locationId) =>
        locationId < 1
            ? LocationRequired
            : set.Locations.Any(location => location.Id == locationId)
                ? null
                : NoSuchLocation;

    private static string? RejectTransactionType(TransactionType? type) =>
        type is null || !Enum.IsDefined(type.Value) ? TransactionTypeRequired : null;

    /// <summary>An empty box is no value, not "". The same rule <c>MatchWriter</c> applies.</summary>
    private static string? Trimmed(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
