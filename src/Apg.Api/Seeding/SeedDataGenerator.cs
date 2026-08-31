using Apg.Domain.Entities;
using Apg.Domain.Matching;

namespace Apg.Api.Seeding;

/// <summary>
/// Builds the demo dataset. Pure: the same anchor plus the same locations gives identical output,
/// every time, on every .NET version — see <see cref="Mulberry32"/> for why <c>System.Random</c> is
/// not used.
/// </summary>
/// <remarks>
/// <para>
/// Every date is a fixed <em>offset in days</em> from <c>anchorWeekCommencing</c>, the Sunday that
/// starts the current New Zealand week. Nothing here hard-codes an absolute date, so the demo always
/// looks current without the dataset changing shape.
/// </para>
/// <para>
/// The matches are <em>scripted, not hoped for</em>. Each demonstration case in the phase document's
/// section 4.7 is constructed deliberately by <see cref="BuildDemonstrationSpine"/> before the PRNG
/// fills the remainder, because a random pass that happens to produce an over-filled space today may
/// not produce one tomorrow.
/// </para>
/// </remarks>
public static partial class SeedDataGenerator
{
    public const int ProcessorSpaceCount = 40;
    public const int AvailabilityCount = 50;
    public const int TargetMatchCount = 25;

    /// <summary>Week offsets, relative to the anchor Sunday, that records are spread across.</summary>
    public const int FirstWeekOffset = -1;
    public const int LastWeekOffset = 4;

    /// <summary>The price table extends either side of the record window so a lookup never misses.</summary>
    public const int PriceWeeksBefore = 4;
    public const int PriceWeeksAfter = 8;

    /// <summary>
    /// Availability records held back from matching entirely, all dated in the week before the
    /// current one, so the matching screen opens with a backlog: supply sitting above the current
    /// week with stock still to allocate.
    /// </summary>
    /// <remarks>
    /// This constant was renamed in Phase 3b. Its value and behaviour did not change — only the design
    /// these records serve (resolved question 17) — so the seeded data is identical either side of it.
    /// </remarks>
    public const int BacklogAvailabilityCount = 5;

    /// <summary>
    /// Spaces moved off <c>Booked</c> once the matches exist, so all three Processor Space statuses
    /// appear in the seed. Small on purpose: the matching screen's default filter is
    /// <c>Status = Booked</c>, and these are the records it is supposed to hide.
    /// </summary>
    public const int ConfirmedSpaceCount = 4;

    public const int CancelledSpaceCount = 2;

    private const int WeekCount = LastWeekOffset - FirstWeekOffset + 1;

    public static SeedData Generate(DateOnly anchorWeekCommencing, IReadOnlyList<Location> locations)
    {
        ArgumentNullException.ThrowIfNull(locations);
        if (locations.Count < AvailabilityCount)
        {
            throw new ArgumentException(
                $"Need at least {AvailabilityCount} locations to seed; got {locations.Count}.", nameof(locations));
        }

        var farmers = GenerateFarmers(locations);

        var rng = new Mulberry32(SeedConfig.PrngSeed);
        var prices = GeneratePrices(rng, anchorWeekCommencing);
        var priceLookup = prices.ToDictionary(
            p => (p.Processor, p.StockClass, p.WeekCommencing),
            p => p.PricePerKg);

        var spaces = GenerateProcessorSpaces(rng, anchorWeekCommencing);
        var availabilities = GenerateAvailabilities(rng, anchorWeekCommencing, locations);
        var matchSet = GenerateMatches(rng, anchorWeekCommencing, spaces, availabilities, priceLookup);

        // After the matches, never before: a Confirmed space is only Confirmed because its matches
        // say it can be.
        ApplySpaceStatuses(spaces, matchSet);

        return new SeedData(
            anchorWeekCommencing, locations, farmers, spaces, availabilities, matchSet.Matches, prices);
    }

    /// <summary>
    /// Exactly one farmer per location (resolved question 10). Each is generated from a PRNG seeded
    /// with the <em>location id</em> rather than drawn from the shared stream, so a location's farmer
    /// never changes — not between runs, and not if the ordering of anything else here changes.
    /// </summary>
    private static List<Farmer> GenerateFarmers(IReadOnlyList<Location> locations)
    {
        var farmers = new List<Farmer>(locations.Count);

        foreach (var location in locations)
        {
            var rng = new Mulberry32(SeedConfig.PrngSeed ^ (uint)location.Id);
            var name = $"{rng.Pick(SeedConfig.FarmerGivenNames)} {rng.Pick(SeedConfig.FarmerFamilyNames)}";
            var mobile = $"{rng.Pick(SeedConfig.MobilePrefixes)} {rng.Next(200, 1000)} {rng.Next(1000, 10000)}";

            farmers.Add(new Farmer
            {
                Id = location.Id,
                LocationId = location.Id,
                Name = name,
                Mobile = mobile,
            });
        }

        return farmers;
    }

