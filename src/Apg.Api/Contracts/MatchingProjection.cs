using Apg.Domain.Entities;
using Apg.Domain.Matching;
using Apg.Domain.Time;

namespace Apg.Api.Contracts;

/// <summary>
/// The whole working set, read once. Small enough to hold in memory, and the client filters and
/// sorts over it locally, so there is no paging and no per-record round trip.
/// </summary>
public sealed record WorkingSet(
    IReadOnlyList<ProcessorSpace> Spaces,
    IReadOnlyList<LivestockAvailability> Availabilities,
    IReadOnlyList<Match> Matches,
    IReadOnlyList<Location> Locations,
    IReadOnlyList<Farmer> Farmers);

/// <summary>
/// Turns stored records into the DTO contract.
/// </summary>
/// <remarks>
/// <b>This class computes nothing.</b> Every derived figure on the way out — both matched sums, the
/// unmatched figure, the quantity state and its label, the derived availability status, the confirm
/// gate, the week-commencing Sunday and every display label — comes from a call into
/// <c>Apg.Domain</c>. Reimplementing one here would be the same drift as reimplementing it in
/// TypeScript, just one layer closer to the rules.
/// </remarks>
public static class MatchingProjection
{
    public static IReadOnlyList<ProcessorSpaceDto> ProcessorSpaces(WorkingSet set)
    {
        var context = new ProjectionContext(set);

        // Soonest first, always — the matching screen never shows another order.
        return set.Spaces
            .OrderBy(s => s.DeliveryDate)
            .ThenBy(s => s.Id)
            .Select(space => ToDto(space, context))
            .ToList();
    }

    public static IReadOnlyList<LivestockAvailabilityDto> LivestockAvailability(WorkingSet set)
    {
        var context = new ProjectionContext(set);

        return set.Availabilities
            .OrderBy(a => a.AvailableFrom)
            .ThenBy(a => a.Id)
            .Select(availability => ToDto(availability, context))
            .ToList();
    }

    /// <summary>
    /// One space, projected — what a write endpoint returns so a card can be replaced in place.
    /// </summary>
    /// <remarks>
    /// The same <see cref="ToDto(ProcessorSpace, ProjectionContext)"/> the list endpoint uses, over the
    /// same working set. A second projection path for a single record is how the figure on a card after
    /// a match would come to differ from the figure on the same card after a reload.
    /// </remarks>
    public static ProcessorSpaceDto? SpaceById(WorkingSet set, int id)
    {
        var space = set.Spaces.FirstOrDefault(s => s.Id == id);

        return space is null ? null : ToDto(space, new ProjectionContext(set));
    }

    /// <inheritdoc cref="SpaceById"/>
    public static LivestockAvailabilityDto? AvailabilityById(WorkingSet set, int id)
    {
        var availability = set.Availabilities.FirstOrDefault(a => a.Id == id);

        return availability is null ? null : ToDto(availability, new ProjectionContext(set));
    }

    /// <summary>
    /// The week bands both columns are drawn on: every Sunday from the earliest record's week to the
    /// latest, in order and with no gaps, and always including the current week.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>One calendar, trimmed per column by the client.</b> The server ships the full ordered run
    /// because only it can name a week no record falls in; each column then starts at the week of its
    /// own earliest record and renders every band from there, so an interior empty week keeps its
    /// header. The two columns therefore often start at different weeks, which is intended: neither
    /// column's start may be decided by what the other one holds.
    /// </para>
    /// <para>
    /// The current week is folded into the range whether or not a record falls in it, so
    /// <c>IsCurrentWeek</c> always has somewhere to land and a column whose records are all in the
    /// past still shows where "now" is.
    /// </para>
    /// </remarks>
    public static IReadOnlyList<WeekBandDto> WeekBands(WorkingSet set, TimeProvider clock)
    {
        var currentWeek = NzTime.CurrentWeekCommencing(clock);

        var dates = set.Spaces.Select(s => s.DeliveryDate)
            .Concat(set.Availabilities.Select(a => a.AvailableFrom))
            .Append(currentWeek)
            .ToList();

        return NzTime.WeeksFrom(dates.Min(), dates.Max())
            .Select(week => new WeekBandDto
            {
                WeekCommencing = week,
                WeekCommencingLabel = NzTime.DateLabel(week),
                WeekOfLabel = NzTime.ShortDateLabel(week),
                IsCurrentWeek = week == currentWeek,
                IsPastWeek = week < currentWeek,
            })
            .ToList();
    }

