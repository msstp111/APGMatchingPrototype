using Apg.Domain.Entities;
using Apg.Domain.Time;

namespace Apg.Api.Seeding;

public static partial class SeedDataGenerator
{
    /// <summary>
    /// Builds the match set: first the scripted demonstration spine, then random filler up to
    /// <see cref="TargetMatchCount"/>.
    /// </summary>
    private static MatchSet GenerateMatches(
        Mulberry32 rng,
        DateOnly anchor,
        IReadOnlyList<ProcessorSpace> spaces,
        IReadOnlyList<LivestockAvailability> availabilities,
        IReadOnlyDictionary<(string Processor, string StockClass, DateOnly Week), decimal> prices)
    {
        var context = new MatchContext(rng, anchor, spaces, availabilities, prices);

        // Hold the earliest availability records out of matching entirely, so the backlog above the
        // current week has stock that genuinely stays unmatched week after week.
        foreach (var availability in availabilities
                     .Where(a => a.AvailableFrom < anchor)
                     .Take(BacklogAvailabilityCount))
        {
            context.LockAvailability(availability.Id);
        }

        BuildDemonstrationSpine(context);
        FillRemainingMatches(context);

        return new MatchSet(context.Matches, context.LockedSpaces);
    }

    /// <summary>
    /// The matches, and the spaces whose arithmetic a demonstration case depends on.
    /// </summary>
    /// <remarks>
    /// The locked ids travel out with the matches because the status pass has to leave those spaces
    /// alone: cancelling the over-filled space, or confirming the one built to show a draft
    /// outstanding, would quietly retire the case it was constructed for.
    /// </remarks>
    private sealed record MatchSet(List<Match> Matches, IReadOnlySet<int> LockedSpaceIds);

