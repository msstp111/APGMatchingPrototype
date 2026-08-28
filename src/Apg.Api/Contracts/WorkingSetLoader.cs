using Apg.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Apg.Api.Contracts;

/// <summary>
/// Reads the whole working set in one pass.
/// </summary>
/// <remarks>
/// Six small tables and no joins. The prototype's dataset fits comfortably in memory, and the client
/// filters and sorts over it locally so that filtering feels instantaneous — which means the server's
/// job is to hand over everything, already computed, rather than to answer a query per interaction.
/// </remarks>
public sealed class WorkingSetLoader(ApgDbContext db)
{
    public async Task<WorkingSet> LoadAsync(CancellationToken cancellationToken = default) =>
        new(
            await db.ProcessorSpaces.AsNoTracking().ToListAsync(cancellationToken),
            await db.LivestockAvailabilities.AsNoTracking().ToListAsync(cancellationToken),
            await db.Matches.AsNoTracking().ToListAsync(cancellationToken),
            await db.Locations.AsNoTracking().ToListAsync(cancellationToken),
            await db.Farmers.AsNoTracking().ToListAsync(cancellationToken));
}
