using System.Text.Json;
using AdventureCrafter.Core.Model;
using AdventureCrafter.Runtime.Assets;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace AdventureCrafter.Runtime.World;

/// <summary>
/// Placed-item loot on the current map: renders each item (first frame) Y-sorted into the map
/// renderer, and picks it up on walk-over (within 8·TILE_SCALE px), adding it to the inventory.
/// Dropped-item physics (from enemy kills) and the hotbar HUD come later.
/// </summary>
public sealed class ItemManager
{
    private sealed class ItemDef
    {
        public Texture2D? Tex;
        public Rectangle Frame0;
        public int FrameW = 16, FrameH = 16;
        public string Name = "";
        public int MaxStack = 99;
    }

    private sealed class Placed
    {
        public ItemDef Def = null!;
        public int ItemIndex;
        public float TileX, TileY;
        public bool Used;
    }

    private readonly RuntimeWorld _world;
    private readonly ItemDef?[] _defs;
    private readonly List<Placed> _placed = new();

    /// <summary>itemIndex -> total quantity held. The hotbar HUD/combat read this later.</summary>
    public readonly Dictionary<int, int> Inventory = new();
    public string? LastPickup { get; private set; }
    public double LastPickupAge { get; private set; } = 999;

    public ItemManager(ProjectData data, RuntimeWorld world, RuntimeAssets assets)
    {
        _world = world;
        _defs = new ItemDef?[data.Items?.Count ?? 0];
        for (int i = 0; i < _defs.Length; i++) _defs[i] = ParseDef(data.Items![i], assets);

        if (data.PlacedItems != null)
            foreach (var p in data.PlacedItems)
            {
                if (p.MapName != null && p.MapName != world.MapName) continue;
                int idx = p.ItemIndex ?? -1;
                if (idx < 0 || idx >= _defs.Length || _defs[idx] == null) continue;
                _placed.Add(new Placed
                {
                    Def = _defs[idx]!,
                    ItemIndex = idx,
                    TileX = (float)(p.X ?? 0),
                    TileY = (float)(p.Y ?? 0),
                    Used = p.Extra.TryGetValue("used", out var u) && u.ValueKind == JsonValueKind.True,
                });
            }
    }

    public void Update(double dt) => LastPickupAge += dt;

    /// <summary>
    /// INTERACT-driven pickup (checkItemInteraction): picks up an adjacent placed item (|dx|&lt;=1 &amp;&amp;
    /// |dy|&lt;=1) and returns its itemIndex, else -1. Called only when the player presses interact (A) —
    /// placed items do NOT auto-pickup; that proximity+plop path is for enemy DROPS only.
    /// </summary>
    public int TryPickup(int playerTileX, int playerTileY)
    {
        foreach (var p in _placed)
        {
            if (p.Used) continue;
            if (Math.Abs((int)p.TileX - playerTileX) <= 1 && Math.Abs((int)p.TileY - playerTileY) <= 1)
            {
                p.Used = true;
                AddToInventory(p.ItemIndex, 1);
                LastPickup = p.Def.Name;
                LastPickupAge = 0;
                return p.ItemIndex;
            }
        }
        return -1;
    }

    /// <summary>Texture + first-frame source rect + frame size for an item, for the floating pickup icon.</summary>
    public bool IconFor(int itemIndex, out Texture2D tex, out Rectangle src, out int frameW, out int frameH)
    {
        tex = null!; src = default; frameW = 16; frameH = 16;
        if (itemIndex < 0 || itemIndex >= _defs.Length || _defs[itemIndex]?.Tex == null) return false;
        var d = _defs[itemIndex]!;
        tex = d.Tex!; src = d.Frame0; frameW = d.FrameW; frameH = d.FrameH;
        return true;
    }

    private void AddToInventory(int itemIndex, int qty)
    {
        Inventory.TryGetValue(itemIndex, out int cur);
        Inventory[itemIndex] = cur + qty;
    }

    public void Add(int itemIndex, int qty) => AddToInventory(itemIndex, qty);
    public bool HasItem(int itemIndex) => Inventory.TryGetValue(itemIndex, out int c) && c > 0;
    public void Consume(int itemIndex, int qty)
    {
        if (!Inventory.TryGetValue(itemIndex, out int c)) return;
        int n = Math.Max(0, c - qty);
        if (n == 0) Inventory.Remove(itemIndex); else Inventory[itemIndex] = n;
    }

    public IEnumerable<MapRenderer.Entity> Entities(SpriteBatch sb, float camX, float camY)
    {
        foreach (var p in _placed)
        {
            if (p.Used) continue;
            var captured = p;
            yield return new MapRenderer.Entity((int)p.TileY + 1, 0.3f, () => DrawItem(sb, captured, camX, camY));
        }
    }

    private void DrawItem(SpriteBatch sb, Placed p, float camX, float camY)
    {
        if (p.Def.Tex == null) return;
        int tileSize = _world.TileSize, gridSize = _world.GridSize;
        int dx = (int)Math.Round(p.TileX * tileSize - camX);
        int dy = (int)Math.Round(p.TileY * tileSize - camY);
        int dw = (int)((float)p.Def.FrameW / gridSize * tileSize);
        int dh = (int)((float)p.Def.FrameH / gridSize * tileSize);
        sb.Draw(p.Def.Tex, new Rectangle(dx, dy, dw, dh), p.Def.Frame0, Color.White);
    }

    private static ItemDef ParseDef(Item item, RuntimeAssets assets)
    {
        var def = new ItemDef
        {
            Tex = assets.Texture(item.SpriteData),
            FrameW = item.FrameWidth ?? 16,
            FrameH = item.FrameHeight ?? 16,
            Name = item.Name ?? "Item",
            MaxStack = item.Extra.TryGetValue("maxStack", out var ms) && ms.ValueKind == JsonValueKind.Number ? ms.GetInt32() : 99,
        };
        if (item.Extra.TryGetValue("frames", out var fr) && fr.ValueKind == JsonValueKind.Array)
        {
            var first = fr.EnumerateArray().FirstOrDefault();
            if (first.ValueKind == JsonValueKind.Object)
                def.Frame0 = new Rectangle(JI(first, "x"), JI(first, "y"), JI(first, "w"), JI(first, "h"));
        }
        return def;
    }

    private static int JI(JsonElement e, string n) =>
        e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.Number
            ? (v.TryGetInt32(out int i) ? i : (int)v.GetDouble()) : 0;
}