    /// <summary>
    /// One series per processor x Processor-Space stock class, walked week by week. Prices mostly
    /// hold and occasionally step, as the spec describes.
    /// </summary>
    private static List<PriceTableEntry> GeneratePrices(Mulberry32 rng, DateOnly anchor)
    {
        var prices = new List<PriceTableEntry>();
        var id = 1;

        foreach (var (processor, stockClasses) in SeedConfig.ProcessorSpaceStockClasses)
        {
            foreach (var stockClass in stockClasses)
            {
                var (min, max) = SeedConfig.PriceRange(stockClass);
                var price = rng.NextDecimal(min, max);

                for (var week = -PriceWeeksBefore; week <= PriceWeeksAfter; week++)
                {
                    if (week > -PriceWeeksBefore && rng.Chance(0.25))
                    {
                        var step = rng.NextDecimal(0.05m, 0.25m);
                        price = Math.Clamp(rng.Chance(0.5) ? price + step : price - step, min, max);
                    }

                    prices.Add(new PriceTableEntry
                    {
                        Id = id++,
                        Processor = processor,
                        StockClass = stockClass,
                        WeekCommencing = anchor.AddDays(week * 7),
                        PricePerKg = price,
                    });
                }
            }
        }

        return prices;
    }

    private static List<ProcessorSpace> GenerateProcessorSpaces(Mulberry32 rng, DateOnly anchor)
    {
        var spaces = new List<ProcessorSpace>(ProcessorSpaceCount);

        // Each processor's first few spaces walk its own stock class list so every class appears at
        // least once. Everything after that is random. Guaranteed coverage matters: the seed has to
        // contain an ANZCO "Nat Beef - Premium" space for the mismatched-pairing demonstration.
        var usedClassCount = new Dictionary<string, int>();
        var processors = ProcessorAssignments(rng);

        for (var i = 0; i < ProcessorSpaceCount; i++)
        {
            var processor = processors[i];
            var classes = StockClassesFor(processor);
            var plants = PlantsFor(processor);

            var used = usedClassCount.GetValueOrDefault(processor);
            var stockClass = used < classes.Length ? classes[used] : rng.Pick(classes);
            usedClassCount[processor] = used + 1;

            var quantity = QuantityFor(rng, stockClass);

            // Spread evenly across the six-week window; delivery lands on a weekday (Sunday is 0).
            var weekOffset = FirstWeekOffset + (i % WeekCount);
            var deliveryDate = anchor.AddDays((weekOffset * 7) + rng.Next(1, 6));

            spaces.Add(new ProcessorSpace
            {
                Id = i + 1,
                Processor = processor,
                Plant = rng.Pick(plants),
                StockClass = stockClass,
                QuantityRequired = quantity,
                DeliveryDate = deliveryDate,
                DeliveryTime = rng.Chance(0.45) ? rng.Pick(SeedConfig.DeliveryTimes) : null,
                Notes = rng.Chance(0.35) ? rng.Pick(SeedConfig.SpaceNotes) : null,
                Status = ProcessorSpaceStatus.Booked,
            });
        }

        return spaces;
    }

    /// <summary>
    /// Moves a few spaces off <see cref="ProcessorSpaceStatus.Booked"/>, so the seed contains all
    /// three of the statuses a space can hold rather than only the one it is created in.
    /// </summary>
    /// <remarks>
    /// Both rules here are the domain's, not the seeder's:
    /// <list type="bullet">
    /// <item><description>
    /// A space is only made <c>Confirmed</c> if <see cref="ProcessorSpaceRules.CanConfirm"/> already
    /// says it could be — at least one live match, every live match Confirmed. A Confirmed space with
    /// a draft outstanding is a state APG could never have reached, and seeding one would put a
    /// record on screen that contradicts the rule the Confirm button enforces.
    /// </description></item>
    /// <item><description>
    /// A <c>Cancelled</c> space <em>keeps its matches</em>. Cancelling a record never cascades — that
    /// is deliberate, so APG can arrange alternatives before notifying anyone — and the seed should
    /// show it rather than leave Phase 7 to demonstrate it from nothing.
    /// </description></item>
    /// </list>
    /// Spaces a section 4.7 demonstration case depends on are skipped: confirming or cancelling one
    /// would quietly retire the case it was built for.
    /// </remarks>
    private static void ApplySpaceStatuses(IReadOnlyList<ProcessorSpace> spaces, MatchSet matchSet)
    {
        var matchesBySpace = matchSet.Matches
            .GroupBy(m => m.ProcessorSpaceId)
            .ToDictionary(g => g.Key, g => (IReadOnlyList<Match>)[.. g]);

        IReadOnlyList<Match> MatchesFor(ProcessorSpace space) =>
            matchesBySpace.GetValueOrDefault(space.Id, []);

        bool Available(ProcessorSpace space) => !matchSet.LockedSpaceIds.Contains(space.Id);

        var confirmable = spaces
            .Where(Available)
            .Where(s => ProcessorSpaceRules.CanConfirm(s, MatchesFor(s)))
            .Take(ConfirmedSpaceCount)
            .ToList();

        // Cancelled spaces are drawn from those that still hold LIVE matches, not merely any match:
        // a space whose only match is itself cancelled would demonstrate nothing. The non-cascade
        // rule is the point — cancelling a record never touches its matches — so the seed has to put
        // a cancelled space with live matches on the screen.
        var cancellable = spaces
            .Where(Available)
            .Where(s => !confirmable.Contains(s))
            .OrderByDescending(s => MatchesFor(s).Any(MatchQuantities.IsLive))
            .Take(CancelledSpaceCount)
            .ToList();

        // Checked before anything is mutated, so a shortfall throws against an untouched set rather
        // than leaving half the pass applied behind the exception.
        Required(
            confirmable.Count == ConfirmedSpaceCount,
            $"{ConfirmedSpaceCount} spaces the domain agrees could be confirmed");
        Required(
            cancellable.Count == CancelledSpaceCount,
            $"{CancelledSpaceCount} spaces to cancel");
        Required(
            cancellable.Exists(s => MatchesFor(s).Any(MatchQuantities.IsLive)),
            "a cancelled space that still holds live matches, showing that cancelling does not cascade");

        foreach (var space in confirmable)
        {
            space.Status = ProcessorSpaceStatus.Confirmed;
        }

        foreach (var space in cancellable)
        {
            space.Status = ProcessorSpaceStatus.Cancelled;
        }
    }

