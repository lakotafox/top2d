using System.Text.Json;
using AdventureCrafter.Core.Model;
using AdventureCrafter.Runtime.Assets;
using Microsoft.Xna.Framework.Graphics;

namespace AdventureCrafter.Runtime.World;

/// <summary>One parsed map cell: a static "tile" or one sub-tile of an "animTile" (animated prop).</summary>
public readonly struct Cell
{
    public readonly string Type;
    public readonly int TilesetIndex;
    public readonly int X;          // tile: source pixel x within the tileset image
    public readonly int Y;          // tile: source pixel y within the tileset image
    public readonly int Rotation;   // degrees
    public readonly bool Flipped;   // horizontal

    // animTile fields
    public readonly int PropIndex;
    public readonly int OffsetX;    // this sub-tile's column within the multi-tile prop
    public readonly int OffsetY;    // this sub-tile's row within the multi-tile prop
    public readonly int TilesW;
    public readonly int TilesH;
    public readonly float Scale;    // per-instance scale (from prop center); default 1
    public readonly int NudgeX;     // per-instance pixel nudge (gridSize units)
    public readonly int NudgeY;
    public readonly bool Mirror;    // per-instance horizontal mirror of the whole prop

    public Cell(string type, int tilesetIndex, int x, int y, int rotation, bool flipped,
                int propIndex = 0, int offsetX = 0, int offsetY = 0, int tilesW = 1, int tilesH = 1,
                float scale = 1f, int nudgeX = 0, int nudgeY = 0, bool mirror = false)
    {
        Type = type; TilesetIndex = tilesetIndex; X = x; Y = y; Rotation = rotation; Flipped = flipped;
        PropIndex = propIndex; OffsetX = offsetX; OffsetY = offsetY; TilesW = tilesW; TilesH = tilesH;
        Scale = scale; NudgeX = nudgeX; NudgeY = nudgeY; Mirror = mirror;
    }

    public bool IsTile => Type == "tile";
    public bool IsAnimTile => Type == "animTile";
}

/// <summary>
/// The runtime view of a loaded project for M1: the current map's layers parsed into Cell grids,
/// decoded tileset textures, and the collision lookup. Mirrors the engine's coordinate model:
/// TILE_SCALE = 4, tileSize = gridSize * TILE_SCALE (= 64), player/world positions in scaled pixels.
/// Collision matches checkCollision() — 8 sample points, per-tileset pixel masks keyed
/// "tilesetIndex:srcX,srcY", solid-tile fallback, out-of-bounds = solid.
/// </summary>
public sealed class RuntimeWorld
{
    public const int TileScale = 4;

    public int GridSize { get; }
    public int TileSize { get; }
    public int MapCols { get; private set; }
    public int MapRows { get; private set; }
    public string MapName { get; private set; }

    public IReadOnlyList<Cell?[][]> Layers => _layers;     // [layer][y][x]
    public IReadOnlyList<bool> LayerVisibility => _layerVisibility;

    private readonly List<Cell?[][]> _layers = new();
    private readonly List<bool> _layerVisibility = new();

    private readonly HashSet<string> _solidTiles = new();              // "ti:srcX,srcY"
    private readonly Dictionary<string, bool[][]> _masks = new();      // "ti:srcX,srcY" -> 16x16
    private readonly Dictionary<string, int[]> _splitLines = new();    // "ti:srcX,srcY" -> per-column split Y (len gridSize)
    private readonly HashSet<string> _splitFlipped = new();
    private Texture2D?[] _tilesetTextures = Array.Empty<Texture2D?>();
    private AnimPropDef?[] _animProps = Array.Empty<AnimPropDef?>();

    private readonly ProjectData _data;

    public RuntimeWorld(ProjectData data)
    {
        _data = data;
        GridSize = data.GridSize ?? 16;
        TileSize = GridSize * TileScale;
        MapName = data.CurrentMapName ?? data.SpawnMapName ?? data.Maps?.Keys.FirstOrDefault() ?? "main";

        var map = (data.Maps != null && data.Maps.TryGetValue(MapName, out var m)) ? m : null;
        MapCols = map?.MapCols ?? data.MapCols ?? 0;
        MapRows = map?.MapRows ?? data.MapRows ?? 0;

        ParseLayers(map?.Layers ?? data.Layers, map?.LayerVisibility ?? data.LayerVisibility);
        BuildCollision();
    }

    /// <summary>
    /// Switch to another map at runtime (door transition). Collision/split-lines/tilesets/anim props
    /// are GLOBAL (per-tileset/project) and persist; only the layers + map dimensions change here.
    /// Placed entities (NPCs, lights, triggers) re-filter by MapName automatically.
    /// </summary>
    public void SwitchMap(string mapName)
    {
        if (_data.Maps == null || !_data.Maps.TryGetValue(mapName, out var map)) return;
        MapName = mapName;
        MapCols = map.MapCols ?? MapCols;
        MapRows = map.MapRows ?? MapRows;
        _layers.Clear();
        _layerVisibility.Clear();
        ParseLayers(map.Layers, map.LayerVisibility);
    }

