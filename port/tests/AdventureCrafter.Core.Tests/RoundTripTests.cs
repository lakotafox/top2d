using AdventureCrafter.Core.Assets;
using AdventureCrafter.Core.Serialization;
using Xunit;

namespace AdventureCrafter.Core.Tests;

public class RoundTripTests
{
    // Locate the port/fixtures directory by walking up from the test assembly location.
    private static string FixturesDir()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "fixtures");
            if (Directory.Exists(candidate) &&
                Directory.EnumerateFiles(candidate, "*.json").Any())
                return candidate;
            dir = dir.Parent;
        }
        throw new DirectoryNotFoundException("Could not locate port/fixtures with *.json files.");
    }

    public static IEnumerable<object[]> AllFixtures()
    {
        foreach (var path in Directory.EnumerateFiles(FixturesDir(), "*.json"))
            yield return new object[] { Path.GetFileName(path) };
    }

    // THE M0 GATE: every fixture must deserialize into ProjectData and re-serialize to a
    // structurally-identical document (no field drop, no spurious additions).
    [Theory]
    [MemberData(nameof(AllFixtures))]
    public void RoundTrips_Losslessly(string fixtureName)
    {
        string path = Path.Combine(FixturesDir(), fixtureName);
        string original = File.ReadAllText(path);

        var project = ProjectSerializer.Deserialize(original);
        string reserialized = ProjectSerializer.Serialize(project);

        bool equal = JsonStructuralComparer.Equal(original, reserialized, out string? firstDiff);
        Assert.True(equal, $"{fixtureName} not lossless. First diff: {firstDiff}");
    }

    // Round-trips a real save pointed to by the AC_ROUNDTRIP_FILE env var, so a large external
    // fixture can be validated without committing it into the repo. No-ops if the var is unset.
    [Fact]
    public void RoundTrips_ExternalFile_IfProvided()
    {
        string? path = Environment.GetEnvironmentVariable("AC_ROUNDTRIP_FILE");
        if (string.IsNullOrEmpty(path) || !File.Exists(path)) return;

        string original = File.ReadAllText(path);
        var project = ProjectSerializer.Deserialize(original);
        string reserialized = ProjectSerializer.Serialize(project);

        bool equal = JsonStructuralComparer.Equal(original, reserialized, out string? firstDiff);
        Assert.True(equal, $"{Path.GetFileName(path)} not lossless. First diff: {firstDiff}");
    }

    [Fact]
    public void DataUrl_Decode_Roundtrips()
    {
        byte[] bytes = { 1, 2, 3, 250, 0, 99 };
        string url = DataUrlCodec.Encode(bytes, "image/png");
        Assert.True(DataUrlCodec.IsDataUrl(url));

        var decoded = DataUrlCodec.TryDecode(url);
        Assert.NotNull(decoded);
        Assert.Equal("image/png", decoded!.Value.MimeType);
        Assert.Equal(bytes, decoded.Value.Bytes);
    }

    [Fact]
    public void DataUrl_NonDataUrl_ReturnsNull()
    {
        Assert.Null(DataUrlCodec.TryDecode("not a data url"));
        Assert.Null(DataUrlCodec.TryDecode(""));
        Assert.False(DataUrlCodec.IsDataUrl("http://x/y.png"));
    }

    [Fact]
    public void Migration_StampsCurrentVersion()
    {
        var project = ProjectSerializer.Deserialize("{\"version\":1}");
        var migrated = ProjectMigration.Migrate(project);
        Assert.Equal(ProjectMigration.SaveSchemaVersion, migrated.Version);
    }
}
