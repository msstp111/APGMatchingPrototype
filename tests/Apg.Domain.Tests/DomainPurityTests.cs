using System.Reflection;
using Apg.Domain.Entities;

namespace Apg.Domain.Tests;

/// <summary>
/// Two invariants that are easy to lose by accident and expensive to lose: Apg.Domain must stay free
/// of infrastructure, and no computed value may ever be stored on an entity.
/// </summary>
public class DomainPurityTests
{
    private static readonly string[] ForbiddenReferencePrefixes =
    [
        "Microsoft.EntityFrameworkCore",
        "Microsoft.AspNetCore",
        "Microsoft.Extensions.DependencyInjection",
    ];

    [Fact]
    public void Apg_Domain_references_no_infrastructure_assemblies()
    {
        var referenced = typeof(ProcessorSpace).Assembly
            .GetReferencedAssemblies()
            .Select(a => a.Name ?? string.Empty)
            .ToList();

        var offenders = referenced
            .Where(name => ForbiddenReferencePrefixes.Any(p => name.StartsWith(p, StringComparison.Ordinal)))
            .ToList();

        Assert.True(
            offenders.Count == 0,
            $"Apg.Domain must stay pure C#. It references: {string.Join(", ", offenders)}");
    }

    [Fact]
    public void Apg_Domain_csproj_declares_no_package_or_project_references()
    {
        // The reference check above only sees what the compiler actually emitted, so a package that
        // is referenced but not yet used would slip past it. Read the project file too.
        var csproj = File.ReadAllText(Path.Combine(TestPaths.RepoRoot, "src", "Apg.Domain", "Apg.Domain.csproj"));

        Assert.DoesNotContain("PackageReference", csproj, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("ProjectReference", csproj, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Microsoft.NET.Sdk.Web", csproj, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Names that would mean a derived value had been persisted. Both matched sums, the unmatched
    /// figure and the derived availability status are computed on every read; storing any of them is
    /// the denormalisation that makes the numbers quietly disagree.
    /// </summary>
    private static readonly string[] ForbiddenPropertyFragments =
    [
        "Matched",
        "Unmatched",
        "InclDraft",
        "ExclDraft",
        "DerivedStatus",
        "Total",
        "Fill",
    ];

    [Theory]
    [InlineData(typeof(ProcessorSpace))]
    [InlineData(typeof(LivestockAvailability))]
    [InlineData(typeof(Match))]
    [InlineData(typeof(Location))]
    [InlineData(typeof(Farmer))]
    [InlineData(typeof(PriceTableEntry))]
    public void Entities_store_raw_values_only(Type entity)
    {
        var offenders = entity
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            // QuantityMatched is the match's OWN quantity — a raw value, and the only thing on this
            // side of the schema that legitimately carries the word.
            .Where(p => !(entity == typeof(Match) && p.Name == nameof(Match.QuantityMatched)))
            .Where(p => ForbiddenPropertyFragments.Any(f => p.Name.Contains(f, StringComparison.Ordinal)))
            .Select(p => p.Name)
            .ToList();

        Assert.True(
            offenders.Count == 0,
            $"{entity.Name} appears to persist a computed value: {string.Join(", ", offenders)}");
    }
}
