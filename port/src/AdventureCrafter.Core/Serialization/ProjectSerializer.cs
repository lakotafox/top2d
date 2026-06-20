using System.Text.Json;
using System.Text.Json.Serialization;
using AdventureCrafter.Core.Model;

namespace AdventureCrafter.Core.Serialization;

/// <summary>
/// Loads/saves <see cref="ProjectData"/> to the same JSON shape the browser produces. Options are
/// tuned for LOSSLESS round-trip: camelCase names (matching JS keys) and null-omission (an absent
/// source field stays null and is not re-emitted), so the only legitimate differences vs the
/// source are key ordering and whitespace — which the structural comparer ignores.
/// </summary>
public static class ProjectSerializer
{
    public static readonly JsonSerializerOptions Options = CreateOptions(indented: false);
    public static readonly JsonSerializerOptions IndentedOptions = CreateOptions(indented: true);

    private static JsonSerializerOptions CreateOptions(bool indented) => new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = indented,
        // JS JSON.stringify escapes minimally; we compare structurally so escaping is irrelevant,
        // but use the relaxed encoder so saved files read closer to the browser's output.
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static ProjectData Deserialize(string json) =>
        JsonSerializer.Deserialize<ProjectData>(json, Options)
            ?? throw new InvalidOperationException("Project JSON deserialized to null.");

    public static string Serialize(ProjectData data, bool indented = false) =>
        JsonSerializer.Serialize(data, indented ? IndentedOptions : Options);

    public static ProjectData Load(string path) => Deserialize(File.ReadAllText(path));

    public static void Save(string path, ProjectData data, bool indented = true) =>
        File.WriteAllText(path, Serialize(data, indented));
}
