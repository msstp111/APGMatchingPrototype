using Apg.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Apg.Api.Data;

/// <summary>
/// The prototype's SQLite store.
/// </summary>
/// <remarks>
/// <para>
/// <strong>Raw values only.</strong> There is no matched-quantity column, no unmatched column and no
/// derived-status column anywhere in this schema. Every one of those is computed in
/// <c>Apg.Domain</c> on read. If a future phase finds itself adding a <c>QuantityMatched</c> column
/// to <see cref="ProcessorSpace"/>, that is the denormalisation the roadmap forbids — the two copies
/// drift and the numbers quietly disagree.
/// </para>
/// <para>
/// <see cref="Match"/> is a first-class entity with its own key, not a foreign key on either side.
/// Both sides are many-to-many through it, and cancelling either parent never cascades to it.
/// </para>
/// </remarks>
public class ApgDbContext(DbContextOptions<ApgDbContext> options) : DbContext(options)
{
    public DbSet<Location> Locations => Set<Location>();

    public DbSet<Farmer> Farmers => Set<Farmer>();

    public DbSet<ProcessorSpace> ProcessorSpaces => Set<ProcessorSpace>();

    public DbSet<LivestockAvailability> LivestockAvailabilities => Set<LivestockAvailability>();

    public DbSet<Match> Matches => Set<Match>();

    public DbSet<PriceTableEntry> PriceTableEntries => Set<PriceTableEntry>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Location>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
        });

        modelBuilder.Entity<Farmer>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired();
            entity.Property(e => e.Mobile).IsRequired();

            // Exactly one farmer per location (resolved question 10).
            entity.HasIndex(e => e.LocationId).IsUnique();
        });

        modelBuilder.Entity<ProcessorSpace>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Processor).IsRequired();
            entity.Property(e => e.Plant).IsRequired();
            entity.Property(e => e.StockClass).IsRequired();
            entity.Property(e => e.Status).HasConversion<string>();
            entity.HasIndex(e => e.DeliveryDate);
        });

        modelBuilder.Entity<LivestockAvailability>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.StockClass).IsRequired();
            entity.Property(e => e.Status).HasConversion<string>();
            entity.Property(e => e.TransactionType).HasConversion<string>();
            entity.HasIndex(e => e.AvailableFrom);
            entity.HasIndex(e => e.LocationId);
        });

        modelBuilder.Entity<Match>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Status).HasConversion<string>();
            entity.Property(e => e.CancellationReason).HasConversion<string>();
            entity.Property(e => e.PricePerKg).HasColumnType("decimal(10,2)");

            // Indexed both ways: every read walks the match set from one side or the other. No
            // navigation properties, because the relationship is many-to-many through this entity
            // and hanging collections off the parents invites exactly the foreign-key modelling the
            // roadmap rules out.
            entity.HasIndex(e => e.ProcessorSpaceId);
            entity.HasIndex(e => e.LivestockAvailabilityId);
        });

        modelBuilder.Entity<PriceTableEntry>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Processor).IsRequired();
            entity.Property(e => e.StockClass).IsRequired();
            entity.Property(e => e.PricePerKg).HasColumnType("decimal(10,2)");
            entity.HasIndex(e => new { e.Processor, e.StockClass, e.WeekCommencing }).IsUnique();
        });
    }
}
