using Apg.Api.Seeding;
using Apg.Domain.Entities;
using Apg.Domain.Matching;

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
    /// Which seeded records are cancelled, for the rules that need to know.
    /// </summary>
    /// <remarks>
    /// The seed holds two cancelled Processor Spaces, both deliberately still holding live matches, so
    /// this is <b>not</b> <see cref="CancelledRecords.None"/> and a test that passed None would be
    /// asserting arithmetic no endpoint performs: a match tied to a cancelled space stops consuming the
    /// availability record's supply.
    /// </remarks>
    public static CancelledRecords Cancelled =>
        CancelledRecords.In(Data.ProcessorSpaces, Data.Availabilities);

    public static List<Match> MatchesForSpace(int spaceId) =>
        Data.Matches.Where(m => m.ProcessorSpaceId == spaceId).ToList();

    public static List<Match> MatchesForAvailability(int availabilityId) =>
        Data.Matches.Where(m => m.LivestockAvailabilityId == availabilityId).ToList();
}
