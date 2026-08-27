using Apg.Domain.Entities;

namespace Apg.Api.Seeding;

/// <summary>
/// The generated demo dataset as a plain object graph — no <c>DbContext</c>, which is what lets the
/// section 4.7 demonstration cases be proven by a test rather than by eyeballing the database.
/// </summary>
public sealed record SeedData(
    DateOnly AnchorWeekCommencing,
    IReadOnlyList<Location> Locations,
    IReadOnlyList<Farmer> Farmers,
    IReadOnlyList<ProcessorSpace> ProcessorSpaces,
    IReadOnlyList<LivestockAvailability> Availabilities,
    IReadOnlyList<Match> Matches,
    IReadOnlyList<PriceTableEntry> Prices);
