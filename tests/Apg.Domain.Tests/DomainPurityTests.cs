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

    /// <summary>
    /// Ways of reading the real clock. Each of them makes "today" a property of the machine and its
    /// timezone rather than of New Zealand, and each makes a test flaky on exactly the day the New
    /// Zealand week has turned over while UTC has not.
    /// </summary>
    private static readonly string[] ForbiddenClockCalls =
    [
        "DateTime.Now",
        "DateTime.Today",
        "DateTime.UtcNow",
        "DateTimeOffset.Now",
        "DateTimeOffset.UtcNow",
        "TimeProvider.System",
    ];

    /// <summary>
    /// The acceptance criterion made mechanical. A clock is injected as a
    /// <see cref="TimeProvider"/>; nothing in the domain reaches for the ambient one.
    /// </summary>
    [Fact]
    public void No_domain_source_file_reads_the_real_clock()
    {
        var domainSource = Path.Combine(TestPaths.RepoRoot, "src", "Apg.Domain");

        var offenders = Directory
            .EnumerateFiles(domainSource, "*.cs", SearchOption.AllDirectories)
            // obj/ holds generated assembly attributes, not code anyone wrote.
            .Where(path => !path.Contains($"{Path.DirectorySeparatorChar}obj{Path.DirectorySeparatorChar}"))
            .Select(path => (Path: path, Lines: File.ReadAllLines(path)))
            .SelectMany(file => file.Lines.Select((line, index) => (file.Path, Line: line, Number: index + 1)))
            // The names appear in prose in the XML docs explaining why they are absent.
            .Where(x => !x.Line.TrimStart().StartsWith("///", StringComparison.Ordinal))
            .Where(x => ForbiddenClockCalls.Any(call => x.Line.Contains(call, StringComparison.Ordinal)))
            .Select(x => $"{Path.GetFileName(x.Path)}:{x.Number}")
            .ToList();

        Assert.True(
            offenders.Count == 0,
            $"Apg.Domain must take its clock as a TimeProvider. Real-clock reads at: {string.Join(", ", offenders)}");
    }
}