    public bool HasMap(string mapName) => _data.Maps?.ContainsKey(mapName) ?? false;

    /// <summary>Placed triggers/doors on the current map.</summary>
    public IEnumerable<Trigger> TriggersForMap()
    {
        if (_data.PlacedTriggers == null) yield break;
        foreach (var t in _data.PlacedTriggers)
            if (t.MapName == MapName) yield return t;
    }

    private void ParseLayers(List<List<List<JsonElement>>>? layers, List<bool>? visibility)
    {
        if (layers == null) return;
        for (int li = 0; li < layers.Count; li++)
        {
            var srcLayer = layers[li];
            var grid = new Cell?[srcLayer.Count][];
            for (int y = 0; y < srcLayer.Count; y++)
            {
                var srcRow = srcLayer[y];
                var row = new Cell?[srcRow.Count];
                for (int x = 0; x < srcRow.Count; x++)
                    row[x] = ParseCell(srcRow[x]);
                grid[y] = row;
            }
            _layers.Add(grid);
            _layerVisibility.Add(visibility == null || li >= visibility.Count || visibility[li]);
        }
    }

    private static Cell? ParseCell(JsonElement e)
    {
        if (e.ValueKind != JsonValueKind.Object) return null;
        string type = e.TryGetProperty("type", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString()! : "tile";
        return new Cell(
            type,
            JInt(e, "tilesetIndex"),
            JInt(e, "x"),
            JInt(e, "y"),
            JInt(e, "rotation"),
            e.TryGetProperty("flipped", out var f) && f.ValueKind == JsonValueKind.True,
            JInt(e, "propIndex"),
            JInt(e, "offsetX"),
            JInt(e, "offsetY"),
            e.TryGetProperty("tilesW", out _) ? JInt(e, "tilesW") : 1,
            e.TryGetProperty("tilesH", out _) ? JInt(e, "tilesH") : 1,
            e.TryGetProperty("scale", out var sc) && sc.ValueKind == JsonValueKind.Number ? (float)sc.GetDouble() : 1f,
            JInt(e, "nudgeX"),
            JInt(e, "nudgeY"),
            e.TryGetProperty("mirror", out var mr) && mr.ValueKind == JsonValueKind.True);
    }

    private void BuildCollision()
    {
        if (_data.TileCollisions != null)
            foreach (var (key, v) in _data.TileCollisions)
                if (Truthy(v)) _solidTiles.Add(key);

        if (_data.CollisionMasks != null)
            foreach (var (key, v) in _data.CollisionMasks)
            {
                var mask = DecodeMask(v);
                if (mask != null) _masks[key] = mask;
            }

        if (_data.TileSplitLines != null)
            foreach (var (key, v) in _data.TileSplitLines)
            {
                var arr = ResolveSplitArray(v);
                if (arr != null) _splitLines[key] = arr;
            }

        if (_data.TileSplitLineFlipped != null)
            foreach (var (key, v) in _data.TileSplitLineFlipped)
                if (Truthy(v)) _splitFlipped.Add(key);
    }

    public int[]? SplitLine(string key) => _splitLines.TryGetValue(key, out var a) ? a : null;
    public bool IsSplitFlipped(string key) => _splitFlipped.Contains(key);

    // ---- lighting ----
    public bool PlayerLight => _data.LightingSettings?.PlayerLight ?? false;
    public double PlayerLightRadius => _data.LightingSettings?.PlayerLightRadius ?? 2;

    public readonly record struct PointLightPlacement(int TileX, int TileY, double RadiusTiles);

    /// <summary>Point lights placed on the current map (keys are "mapName:x,y").</summary>
    public IEnumerable<PointLightPlacement> PointLightsForMap()
    {
        if (_data.PointLights == null) yield break;
        string prefix = MapName + ":";
        foreach (var (key, light) in _data.PointLights)
        {
            if (!key.StartsWith(prefix, StringComparison.Ordinal)) continue;
            string coords = key.Substring(prefix.Length);
            int comma = coords.IndexOf(',');
            if (comma < 0) continue;
            // Keys can be fractional ("21.50,45.45"); the engine uses parseInt (truncates), so do the same.
            if (double.TryParse(coords.AsSpan(0, comma), System.Globalization.CultureInfo.InvariantCulture, out double lx) &&
                double.TryParse(coords.AsSpan(comma + 1), System.Globalization.CultureInfo.InvariantCulture, out double ly))
                yield return new PointLightPlacement((int)lx, (int)ly, light.Radius ?? 3);
        }
    }

    // resolveSplitArray: a number fills all columns; an array is per-column split Y (clamped 0..gridSize).
    private int[]? ResolveSplitArray(JsonElement v)
    {
        if (v.ValueKind == JsonValueKind.Number)
        {
            int n = Math.Clamp((int)v.GetDouble(), 0, GridSize);
            var a = new int[GridSize];
            Array.Fill(a, n);
            return a;
        }
        if (v.ValueKind == JsonValueKind.Array)
        {
            var a = new int[GridSize];
            Array.Fill(a, GridSize); // default: full canopy (no trunk) for any missing column
            int i = 0;
            foreach (var e in v.EnumerateArray())
            {
                if (i >= GridSize) break;
                a[i++] = e.ValueKind == JsonValueKind.Number ? Math.Clamp((int)e.GetDouble(), 0, GridSize) : GridSize;
            }
            return a;
        }
        return null;
    }

    public void LoadTextures(RuntimeAssets assets)
    {
        var tilesets = _data.Tilesets;
        if (tilesets != null)
        {
            _tilesetTextures = new Texture2D?[tilesets.Count];
            for (int i = 0; i < tilesets.Count; i++)
                _tilesetTextures[i] = assets.Texture(tilesets[i].Data);
        }

        var props = _data.AnimatedProps;
        if (props != null)
        {
            _animProps = new AnimPropDef?[props.Count];
            for (int i = 0; i < props.Count; i++)
                _animProps[i] = AnimPropDef.Parse(props[i], assets);
        }
    }

    public Texture2D? TilesetTexture(int index) =>
        index >= 0 && index < _tilesetTextures.Length ? _tilesetTextures[index] : null;

    public AnimPropDef? AnimProp(int index) =>
        index >= 0 && index < _animProps.Length ? _animProps[index] : null;

    /// <summary>Current frame index for a looping animated prop at the given elapsed time.</summary>
    public int AnimFrameIndex(int propIndex, double elapsedSeconds)
    {
        var p = AnimProp(propIndex);
        if (p == null || p.Frames.Count <= 1 || p.Fps <= 0) return 0;
        return (int)(elapsedSeconds * p.Fps) % p.Frames.Count;
    }

    /// <summary>Player spawn in scaled world pixels (playerPreviewPos is in tiles).</summary>
    public (float x, float y) PlayerSpawn()
    {
        double px = _data.PlayerPreviewPos?.X ?? MapCols / 2.0;
        double py = _data.PlayerPreviewPos?.Y ?? MapRows / 2.0;
        return ((float)(px * TileSize), (float)(py * TileSize));
    }

    // checkCollision(x,y,w,h): true if the foot hitbox overlaps any solid tile/mask or goes OOB.
    public bool Collides(float x, float y, float w, float h)
    {
        int pixelScale = TileScale; // tileSize / gridSize
        Span<(float px, float py)> pts = stackalloc (float, float)[8];
        pts[0] = (x, y);
        pts[1] = (x + w - 1, y);
        pts[2] = (x, y + h - 1);
        pts[3] = (x + w - 1, y + h - 1);
        pts[4] = (x + w / 2, y);
        pts[5] = (x + w / 2, y + h - 1);
        pts[6] = (x, y + h / 2);
        pts[7] = (x + w - 1, y + h / 2);

        foreach (var (ppx, ppy) in pts)
        {
            int tileX = (int)Math.Floor(ppx / TileSize);
            int tileY = (int)Math.Floor(ppy / TileSize);
            if (tileX < 0 || tileX >= MapCols || tileY < 0 || tileY >= MapRows) return true;

            foreach (var layer in _layers)
            {
                if (tileY >= layer.Length) continue;
                var row = layer[tileY];
                if (row == null || tileX >= row.Length) continue;
                var cell = row[tileX];
                if (cell is not { IsTile: true } c) continue;

                string key = $"{c.TilesetIndex}:{c.X},{c.Y}";
                if (_masks.TryGetValue(key, out var mask))
                {
                    int lx = (int)Math.Floor((ppx % TileSize) / pixelScale);
                    int ly = (int)Math.Floor((ppy % TileSize) / pixelScale);
                    if (ly >= 0 && ly < mask.Length && lx >= 0 && lx < mask[ly].Length && mask[ly][lx])
                        return true;
                }
                else if (_solidTiles.Contains(key))
                {
                    return true;
                }
            }
        }
        return false;
    }

    // ---- helpers ----

    private static int JInt(JsonElement e, string name)
    {
        if (!e.TryGetProperty(name, out var v) || v.ValueKind != JsonValueKind.Number) return 0;
        return v.TryGetInt32(out int i) ? i : (int)v.GetDouble();
    }

    private static bool Truthy(JsonElement v) => v.ValueKind switch
    {
        JsonValueKind.True => true,
        JsonValueKind.Number => v.GetDouble() != 0,
        JsonValueKind.String => !string.IsNullOrEmpty(v.GetString()),
        _ => false,
    };

    private static bool[][]? DecodeMask(JsonElement v)
    {
        if (v.ValueKind != JsonValueKind.Array) return null;
        var rows = new List<bool[]>();
        foreach (var rowEl in v.EnumerateArray())
        {
            if (rowEl.ValueKind != JsonValueKind.Array) { rows.Add(Array.Empty<bool>()); continue; }
            var cols = new List<bool>();
            foreach (var cell in rowEl.EnumerateArray()) cols.Add(Truthy(cell));
            rows.Add(cols.ToArray());
        }
        return rows.ToArray();
    }
}
