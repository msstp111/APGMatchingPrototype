namespace Apg.Domain.Tests;

/// <summary>
/// Locates the repository root from the test host's output directory, so tests can read files that
/// live at the root rather than beside the assembly.
/// </summary>
public static class TestPaths
{
    public static string RepoRoot { get; } = Find();

    private static string Find()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null)
        {
            if (File.Exists(Path.Combine(directory.FullName, "ApgMatchingPrototype.sln")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new DirectoryNotFoundException(
            $"Could not find ApgMatchingPrototype.sln above '{AppContext.BaseDirectory}'.");
    }
}
