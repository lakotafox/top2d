using AdventureCrafter.Runtime;

// Usage: AdventureCrafter.Runtime [path-to-save.json]
// Defaults to the committed tiny fixture (port/fixtures/tiny.acproj.json), located by walking up
// from the executable directory.
string? path = args.Length > 0 ? args[0] : FindDefaultFixture();
if (path == null || !File.Exists(path))
{
    Console.Error.WriteLine("No project file found. Pass a path: AdventureCrafter.Runtime <save.json>");
    return;
}

using var game = new AcGame(path);
game.Run();

static string? FindDefaultFixture()
{
    var dir = new DirectoryInfo(AppContext.BaseDirectory);
    while (dir is not null)
    {
        var candidate = Path.Combine(dir.FullName, "fixtures", "tiny.acproj.json");
        if (File.Exists(candidate)) return candidate;
        dir = dir.Parent;
    }
    return null;
}
