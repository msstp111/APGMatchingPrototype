using System.Text.Json;
using System.Text.Json.Serialization;

namespace Apg.Api.Contracts;

/// <summary>
/// The wire format, defined once so a test can assert against the same options the host actually
/// serialises with.
/// </summary>
/// <remarks>
/// Enums go over as strings, so the client's own types stay readable ("Drafted", not 0) and adding a
/// status later cannot silently renumber an existing one. <see cref="DateOnly"/> needs no converter:
/// System.Text.Json writes it as <c>yyyy-MM-dd</c> with no zone and no time, which is exactly what a
/// business date should look like on the wire.
/// </remarks>
public static class ApiJson
{
    public static void Configure(JsonSerializerOptions options) =>
        options.Converters.Add(new JsonStringEnumConverter());

    /// <summary>The same options, standalone, for tests and for anything serialising outside the host.</summary>
    public static JsonSerializerOptions Options { get; } = CreateOptions();

    private static JsonSerializerOptions CreateOptions()
    {
        // Matches the host's defaults for minimal APIs: camelCase property names.
        var options = new JsonSerializerOptions(JsonSerializerDefaults.Web);
        Configure(options);

        return options;
    }
}
