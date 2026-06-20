using System.Text.Json;
using AdventureCrafter.Core.Model;
using AdventureCrafter.Core.Shared;
using AdventureCrafter.Runtime.Assets;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace AdventureCrafter.Runtime.World;

/// <summary>
/// Renders placed NPCs on the current map, Y-sorted into the map renderer (drawNPC). M2 v1 shows
/// them idling in place with their idle animation; path following + enemy AI build on top of this
/// (the runtime state struct already carries the fields they need).
/// </summary>
public sealed class NpcManager
{
    private sealed class NpcDef
    {
        public Texture2D? Tex;
        public Dictionary<string, Rectangle[]> Anims = new();
        public Dictionary<string, bool> Mirrors = new();
        public double Fps = 8;
        public bool NoShadow;
        public float ShadowW = 0.35f, ShadowH = 0.12f, ShadowOffX, ShadowOffY = 4f;

        public bool HasDiagonals;
        public bool Has(string k) => Anims.TryGetValue(k, out var a) && a.Length > 0;
        public Rectangle[]? Anim(string k) => Anims.TryGetValue(k, out var a) ? a : null;
    }

    private sealed class Instance
    {
        public NpcDef Def = null!;
        public float X, Y;            // unscaled pixels (placed.x * gridSize)
        public float OriginX, OriginY;
        public string Direction = "down";
        public bool Moving;
        public float Scale = 1f;
        public List<Vector2> Path = new();   // tile coords
        public float Speed = 1.5f;           // unscaled px/frame
        public bool Triggered;               // 'loop' patrols start immediately
        public int CurrentWaypoint;
    }

    private readonly RuntimeWorld _world;
    private readonly Texture2D _ellipse;
    private readonly List<Instance> _instances = new();

    public NpcManager(ProjectData data, RuntimeWorld world, RuntimeAssets assets, Texture2D ellipse)
    {
        _world = world;
        _ellipse = ellipse;
        int gridSize = world.GridSize;

        var defs = new NpcDef?[data.Npcs?.Count ?? 0];
        for (int i = 0; i < defs.Length; i++) defs[i] = ParseDef(data.Npcs![i], assets);

        if (data.PlacedNpcs != null)
            foreach (var p in data.PlacedNpcs)
            {
                if (p.MapName != null && p.MapName != world.MapName) continue;
                int idx = p.NpcIndex ?? -1;
                if (idx < 0 || idx >= defs.Length || defs[idx] == null) continue;

                float ox = (float)((p.X ?? 0) * gridSize);
                float oy = (float)((p.Y ?? 0) * gridSize);
                var inst = new Instance
                {
                    Def = defs[idx]!,
                    X = ox, Y = oy, OriginX = ox, OriginY = oy,
                    Scale = (float)(GetNum(p.Extra, "scale") ?? 1.0),
                    Speed = (float)((GetNum(p.Extra, "speed") ?? 3.0) * 0.5),
                };
                // patrol path (tile coords)
                if (p.Extra.TryGetValue("path", out var path) && path.ValueKind == JsonValueKind.Array)
                    foreach (var wp in path.EnumerateArray())
                        if (wp.ValueKind == JsonValueKind.Object)
                            inst.Path.Add(new Vector2(JF(wp, "x"), JF(wp, "y")));
                string trigger = p.Extra.TryGetValue("trigger", out var tr) && tr.ValueKind == JsonValueKind.String ? tr.GetString()! : "loop";
                inst.Triggered = trigger == "loop";   // loop patrols start immediately; other triggers TODO
                _instances.Add(inst);
            }
    }

    /// <summary>
    /// Advance NPC patrols (loop paths). dt scales the per-frame step to be framerate-independent.
    /// playerFoot is the player's foot hitbox (scaled px) so an NPC stops instead of walking into you.
    /// </summary>
    public void Update(double dt, float footX, float footY, float footW, float footH)
    {
        int gridSize = _world.GridSize;
        float step60 = (float)(dt * 60);
        foreach (var inst in _instances)
        {
            if (!inst.Triggered || inst.Path.Count == 0) { inst.Moving = false; continue; }

            var wp = inst.Path[inst.CurrentWaypoint % inst.Path.Count];
            float tx = wp.X * gridSize, ty = wp.Y * gridSize;
            float dx = tx - inst.X, dy = ty - inst.Y;
            float dist = MathF.Sqrt(dx * dx + dy * dy);
            float step = inst.Speed * step60;

            if (dist < Math.Max(step, 0.0001f))
            {
                inst.X = tx; inst.Y = ty;
                inst.CurrentWaypoint++;
                if (inst.CurrentWaypoint >= inst.Path.Count) { inst.CurrentWaypoint = 0; inst.X = inst.OriginX; inst.Y = inst.OriginY; }
                inst.Moving = false;
            }
            else
            {
                float nx = inst.X + dx / dist * step;
                float ny = inst.Y + dy / dist * step;
                inst.Direction = DirectionHelper.Dir8FromVector(dx, dy, inst.Def.HasDiagonals) ?? inst.Direction;
                if (BoxHitsFoot(nx, ny, inst, footX, footY, footW, footH)) inst.Moving = false;
                else { inst.X = nx; inst.Y = ny; inst.Moving = true; }
            }
        }
    }

    /// <summary>True if the given foot hitbox (scaled px) overlaps any NPC's body box.</summary>
    public bool NpcCollides(float footX, float footY, float footW, float footH)
    {
        foreach (var inst in _instances)
            if (BoxHitsFoot(inst.X, inst.Y, inst, footX, footY, footW, footH)) return true;
        return false;
    }

