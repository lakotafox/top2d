using System.Text.Json;

namespace AdventureCrafter.Core.Model;

/// <summary>
/// The complete Adventure Crafter project save — the C# mirror of the browser's getProjectData().
/// This is the portable contract between the editor and the runtime, and the single source of
/// truth both projects bind to. Dict-keyed structures use the save's composite string keys
/// ("tilesetIndex:x,y", "mapName:x,y"). Variant/uncertain interiors stay JsonElement for lossless
/// round-trip and get typed in M1/M2.
/// </summary>
public sealed class ProjectData : JsonModel
{
    // grid
    public int? GridSize { get; set; }
    public int? MapCols { get; set; }
    public int? MapRows { get; set; }

    // current-map snapshot (maps[currentMapName] is the durable copy)
    public List<List<List<JsonElement>>>? Layers { get; set; }
    public List<bool>? LayerVisibility { get; set; }
    public List<string>? LayerNames { get; set; }
    public int? CurrentLayer { get; set; }

    // collision / depth (composite string keys; values variant → raw)
    public Dictionary<string, JsonElement>? TileCollisions { get; set; }
    public Dictionary<string, JsonElement>? CollisionMasks { get; set; }
    public Dictionary<string, JsonElement>? TileSplitLines { get; set; }
    public Dictionary<string, JsonElement>? TileSplitLineFlipped { get; set; }

    // tilesets
    public List<Tileset>? Tilesets { get; set; }
    public int? CurrentTilesetIndex { get; set; }
    public string? TilesetData { get; set; }          // legacy

    // legacy prop palette
    public List<Prop>? Props { get; set; }
    public int? CurrentPropIndex { get; set; }
    public string? PropImageData { get; set; }
    public JsonElement? PropCollisionMasks { get; set; }

    // animated props
    public List<AnimatedProp>? AnimatedProps { get; set; }
    public int? CurrentAnimPropIndex { get; set; }
    public List<PlacedAnimProp>? PlacedAnimProps { get; set; }

    // npcs
    public List<Npc>? Npcs { get; set; }
    public int? CurrentNpcIndex { get; set; }
    public List<PlacedNpc>? PlacedNpcs { get; set; }

    // player placement
    public int? PlayerLayerIndex { get; set; }
    public Vec2? PlayerPreviewPos { get; set; }
    public string? SpawnMapName { get; set; }
    public bool? PlayerPreviewVisible { get; set; }

    // audio
    public List<Sound>? Sounds { get; set; }
    public Dictionary<string, TileSound>? TileSounds { get; set; }
    public PlayerSounds? PlayerSounds { get; set; }
    public List<QuestSound>? QuestSounds { get; set; }

    // lighting
    public LightingSettings? LightingSettings { get; set; }
    public Dictionary<string, PointLight>? PointLights { get; set; }
    public List<PolyLight>? PolyLights { get; set; }

    // player characters
    public string? PlayerSpriteData { get; set; }     // legacy
    public List<PlayerCharacter>? PlayerCharacters { get; set; }
    public int? ActivePlayerIndex { get; set; }

    // maps / transitions
    public Dictionary<string, MapData>? Maps { get; set; }
    public string? CurrentMapName { get; set; }
    public List<Trigger>? PlacedTriggers { get; set; }

    // dialogs
    public List<Dialog>? Dialogs { get; set; }
    public List<PlacedDialogTile>? PlacedDialogTiles { get; set; }

    // items
    public List<Item>? Items { get; set; }
    public List<PlacedItem>? PlacedItems { get; set; }
    public List<FishingLootEntry>? FishingLoot { get; set; }

    // static objects
    public List<StaticObject>? StaticObjects { get; set; }
    public List<PlacedStaticObject>? PlacedStaticObjects { get; set; }

    // shops
    public List<Shop>? Shops { get; set; }
    public List<PlacedShop>? PlacedShops { get; set; }
    public double? StartingGold { get; set; }

    // quests
    public List<Quest>? Quests { get; set; }

    // custom UI skins
    public JsonElement? UiConfig { get; set; }

    // versioning
    public int? Version { get; set; }                 // SAVE_SCHEMA_VERSION
    public string? GameVersion { get; set; }
    public double? SavedAt { get; set; }
}
