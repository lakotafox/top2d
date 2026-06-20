using System.Text.Json;
using System.Text.Json.Serialization;

namespace AdventureCrafter.Core.Model;

/// <summary>
/// Base for every save-format model class. The <see cref="Extra"/> dictionary captures any JSON
/// field not promoted to a typed C# property and re-emits it verbatim on serialize. This is the
/// C# equivalent of the browser's "spread-with-strip" pattern and structurally eliminates the
/// project's #1 documented bug class — the load-path field drop ("works in Test Map, breaks after
/// reload"). New/unknown fields survive the round-trip for free; we promote them to typed
/// properties only as the Runtime/Editor actually need them.
/// </summary>
public abstract class JsonModel
{
    [JsonExtensionData]
    public Dictionary<string, JsonElement> Extra { get; set; } = new();
}
