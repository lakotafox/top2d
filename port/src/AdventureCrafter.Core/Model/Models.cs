using System.Text.Json;

namespace AdventureCrafter.Core.Model;

// Lean, lossless model classes mirroring the entities in getProjectData().
// Convention for M0:
//   • All promoted scalars are NULLABLE so an absent source field stays null and is omitted on
//     re-serialize (paired with DefaultIgnoreCondition.WhenWritingNull) — keeps round-trip exact.
//   • Genuinely variant / not-yet-needed structures stay as JsonElement (inherently lossless);
//     they get promoted to typed shapes in M1/M2 once verified against real save data.
//   • Everything else lands in JsonModel.Extra and re-emits verbatim.

// ---- tiles / maps ----

public sealed class Tileset : JsonModel
{
    public string? Name { get; set; }
    public string? Data { get; set; }   // base64 data: URL (PNG)
}

public sealed class Prop : JsonModel    // legacy prop palette
{
    public string? Name { get; set; }
    public string? Data { get; set; }
}

public sealed class Vec2 : JsonModel
{
    public double? X { get; set; }
    public double? Y { get; set; }
}

public sealed class MapData : JsonModel
{
    // layers = array of 2D grids: layer[y][x] = cell | null. Cells are variant
    // (tile / animTile / prop); kept raw for M0, typed in M1 when tiles render.
    public List<List<List<JsonElement>>>? Layers { get; set; }
    public List<bool>? LayerVisibility { get; set; }
    public List<string>? LayerNames { get; set; }
    public int? CurrentLayer { get; set; }
    public int? MapCols { get; set; }
    public int? MapRows { get; set; }
    public JsonElement? CameraBounds { get; set; }
    public JsonElement? FishZones { get; set; }
}

// ---- player / npc ----

public sealed class PlayerCharacter : JsonModel
{
    public string? Name { get; set; }
    public string? SpriteData { get; set; }
    public int? FrameWidth { get; set; }
    public int? FrameHeight { get; set; }
    public double? Fps { get; set; }
    // animations: dict of action -> frame list (number[] or {x,y,w,h}[]); variant, kept raw.
    public Dictionary<string, JsonElement>? Animations { get; set; }
}

public sealed class Npc : JsonModel
{
    public string? Name { get; set; }
    public string? SpriteData { get; set; }
    public int? FrameWidth { get; set; }
    public int? FrameHeight { get; set; }
    public double? Fps { get; set; }
    public Dictionary<string, JsonElement>? Animations { get; set; }
}

public sealed class PlacedNpc : JsonModel
{
    public int? NpcIndex { get; set; }
    public string? MapName { get; set; }
    public double? X { get; set; }
    public double? Y { get; set; }
    public string? Uid { get; set; }
}

// ---- items / props / static objects ----

public sealed class Item : JsonModel
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? SpriteData { get; set; }
    public int? FrameWidth { get; set; }
    public int? FrameHeight { get; set; }
}

public sealed class PlacedItem : JsonModel
{
    public int? ItemIndex { get; set; }
    public string? MapName { get; set; }
    public double? X { get; set; }
    public double? Y { get; set; }
}

public sealed class AnimatedProp : JsonModel
{
    public string? Name { get; set; }
    public string? SpriteData { get; set; }
}

public sealed class PlacedAnimProp : JsonModel
{
    public int? PropIndex { get; set; }
    public string? MapName { get; set; }
    public double? X { get; set; }
    public double? Y { get; set; }
}

public sealed class StaticObject : JsonModel
{
    public string? Name { get; set; }
    public string? SpriteData { get; set; }
}

public sealed class PlacedStaticObject : JsonModel
{
    public int? ObjIndex { get; set; }
    public string? MapName { get; set; }
    public double? X { get; set; }
    public double? Y { get; set; }
}

public sealed class FishingLootEntry : JsonModel
{
    public int? ItemIndex { get; set; }
    public double? Weight { get; set; }
}

// ---- narrative ----

public sealed class Dialog : JsonModel
{
    public string? Name { get; set; }
}

public sealed class PlacedDialogTile : JsonModel
{
    public int? DialogIndex { get; set; }
    public string? MapName { get; set; }
    public double? X { get; set; }
    public double? Y { get; set; }
}

public sealed class Quest : JsonModel
{
    public string? Id { get; set; }
    public string? Name { get; set; }
}

public sealed class Shop : JsonModel
{
    public string? Id { get; set; }
    public string? Name { get; set; }
}

public sealed class PlacedShop : JsonModel
{
    public int? ShopIndex { get; set; }
    public string? MapName { get; set; }
    public double? X { get; set; }
    public double? Y { get; set; }
}

// ---- audio ----

public sealed class Sound : JsonModel
{
    public string? Name { get; set; }
    public string? Data { get; set; }     // base64 data: URL (audio)
    public double? Duration { get; set; }
    public string? Type { get; set; }
}

public sealed class QuestSound : JsonModel
{
    public string? Name { get; set; }
    public string? Data { get; set; }
}

public sealed class TileSound : JsonModel
{
    public int? SoundIndex { get; set; }
    public double? Radius { get; set; }
    public bool? Loop { get; set; }
    public double? Volume { get; set; }
}

public sealed class PlayerSounds : JsonModel { }   // nested walk/attack/inventory configs → Extra

// ---- lighting ----

public sealed class LightingSettings : JsonModel
{
    public bool? PlayerLight { get; set; }
    public double? PlayerLightRadius { get; set; }
}

public sealed class PointLight : JsonModel
{
    public double? Radius { get; set; }
    public bool? Flicker { get; set; }
    public double? FlickerIntensity { get; set; }
}

public sealed class PolyLight : JsonModel
{
    public string? Id { get; set; }
    public string? MapName { get; set; }
    public JsonElement? Points { get; set; }
}

// ---- triggers ----

public sealed class Trigger : JsonModel
{
    public double? X { get; set; }
    public double? Y { get; set; }
    public double? Width { get; set; }
    public double? Height { get; set; }
    public string? MapName { get; set; }
    public string? Type { get; set; }
    public string? TargetMap { get; set; }
    public double? TargetX { get; set; }
    public double? TargetY { get; set; }
    public int? DoorNumber { get; set; }
    public string? Uid { get; set; }
}
