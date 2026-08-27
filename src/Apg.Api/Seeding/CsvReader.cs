namespace Apg.Api.Seeding;

/// <summary>
/// A deliberately small CSV reader for <c>Data/*.csv</c>. Those files are a clean machine export —
/// no embedded newlines — but they are quoted in places, so quoted fields are handled.
/// </summary>
public static class CsvReader
{
    /// <summary>Reads a CSV with a header row, returning each data row as a header-keyed lookup.</summary>
    public static List<Dictionary<string, string>> Read(string path)
    {
        var lines = File.ReadAllLines(path);
        var rows = new List<Dictionary<string, string>>();
        if (lines.Length == 0)
        {
            return rows;
        }

        var headers = SplitLine(lines[0]);

        for (var i = 1; i < lines.Length; i++)
        {
            if (string.IsNullOrWhiteSpace(lines[i]))
            {
                continue;
            }

            var fields = SplitLine(lines[i]);
            var row = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var c = 0; c < headers.Count; c++)
            {
                row[headers[c]] = c < fields.Count ? fields[c] : string.Empty;
            }

            rows.Add(row);
        }

        return rows;
    }

    private static List<string> SplitLine(string line)
    {
        var fields = new List<string>();
        var current = new System.Text.StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var ch = line[i];

            if (inQuotes)
            {
                if (ch == '"')
                {
                    if (i + 1 < line.Length && line[i + 1] == '"')
                    {
                        current.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    current.Append(ch);
                }
            }
            else if (ch == '"')
            {
                inQuotes = true;
            }
            else if (ch == ',')
            {
                fields.Add(current.ToString().Trim());
                current.Clear();
            }
            else
            {
                current.Append(ch);
            }
        }

        fields.Add(current.ToString().Trim());
        return fields;
    }
}