    /// <summary>
    /// One processor per space, in APG's real proportions, shuffled.
    /// </summary>
    /// <remarks>
    /// This replaces a <c>Processors[i % 3]</c> cycle. The week a space lands in comes from
    /// <c>i % WeekCount</c>, and with six weeks and three processors the two aliased exactly: every
    /// week held one processor and only one, for as long as the seed existed. Nothing in the design
    /// intended that, and a screen where filtering by processor is the same thing as filtering by
    /// week teaches the wrong lesson about the data.
    /// <para>
    /// The counts are built from <see cref="SeedConfig.ProcessorMix"/> and any rounding remainder
    /// goes to the largest share, so the list is always exactly <see cref="ProcessorSpaceCount"/>
    /// long. Shuffling with the shared PRNG keeps the whole thing deterministic.
    /// </para>
    /// </remarks>
    private static List<string> ProcessorAssignments(Mulberry32 rng)
    {
        var totalWeight = SeedConfig.ProcessorMix.Sum(p => p.Weight);
        var assignments = new List<string>(ProcessorSpaceCount);

        foreach (var (processor, weight) in SeedConfig.ProcessorMix)
        {
            var count = ProcessorSpaceCount * weight / totalWeight;
            assignments.AddRange(Enumerable.Repeat(processor, count));
        }

        // Integer division loses the remainder; the biggest share absorbs it.
        var largest = SeedConfig.ProcessorMix.MaxBy(p => p.Weight).Processor;
        while (assignments.Count < ProcessorSpaceCount)
        {
            assignments.Add(largest);
        }

        rng.Shuffle(assignments);

        return assignments;
    }

    private static List<LivestockAvailability> GenerateAvailabilities(
        Mulberry32 rng, DateOnly anchor, IReadOnlyList<Location> locations)
    {
        var shuffledLocations = locations.ToList();
        rng.Shuffle(shuffledLocations);

        var availabilities = new List<LivestockAvailability>(AvailabilityCount);
        var classes = SeedConfig.AvailabilityStockClasses;

        for (var i = 0; i < AvailabilityCount; i++)
        {
            // The first pass walks the availability stock class list so every class appears.
            var stockClass = i < classes.Length ? classes[i] : rng.Pick(classes);
            var quantity = QuantityFor(rng, stockClass);

            // Availability can start on any day of the week, unlike a space's fixed delivery day.
            var weekOffset = FirstWeekOffset + (i % WeekCount);
            var availableFrom = anchor.AddDays((weekOffset * 7) + rng.Next(0, 7));

            availabilities.Add(new LivestockAvailability
            {
                Id = i + 1,
                StockClass = stockClass,
                QuantityAvailable = quantity,
                LocationId = shuffledLocations[i].Id,
                AvailableFrom = availableFrom,
                AvailabilityDetails = rng.Chance(0.6) ? rng.Pick(SeedConfig.AvailabilityDetailsOptions) : null,
                TransactionType = rng.Pick(SeedConfig.TransactionTypes),
                Notes = rng.Chance(0.3) ? rng.Pick(SeedConfig.AvailabilityNotes) : null,
                Status = LivestockAvailabilityStatus.Booked,
            });
        }

        return availabilities;
    }

    private static int QuantityFor(Mulberry32 rng, string stockClass)
    {
        var (min, max) = SeedConfig.QuantityRange(stockClass);
        var species = SeedConfig.SpeciesOf(stockClass);
        var step = species is SeedConfig.Species.Lamb or SeedConfig.Species.Mutton ? 10 : 1;
        return RoundTo(rng.Next(min, max + 1), step);
    }

    private static string[] StockClassesFor(string processor) =>
        SeedConfig.ProcessorSpaceStockClasses.First(p => p.Processor == processor).StockClasses;

    private static string[] PlantsFor(string processor) =>
        SeedConfig.PlantsByProcessor.First(p => p.Processor == processor).Plants;

    private static int RoundTo(int value, int step) => step <= 1 ? value : Math.Max(step, value / step * step);
}
