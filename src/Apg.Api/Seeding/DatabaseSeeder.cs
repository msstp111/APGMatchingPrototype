using Apg.Api.Data;
using Apg.Domain.Entities;
using Apg.Domain.Time;
using Microsoft.EntityFrameworkCore;

namespace Apg.Api.Seeding;

/// <summary>
/// Creates the database if it does not exist and fills it when it is empty. The generation itself
/// lives in <see cref="SeedDataGenerator"/>, which knows nothing about EF Core.
/// </summary>
public class DatabaseSeeder(ApgDbContext db, TimeProvider clock, ILogger<DatabaseSeeder> logger)
{
    /// <summary>Creates the schema and seeds it if empty. Safe to call on every startup.</summary>
    public async Task EnsureSeededAsync(CancellationToken cancellationToken = default)
    {
        await db.Database.EnsureCreatedAsync(cancellationToken);

        if (await db.ProcessorSpaces.AnyAsync(cancellationToken))
        {
            return;
        }

        await SeedAsync(cancellationToken);
    }

    /// <summary>Drops the database, recreates it and re-seeds. Backs the reset endpoint.</summary>
    public async Task ResetAsync(CancellationToken cancellationToken = default)
    {
        await db.Database.EnsureDeletedAsync(cancellationToken);
        await db.Database.EnsureCreatedAsync(cancellationToken);
        await SeedAsync(cancellationToken);
    }

    private async Task SeedAsync(CancellationToken cancellationToken)
    {
        // The anchor is the Sunday of the current NEW ZEALAND week. Deriving it from a UTC clock
        // would put the whole dataset in the wrong week for twelve hours of every Saturday.
        var anchor = NzTime.CurrentWeekCommencing(clock);
        var locations = LoadLocations();
        var data = SeedDataGenerator.Generate(anchor, locations);

        db.Locations.AddRange(data.Locations);
        db.Farmers.AddRange(data.Farmers);
        db.ProcessorSpaces.AddRange(data.ProcessorSpaces);
        db.LivestockAvailabilities.AddRange(data.Availabilities);
        db.Matches.AddRange(data.Matches);
        db.PriceTableEntries.AddRange(data.Prices);

        await db.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Seeded {Locations} locations, {Farmers} farmers, {Spaces} processor spaces, "
            + "{Availabilities} availability records, {Matches} matches and {Prices} price rows, "
            + "anchored on week commencing {Anchor:yyyy-MM-dd}.",
            data.Locations.Count,
            data.Farmers.Count,
            data.ProcessorSpaces.Count,
            data.Availabilities.Count,
            data.Matches.Count,
            data.Prices.Count,
            anchor);
    }

    /// <summary>
    /// Reads every row of <c>Data/locations.csv</c>. That file is an export from APG's existing
    /// livestock <em>forecasting</em> system; only the id and name are used here, because its stock
    /// classes, statuses and transaction types belong to a different vocabulary entirely.
    /// </summary>
    public static List<Location> LoadLocations()
    {
        var path = Path.Combine(RepoPaths.FindDataDirectory(), "locations.csv");

        return CsvReader.Read(path)
            .Select(row => new Location
            {
                Id = int.Parse(row["id"]),
                Name = row["name"],
            })
            .OrderBy(l => l.Id)
            .ToList();
    }
}