    // NPC body box (no insets) at unscaled (nx,ny), in scaled px; AABB vs the foot hitbox.
    private bool BoxHitsFoot(float nx, float ny, Instance inst, float footX, float footY, float footW, float footH)
    {
        int tileSize = _world.TileSize;
        float scaled = tileSize * inst.Scale;
        float boxX = nx * RuntimeWorld.TileScale + (tileSize - scaled) / 2f;
        float boxY = ny * RuntimeWorld.TileScale + tileSize - scaled;
        return footX < boxX + scaled && footX + footW > boxX &&
               footY < boxY + scaled && footY + footH > boxY;
    }

    private static float JF(JsonElement e, string n) =>
        e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.Number ? (float)v.GetDouble() : 0f;

    public IEnumerable<MapRenderer.Entity> Entities(SpriteBatch sb, float camX, float camY, double elapsed)
    {
        int gridSize = _world.GridSize;
        foreach (var inst in _instances)
        {
            int gridY = (int)Math.Floor((inst.Y + gridSize) / gridSize);
            var captured = inst;
            yield return new MapRenderer.Entity(gridY, 0.4f, () => DrawNpc(sb, captured, camX, camY, elapsed));
        }
    }

    private void DrawNpc(SpriteBatch sb, Instance inst, float camX, float camY, double elapsed)
    {
        var def = inst.Def;
        if (def.Tex == null) return;

        int tileSize = _world.TileSize;
        float sx = (float)Math.Round(inst.X * RuntimeWorld.TileScale - camX);
        float sy = (float)Math.Round(inst.Y * RuntimeWorld.TileScale - camY);

        string animKey = inst.Moving
            ? DirectionHelper.ResolveWalkKey(def.Has, inst.Direction).key
            : "idle";
        var anim = def.Anim(animKey);
        if (anim == null || anim.Length == 0)
            anim = def.Anim("walkDown") ?? def.Anim("idle") ?? def.Anims.Values.FirstOrDefault(a => a.Length > 0);
        if (anim == null || anim.Length == 0) return;

        var frame = anim[(int)(elapsed * def.Fps) % anim.Length];

        float drawW = tileSize * inst.Scale, drawH = tileSize * inst.Scale;
        float offsetX = (drawW - tileSize) / 2f, offsetY = drawH - tileSize; // bottom-aligned
        float drawX = sx - offsetX, drawY = sy - offsetY;

        if (!def.NoShadow)
        {
            float rx = drawW * def.ShadowW, ry = drawW * def.ShadowH;
            float cx = drawX + drawW / 2f + def.ShadowOffX, cy = drawY + drawH - def.ShadowOffY;
            sb.Draw(_ellipse, new Rectangle((int)(cx - rx), (int)(cy - ry), (int)(rx * 2), (int)(ry * 2)), Color.Black * 0.3f);
        }

        bool flip = (def.Mirrors.TryGetValue(animKey, out bool m) && m) ||
                    (inst.Direction == "left" && !def.Has("walkLeft"));
        var effects = flip ? SpriteEffects.FlipHorizontally : SpriteEffects.None;
        var dest = new Rectangle((int)drawX, (int)drawY, (int)drawW, (int)drawH);
        sb.Draw(def.Tex, dest, frame, Color.White, 0f, Vector2.Zero, effects, 0f);
    }

    private static NpcDef ParseDef(Npc npc, RuntimeAssets assets)
    {
        var def = new NpcDef
        {
            Tex = assets.Texture(npc.SpriteData),
            Fps = npc.Fps ?? 8,
            NoShadow = npc.Extra.TryGetValue("noShadow", out var ns) && ns.ValueKind == JsonValueKind.True,
            ShadowW = (float)(GetNum(npc.Extra, "shadowWidth") ?? 0.35),
            ShadowH = (float)(GetNum(npc.Extra, "shadowHeight") ?? 0.12),
            ShadowOffX = (float)(GetNum(npc.Extra, "shadowOffsetX") ?? 0),
            ShadowOffY = (float)(GetNum(npc.Extra, "shadowOffsetY") ?? 4),
        };
        if (npc.Animations != null)
            foreach (var (key, val) in npc.Animations)
                def.Anims[key] = ParseFrames(val);
        def.HasDiagonals = def.Has("walkUpLeft") || def.Has("walkUpRight") || def.Has("walkDownLeft") || def.Has("walkDownRight");
        if (npc.Extra.TryGetValue("animMirrors", out var mir) && mir.ValueKind == JsonValueKind.Object)
            foreach (var p in mir.EnumerateObject())
                def.Mirrors[p.Name] = p.Value.ValueKind == JsonValueKind.True;
        return def;
    }

    private static Rectangle[] ParseFrames(JsonElement arr)
    {
        if (arr.ValueKind != JsonValueKind.Array) return Array.Empty<Rectangle>();
        var list = new List<Rectangle>();
        foreach (var e in arr.EnumerateArray())
            if (e.ValueKind == JsonValueKind.Object)
                list.Add(new Rectangle(JI(e, "x"), JI(e, "y"), JI(e, "w"), JI(e, "h")));
        return list.ToArray();
    }

    private static int JI(JsonElement e, string n) =>
        e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.Number
            ? (v.TryGetInt32(out int i) ? i : (int)v.GetDouble()) : 0;

    private static double? GetNum(Dictionary<string, JsonElement> ex, string n) =>
        ex.TryGetValue(n, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;
}