    private static ProcessorSpaceDto ToDto(ProcessorSpace space, ProjectionContext context)
    {
        var matches = context.MatchesForSpace(space.Id);
        var tally = MatchQuantities.ForSpace(space, matches, context.Cancelled);

        return new ProcessorSpaceDto
        {
            Id = space.Id,
            Processor = space.Processor,
            Plant = space.Plant,
            StockClass = space.StockClass,
            QuantityRequired = space.QuantityRequired,
            DeliveryDate = space.DeliveryDate,
            DeliveryDateLabel = NzTime.DateLabel(space.DeliveryDate),
            DeliveryDayLabel = NzTime.DayOfMonthLabel(space.DeliveryDate),
            DeliveryMonthLabel = NzTime.MonthLabel(space.DeliveryDate),
            DeliveryTime = space.DeliveryTime,
            Notes = space.Notes,
            Status = space.Status,
            MatchedInclDraft = tally.MatchedInclDraft,
            MatchedExclDraft = tally.MatchedExclDraft,
            Unmatched = tally.Unmatched,
            QuantityState = tally.State,
            QuantityStateLabel = QuantityStateLabels.For(tally.State, MatchSide.ProcessorSpace),
            WeekCommencing = NzTime.WeekCommencing(space.DeliveryDate),
            WeekCommencingLabel = NzTime.WeekLabel(space.DeliveryDate),
            // Two calls, deliberately, though CanConfirm is defined as "ConfirmBlockedReason is null"
            // and the clauses therefore run twice. Collapsing them would put that definition here, in
            // the one class whose entire contract is that it computes nothing — and a rule restated in
            // the projection is the same drift as a rule restated in TypeScript, one layer closer in.
            // The cost is a LINQ filter over one space's matches, forty times per request.
            CanConfirm = ProcessorSpaceRules.CanConfirm(space, matches, context.Cancelled),
            ConfirmBlockedReason = ProcessorSpaceRules.ConfirmBlockedReason(space, matches, context.Cancelled),
            Matches = LiveMatchDtos(matches, context),
        };
    }

    private static LivestockAvailabilityDto ToDto(
        LivestockAvailability availability,
        ProjectionContext context)
    {
        var matches = context.MatchesForAvailability(availability.Id);
        var tally = MatchQuantities.ForAvailability(availability, matches, context.Cancelled);
        var farmer = context.FarmerAt(availability.LocationId);

        return new LivestockAvailabilityDto
        {
            Id = availability.Id,
            StockClass = availability.StockClass,
            QuantityAvailable = availability.QuantityAvailable,
            LocationId = availability.LocationId,
            LocationName = context.LocationName(availability.LocationId),
            FarmerId = farmer?.Id,
            FarmerName = farmer?.Name,
            FarmerMobile = farmer?.Mobile,
            AvailableFrom = availability.AvailableFrom,
            AvailableFromLabel = NzTime.DateLabel(availability.AvailableFrom),
            AvailableFromShortLabel = NzTime.ShortDateLabel(availability.AvailableFrom),
            AvailableFromDayLabel = NzTime.DayOfMonthLabel(availability.AvailableFrom),
            AvailableFromMonthLabel = NzTime.MonthLabel(availability.AvailableFrom),
            AvailabilityDetails = availability.AvailabilityDetails,
            TransactionType = availability.TransactionType,
            Notes = availability.Notes,
            Status = AvailabilityStatus.Derive(availability, matches, context.Cancelled),
            MatchedInclDraft = tally.MatchedInclDraft,
            MatchedExclDraft = tally.MatchedExclDraft,
            Unmatched = tally.Unmatched,
            QuantityState = tally.State,
            QuantityStateLabel = QuantityStateLabels.For(tally.State, MatchSide.LivestockAvailability),
            WeekCommencing = NzTime.WeekCommencing(availability.AvailableFrom),
            WeekCommencingLabel = NzTime.WeekLabel(availability.AvailableFrom),
            Matches = LiveMatchDtos(matches, context),
        };
    }

