using AdventureCrafter.Core.Model;

namespace AdventureCrafter.Core.Serialization;

/// <summary>
/// Schema migration ladder, mirroring the browser's migrateProjectData(p). Each hop upgrades a
/// project from version N-1 to N. Currently SAVE_SCHEMA_VERSION = 1, so the ladder is a no-op;
/// add `if (v &lt; N) { ...; v = N; }` hops here as the structural schema evolves (additive field
/// growth needs no migration — JsonExtensionData carries it).
/// </summary>
public static class ProjectMigration
{
    public const int SaveSchemaVersion = 1;

    public static ProjectData Migrate(ProjectData p)
    {
        int v = p.Version ?? 1;
        // (no structural hops yet)
        p.Version = SaveSchemaVersion;
        return p;
    }
}