    /// <summary>
    /// Constructs every case the phase document's section 4.7 requires, one at a time, on records
    /// reserved for the purpose. Each case locks the record whose arithmetic must stay exact so the
    /// random filler pass cannot disturb it.
    /// </summary>
    private static void BuildDemonstrationSpine(MatchContext context)
    {
        // A pairing that looks wrong and is not: an availability "Prime" filling an ANZCO
        // "Nat Beef - Premium" space. The two stock class vocabularies do not map onto each other,
        // and a human made this call during the drag. Built first, before anything else can claim
        // that space.
        var mismatchSpace = Required(
            context.TakeFreshSpace(s => s is { Processor: "ANZCO", StockClass: "Nat Beef - Premium" }),
            "mismatched-looking pairing: an ANZCO Nat Beef - Premium space");
        var primeAvailability = Required(
            context.TakeAvailabilities(1, minimumSupply: 1, a => a.StockClass == "Prime"),
            1,
            "mismatched-looking pairing: an availability record of Prime")[0];

        context.Add(
            mismatchSpace,
            primeAvailability,
            Math.Max(1, mismatchSpace.QuantityRequired / 2),
            MatchStatus.Confirmed);

        // One Processor Space filled from three different Availability records, deliberately left
        // short of its requirement so the under-filled (orange) state has an example.
        var multiSourceSpace = Required(
            context.TakeFreshSpace(s =>
                SeedConfig.SpeciesOf(s.StockClass) == SeedConfig.Species.Cattle && s.QuantityRequired >= 60),
            "one space filled from three availability records: a cattle space of 60 head or more");
        var sources = Required(
            context.TakeAvailabilities(3, minimumSupply: 1),
            3,
            "one space filled from three availability records: three availability records with supply left");

        var multiSourceRequired = multiSourceSpace.QuantityRequired;
        var multiSourceShares = new[]
        {
            Percent(multiSourceRequired, 40),
            Percent(multiSourceRequired, 35),
            Percent(multiSourceRequired, 20),
        };
        var multiSourceStatuses = new[] { MatchStatus.Confirmed, MatchStatus.Drafted, MatchStatus.Drafted };

        for (var i = 0; i < 3; i++)
        {
            context.Add(multiSourceSpace, sources[i], multiSourceShares[i], multiSourceStatuses[i]);
        }

        context.LockSpace(multiSourceSpace.Id);

        // One Availability record split across three different Processor Spaces, from three
        // different processors, with a remainder left over so it derives as Pending.
        var splitAvailability = Required(
            context.TakeAvailabilities(1, minimumSupply: 90, untouchedOnly: true),
            1,
            "one availability record split across three spaces: an untouched record of 90 head or more")[0];
        var splitDestinations = Required(
            context.TakeFreshSpacesAcrossProcessors(3),
            3,
            "one availability record split across three spaces: three unmatched spaces, one per processor");

        var splitAvailable = splitAvailability.QuantityAvailable;
        var splitShares = new[]
        {
            Percent(splitAvailable, 30),
            Percent(splitAvailable, 30),
            Percent(splitAvailable, 25),
        };
        var splitStatuses = new[] { MatchStatus.Confirmed, MatchStatus.Confirmed, MatchStatus.Drafted };

        for (var i = 0; i < 3; i++)
        {
            context.Add(splitDestinations[i], splitAvailability, splitShares[i], splitStatuses[i]);
        }

        // Locked only once the matches exist. Locking a record the case failed to use would burn it
        // for the filler pass too, losing both the demonstration and the record.
        context.LockAvailability(splitAvailability.Id);

        // An over-filled space: unmatched goes negative, which is permitted on the demand side and
        // renders blue. Over-filling is deliberately asymmetric (resolved question 1).
        BuildTwoSourceFill(
            context,
            space => space.QuantityRequired + Math.Max(1, space.QuantityRequired / 10),
            "one over-filled space");

        // A space filled to exactly its requirement — the green state — but with a draft still
        // outstanding, so it is not yet confirmable (resolved question 12).
        BuildTwoSourceFill(
            context,
            space => space.QuantityRequired,
            "one space filled to exactly its required quantity");

        // An Availability record fully matched with every match Confirmed — the one combination that
        // derives an availability status of Confirmed. A small line is preferred, so absorbing all of
        // it does not incidentally over-fill both destination spaces.
        var fullyMatchedCandidates =
            context.TakeAvailabilities(1, minimumSupply: 2, a => a.QuantityAvailable <= 80, untouchedOnly: true);
        if (fullyMatchedCandidates.Count == 0)
        {
            fullyMatchedCandidates = context.TakeAvailabilities(1, minimumSupply: 2, untouchedOnly: true);
        }

        var fullyMatched = Required(
            fullyMatchedCandidates,
            1,
            "one availability record fully matched and every match confirmed: an untouched record")[0];
        var fullyMatchedDestinations = Required(
            context.TakeFreshSpacesAcrossProcessors(2),
            2,
            "one availability record fully matched and every match confirmed: two unmatched spaces");

        var fullyMatchedAvailable = fullyMatched.QuantityAvailable;
        var fullyMatchedFirst = Percent(fullyMatchedAvailable, 55);
        context.Add(fullyMatchedDestinations[0], fullyMatched, fullyMatchedFirst, MatchStatus.Confirmed);
        context.Add(
            fullyMatchedDestinations[1],
            fullyMatched,
            fullyMatchedAvailable - fullyMatchedFirst,
            MatchStatus.Confirmed);

        context.LockAvailability(fullyMatched.Id);

        // Two cancelled matches, with two different reasons. A cancelled match consumes no quantity:
        // it is excluded from both sums, which is why Add does not draw its quantity down.
        var cancellationReasons = new[]
        {
            MatchCancellationReason.ChangeFromProcessor,
            MatchCancellationReason.ChangeFromAgentOrFarmer,
        };

        foreach (var reason in cancellationReasons)
        {
            var space = Required(context.TakeFreshSpace(), $"a cancelled match ({reason}): an unmatched space");
            var availability = Required(
                context.TakeAvailabilities(1, minimumSupply: 1),
                1,
                $"a cancelled match ({reason}): an availability record with supply left")[0];

            context.Add(space, availability, Math.Max(1, space.QuantityRequired / 3), MatchStatus.Cancelled, reason);
        }
    }

    /// <summary>
    /// Fills one otherwise-unmatched space from two availability records to a target quantity, then
    /// locks it so the filler pass cannot disturb the arithmetic. Backs both the over-filled and the
    /// exactly-filled demonstration cases, which differ only in the target.
    /// </summary>
    private static void BuildTwoSourceFill(
        MatchContext context,
        Func<ProcessorSpace, int> target,
        string caseName)
    {
        var space = Required(context.TakeFreshSpace(), $"{caseName}: an unmatched space");

        var total = target(space);
        var first = Percent(total, 60);
        var second = total - first;

        var sources = Required(
            context.TakeAvailabilities(2, minimumSupply: Math.Max(first, second)),
            2,
            $"{caseName}: two availability records with at least {Math.Max(first, second)} head of supply each");

        context.Add(space, sources[0], first, MatchStatus.Confirmed);
        context.Add(space, sources[1], second, MatchStatus.Drafted);
        context.LockSpace(space.Id);
    }

