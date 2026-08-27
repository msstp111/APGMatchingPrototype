using Apg.Api.Seeding;
using Apg.Domain.Entities;

namespace Apg.Api.Tests;

/// <summary>
/// One generated dataset, shared across the seed tests, anchored on a pinned Sunday so nothing here
/// depends on the day the suite happens to run.
/// </summary>
public static class SeedFixture
{
    /// <summary>Sunday 23 August 2026.</summary>
    public static readonly DateOnly Anchor = new(2026, 8, 23);

    private static readonly Lazy<IReadOnlyList<Location>> LazyLocations =
        new(DatabaseSeeder.LoadLocations);

    private static readonly Lazy<SeedData> LazyData =
        new(() => SeedDataGenerator.Generate(Anchor, Locations));

    public static IReadOnlyList<Location> Locations => LazyLocations.Value;

    public static SeedData Data => LazyData.Value;

    /// <summary>
    /// Sum of matched quantity excluding cancelled matches — the "incl Draft" figure. Phase 1 owns
    /// the real implementation in <c>Apg.Domain</c>; it is restated here only because these tests
    /// predate it, and it must not be copied anywhere outside the test project.
    /// </summary>
    public static int MatchedInclDraft(IEnumerable<Match> matches) =>
        matches.Where(m => m.Status != MatchStatus.Cancelled).Sum(m => m.QuantityMatched);

    public static List<Match> MatchesForSpace(int spaceId) =>
        Data.Matches.Where(m => m.ProcessorSpaceId == spaceId).ToList();

    public static List<Match> MatchesForAvailability(int availabilityId) =>
        Data.Matches.Where(m => m.LivestockAvailabilityId == availabilityId).ToList();
}