    /// <summary>
    /// Cancelled matches are excluded from the collection (resolved question 4) — in pass 1 there is
    /// no Match list view, so a cancelled match is not visible anywhere.
    /// </summary>
    /// <remarks>
    /// This is a different thing from their exclusion from the two sums, and the two must not be
    /// conflated: a cancelled match is absent here <em>and</em> contributes nothing to either sum,
    /// but the sums are taken over the full match set, not over this list.
    /// </remarks>
    private static List<MatchDto> LiveMatchDtos(
        IReadOnlyList<Match> matches,
        ProjectionContext context)
    {
        var dtos = new List<MatchDto>();

        foreach (var match in matches.Where(MatchQuantities.IsLive).OrderBy(m => m.Id))
        {
            var space = context.Space(match.ProcessorSpaceId);
            var availability = context.Availability(match.LivestockAvailabilityId);

            // An orphaned match cannot be rendered on either card. It still counts in the sums, which
            // are taken over the raw match set above, so skipping it here changes no number.
            if (space is null || availability is null)
            {
                continue;
            }

            var farmer = context.FarmerAt(availability.LocationId);

            dtos.Add(new MatchDto
            {
                Id = match.Id,
                QuantityMatched = match.QuantityMatched,
                PricePerKg = match.PricePerKg,
                TransportCompany = match.TransportCompany,
                Status = match.Status,
                CancellationReason = match.CancellationReason,
                CreatedAt = match.CreatedAt,
                ProcessorSpaceId = space.Id,
                Processor = space.Processor,
                Plant = space.Plant,
                SpaceStockClass = space.StockClass,
                // Both parents' statuses ride on the match so the card on the far side can say that a
                // partner record has been cancelled. Cancelling a record never cascades, so this is a
                // normal state rather than an error, and the availability side's value is the derived
                // one — the same computation its own DTO carries, never a second reading of it.
                SpaceStatus = space.Status,
                DeliveryDate = space.DeliveryDate,
                DeliveryDateLabel = NzTime.DateLabel(space.DeliveryDate),
                DeliveryTime = space.DeliveryTime,
                LivestockAvailabilityId = availability.Id,
                FarmerName = farmer?.Name,
                LocationName = context.LocationName(availability.LocationId),
                AvailabilityStockClass = availability.StockClass,
                AvailabilityStatus = AvailabilityStatus.Derive(
                    availability,
                    context.MatchesForAvailability(availability.Id),
                    context.Cancelled),
                AvailabilityDetails = availability.AvailabilityDetails,
                AvailableFrom = availability.AvailableFrom,
                AvailableFromLabel = NzTime.DateLabel(availability.AvailableFrom),
            });
        }

        return dtos;
    }

    /// <summary>
    /// The lookups the projection walks. Built once per request rather than per record, so projecting
    /// fifty records over a few hundred matches stays linear.
    /// </summary>
    private sealed class ProjectionContext
    {
        private readonly ILookup<int, Match> _bySpace;
        private readonly ILookup<int, Match> _byAvailability;
        private readonly Dictionary<int, ProcessorSpace> _spaces;
        private readonly Dictionary<int, LivestockAvailability> _availabilities;
        private readonly Dictionary<int, string> _locationNames;
        private readonly Dictionary<int, Farmer> _farmersByLocation;

        /// <summary>
        /// Which records are cancelled, read once per request.
        /// </summary>
        /// <remarks>
        /// Every quantity and status rule below takes it, because a match tied to a cancelled record
        /// stops consuming the <em>other</em> record's quantity — a farmer whose stock was matched to
        /// a cancelled space has that stock to sell again. It is read from the same working set the
        /// records come from, so a card and its figures can never disagree about what is cancelled.
        /// </remarks>
        public CancelledRecords Cancelled { get; }

        public ProjectionContext(WorkingSet set)
        {
            Cancelled = CancelledRecords.In(set.Spaces, set.Availabilities);
            _bySpace = set.Matches.ToLookup(m => m.ProcessorSpaceId);
            _byAvailability = set.Matches.ToLookup(m => m.LivestockAvailabilityId);
            _spaces = set.Spaces.ToDictionary(s => s.Id);
            _availabilities = set.Availabilities.ToDictionary(a => a.Id);
            _locationNames = set.Locations.ToDictionary(l => l.Id, l => l.Name);

            // Exactly one farmer per location (resolved question 10). Grouped rather than keyed
            // directly so a seed that broke that invariant would not take the endpoint down.
            _farmersByLocation = set.Farmers
                .GroupBy(f => f.LocationId)
                .ToDictionary(g => g.Key, g => g.First());
        }

        public IReadOnlyList<Match> MatchesForSpace(int spaceId) => _bySpace[spaceId].ToList();

        public IReadOnlyList<Match> MatchesForAvailability(int availabilityId) =>
            _byAvailability[availabilityId].ToList();

        public ProcessorSpace? Space(int id) => _spaces.GetValueOrDefault(id);

        public LivestockAvailability? Availability(int id) => _availabilities.GetValueOrDefault(id);

        public string? LocationName(int locationId) => _locationNames.GetValueOrDefault(locationId);

        public Farmer? FarmerAt(int locationId) => _farmersByLocation.GetValueOrDefault(locationId);
    }
}
