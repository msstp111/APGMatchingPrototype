namespace Apg.Api.Seeding;

/// <summary>
/// Finds the repository's <c>Data/</c> directory. The CSVs live at the repo root, not beside the
/// built assembly, so resolve them by walking up from wherever the process happens to be running —
/// which differs between <c>dotnet run</c>, the test host and a published build.
/// </summary>
public static class RepoPaths
{
    private const string Marker = "locations.csv";

    public static string FindDataDirectory(string? startingAt = null)
    {
        var directory = new DirectoryInfo(startingAt ?? AppContext.BaseDirectory);

        while (directory is not null)
        {
            var candidate = Path.Combine(directory.FullName, "Data");
            if (File.Exists(Path.Combine(candidate, Marker)))
            {
                return candidate;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException(
            $"Could not find a Data directory containing {Marker} above '{startingAt ?? AppContext.BaseDirectory}'.");
    }
}