    /// <summary>
    /// Fails loudly when a demonstration case cannot be built.
    /// </summary>
    /// <remarks>
    /// The cases in section 4.7 are what every later phase is judged against, so a seed that quietly
    /// drops one — leaving, say, no over-filled space to show the blue state — is worse than a seed
    /// that refuses to build. Tune <see cref="SeedConfig"/> or the record counts until the case can
    /// be constructed; do not soften this into a silent skip.
    /// </remarks>
    private static T Required<T>(T? value, string caseName)
        where T : class =>
        value ?? throw new InvalidOperationException(
            $"The seed could not build the demonstration case '{caseName}' required by phase 0, section 4.7.");

    /// <summary>The same rule for a condition rather than a record: it holds, or the seed refuses.</summary>
    private static void Required(bool satisfied, string caseName)
    {
        if (!satisfied)
        {
            throw new InvalidOperationException(
                $"The seed could not build the demonstration case '{caseName}' required by phase 0, section 4.7.");
        }
    }

    private static List<T> Required<T>(List<T> values, int expected, string caseName) =>
        values.Count == expected
            ? values
            : throw new InvalidOperationException(
                $"The seed could not build the demonstration case '{caseName}' required by phase 0, section 4.7: "
                + $"needed {expected} record(s), found {values.Count}.");

    /// <summary>
    /// Tops the match set up to <see cref="TargetMatchCount"/> with plausible random pairings. Never
    /// over-commits an availability record, and never over-fills a space: the one over-filled space
    /// in the seed is the deliberate one built above.
    /// </summary>
    private static void FillRemainingMatches(MatchContext context)
    {
        var attempts = 0;
        const int maxAttempts = TargetMatchCount * 40;

        while (context.Matches.Count < TargetMatchCount && attempts++ < maxAttempts)
        {
            var space = context.RandomOpenSpace();
            var availability = context.RandomOpenAvailability();
            if (space is null || availability is null)
            {
                break;
            }

            var remainingDemand = context.RemainingDemand(space.Id);
            var remainingSupply = context.RemainingSupply(availability.Id);
            if (remainingDemand < 1 || remainingSupply < 1)
            {
                continue;
            }

            var wanted = Math.Max(1, Percent(remainingDemand, context.Rng.Next(30, 101)));
            var quantity = Math.Min(wanted, remainingSupply);

            var status = context.Rng.Chance(0.55) ? MatchStatus.Drafted : MatchStatus.Confirmed;
            context.Add(space, availability, quantity, status);
        }
    }

    private static int Percent(int value, int percent) => Math.Max(1, (int)Math.Round(value * percent / 100.0));

    /// <summary>
    /// Mutable bookkeeping for the match pass: what quantity each record has left, which records are
    /// locked against further matching, and the running match list.
    /// </summary>
    private sealed class MatchContext
    {
        private readonly DateOnly _anchor;
        private readonly IReadOnlyList<ProcessorSpace> _spaces;
        private readonly IReadOnlyList<LivestockAvailability> _availabilities;
        private readonly IReadOnlyDictionary<(string Processor, string StockClass, DateOnly Week), decimal> _prices;
        private readonly Dictionary<int, int> _remainingDemand;
        private readonly Dictionary<int, int> _remainingSupply;
        private readonly HashSet<int> _lockedSpaces = [];
        private readonly HashSet<int> _lockedAvailabilities = [];
        private readonly HashSet<int> _touchedSpaces = [];
        private readonly HashSet<int> _touchedAvailabilities = [];
        private int _nextId = 1;

        public MatchContext(
            Mulberry32 rng,
            DateOnly anchor,
            IReadOnlyList<ProcessorSpace> spaces,
            IReadOnlyList<LivestockAvailability> availabilities,
            IReadOnlyDictionary<(string Processor, string StockClass, DateOnly Week), decimal> prices)
        {
            Rng = rng;
            _anchor = anchor;
            _spaces = spaces;
            _availabilities = availabilities;
            _prices = prices;
            _remainingDemand = spaces.ToDictionary(s => s.Id, s => s.QuantityRequired);
            _remainingSupply = availabilities.ToDictionary(a => a.Id, a => a.QuantityAvailable);
        }

        public Mulberry32 Rng { get; }

        public List<Match> Matches { get; } = [];

        public int RemainingDemand(int spaceId) => _remainingDemand[spaceId];

        public int RemainingSupply(int availabilityId) => _remainingSupply[availabilityId];

        /// <summary>Spaces a demonstration case depends on. Nothing later may disturb their sums.</summary>
        public IReadOnlySet<int> LockedSpaces => _lockedSpaces;

        public void LockSpace(int spaceId) => _lockedSpaces.Add(spaceId);

        public void LockAvailability(int availabilityId) => _lockedAvailabilities.Add(availabilityId);

