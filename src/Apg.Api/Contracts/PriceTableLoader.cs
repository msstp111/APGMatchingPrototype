using Apg.Api.Data;
using Apg.Domain.Pricing;
using Microsoft.EntityFrameworkCore;

namespace Apg.Api.Contracts;

/// <summary>
/// Builds the seeded <see cref="PriceTable"/> for a request.
/// </summary>
/// <remarks>
/// Separate from <see cref="WorkingSetLoader"/> on purpose. Only the two write endpoints need a price,
/// the three read endpoints never look one up, and <see cref="WorkingSet"/> is a positional record
/// that several tests construct by hand — growing it would have changed every one of those call sites
/// to carry a list they do not use.
/// </remarks>
public sealed class PriceTableLoader(ApgDbContext db)
{
    public async Task<PriceTable> LoadAsync(CancellationToken cancellationToken = default) =>
        new(await db.PriceTableEntries.AsNoTracking().ToListAsync(cancellationToken));
}