        /// <summary>A space with no matches yet, not locked, and reserved on return.</summary>
        public ProcessorSpace? TakeFreshSpace(Func<ProcessorSpace, bool>? predicate = null)
        {
            var space = _spaces.FirstOrDefault(s =>
                !_lockedSpaces.Contains(s.Id)
                && !_touchedSpaces.Contains(s.Id)
                && (predicate is null || predicate(s)));

            if (space is not null)
            {
                _touchedSpaces.Add(space.Id);
            }

            return space;
        }

        /// <summary>
        /// Up to <paramref name="count"/> untouched spaces, each from a different processor, so a
        /// split across three spaces reads as a genuine spread rather than three slots at one works.
        /// </summary>
        public List<ProcessorSpace> TakeFreshSpacesAcrossProcessors(int count)
        {
            var taken = new List<ProcessorSpace>(count);
            var usedProcessors = new HashSet<string>();

            foreach (var space in _spaces)
            {
                if (taken.Count == count)
                {
                    break;
                }

                if (_lockedSpaces.Contains(space.Id)
                    || _touchedSpaces.Contains(space.Id)
                    || !usedProcessors.Add(space.Processor))
                {
                    continue;
                }

                _touchedSpaces.Add(space.Id);
                taken.Add(space);
            }

            return taken;
        }

        /// <summary>
        /// Up to <paramref name="count"/> availability records with at least
        /// <paramref name="minimumSupply"/> left, skipping locked ones.
        /// </summary>
        public List<LivestockAvailability> TakeAvailabilities(
            int count,
            int minimumSupply,
            Func<LivestockAvailability, bool>? predicate = null,
            bool untouchedOnly = false)
        {
            var taken = new List<LivestockAvailability>(count);

            foreach (var availability in _availabilities)
            {
                if (taken.Count == count)
                {
                    break;
                }

                if (_lockedAvailabilities.Contains(availability.Id)
                    || _remainingSupply[availability.Id] < minimumSupply
                    || (untouchedOnly && _touchedAvailabilities.Contains(availability.Id))
                    || (predicate is not null && !predicate(availability)))
                {
                    continue;
                }

                taken.Add(availability);
            }

            return taken;
        }

        public ProcessorSpace? RandomOpenSpace()
        {
            var candidates = _spaces
                .Where(s => !_lockedSpaces.Contains(s.Id) && _remainingDemand[s.Id] >= 1)
                .ToList();

            return candidates.Count == 0 ? null : Rng.Pick(candidates);
        }

        public LivestockAvailability? RandomOpenAvailability()
        {
            var candidates = _availabilities
                .Where(a => !_lockedAvailabilities.Contains(a.Id) && _remainingSupply[a.Id] >= 1)
                .ToList();

            return candidates.Count == 0 ? null : Rng.Pick(candidates);
        }

        public void Add(
            ProcessorSpace space,
            LivestockAvailability availability,
            int quantity,
            MatchStatus status,
            MatchCancellationReason? cancellationReason = null)
        {
            quantity = Math.Max(1, quantity);

            var isLive = status != MatchStatus.Cancelled;
            if (isLive)
            {
                // Supply is hard-capped; demand is not (resolved question 1).
                quantity = Math.Min(quantity, _remainingSupply[availability.Id]);
                if (quantity < 1)
                {
                    return;
                }

                _remainingSupply[availability.Id] -= quantity;
                _remainingDemand[space.Id] -= quantity;
            }

            _touchedSpaces.Add(space.Id);
            _touchedAvailabilities.Add(availability.Id);

            var createdOn = _anchor.AddDays(-Rng.Next(1, 15));
            var createdAt = NzTime.AtNzTime(createdOn, TimeSpan.FromHours(8) + TimeSpan.FromMinutes(Rng.Next(0, 540)));

            Matches.Add(new Match
            {
                Id = _nextId++,
                ProcessorSpaceId = space.Id,
                LivestockAvailabilityId = availability.Id,
                QuantityMatched = quantity,
                PricePerKg = DefaultPrice(space),
                TransportCompany = status == MatchStatus.Confirmed || Rng.Chance(0.5)
                    ? Rng.Pick(SeedConfig.TransportCompanies)
                    : null,
                Status = status,
                CancellationReason = cancellationReason,
                CreatedAt = createdAt,
            });
        }

        /// <summary>
        /// The seeded default price, keyed on the <em>Processor Space</em> stock class (resolved
        /// question 7), occasionally nudged because the price stays editable on the match.
        /// </summary>
        private decimal? DefaultPrice(ProcessorSpace space)
        {
            var week = NzTime.WeekCommencing(space.DeliveryDate);
            if (!_prices.TryGetValue((space.Processor, space.StockClass, week), out var price))
            {
                return null;
            }

            return Rng.Chance(0.2)
                ? Math.Round(price + Rng.NextDecimal(-0.15m, 0.15m), 2)
                : price;
        }
    }
}
