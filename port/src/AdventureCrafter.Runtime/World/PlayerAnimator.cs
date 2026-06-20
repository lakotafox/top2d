using System.Text.Json;
using AdventureCrafter.Core.Model;
using AdventureCrafter.Core.Shared;
using AdventureCrafter.Runtime.Assets;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace AdventureCrafter.Runtime.World;

/// <summary>
/// Player sprite animation, ported from drawPlayer()/the frame-advance in 55-update.js. Frames are
/// source-rect objects {x,y,w,h,sheet}; multi-sheet supported. Walk/idle direction resolution and
/// the per-animation FPS frame advance match the engine, including the animMirrors flip toggle.
/// </summary>
public sealed class PlayerAnimator
{
    private readonly record struct Frame(int X, int Y, int W, int H, int Sheet);

    private readonly Dictionary<string, Frame[]> _anims = new();
    private readonly Dictionary<string, double> _fps = new();
    private readonly Dictionary<string, bool> _mirrors = new();
    private readonly Texture2D?[] _sheets;

    public int FrameWidth { get; }
    public int FrameHeight { get; }
    public float Scale { get; }                 // playerScale = char.scale * 1.7
    public float ShadowWidthPct { get; }
    public float ShadowHeightPct { get; }
    public float ShadowYOffset { get; }
    public bool NoShadow { get; }

    private int _frame;
    private int _frameTimer;
    private string _animKey = "idleDown";
    private bool _flip;

    public PlayerAnimator(PlayerCharacter pc, RuntimeAssets assets)
    {
        FrameWidth = pc.FrameWidth ?? 64;
        FrameHeight = pc.FrameHeight ?? 64;
        Scale = (float)(GetNum(pc.Extra, "scale") ?? 1.0) * 1.7f;
        ShadowWidthPct = (float)(GetNum(pc.Extra, "shadowWidth") ?? 21);
        ShadowHeightPct = (float)(GetNum(pc.Extra, "shadowHeight") ?? 8);
        ShadowYOffset = (float)(GetNum(pc.Extra, "shadowOffsetY") ?? GetNum(pc.Extra, "shadowYOffset") ?? 17);
        NoShadow = pc.Extra.TryGetValue("noShadow", out var ns) && ns.ValueKind == JsonValueKind.True;

        // sprite sheets: prefer spriteSheets[], fall back to single spriteData
        var sheetUrls = new List<string?>();
        if (pc.Extra.TryGetValue("spriteSheets", out var ss) && ss.ValueKind == JsonValueKind.Array)
            foreach (var s in ss.EnumerateArray())
                sheetUrls.Add(s.ValueKind == JsonValueKind.String ? s.GetString() : null);
        if (sheetUrls.Count == 0) sheetUrls.Add(pc.SpriteData);
        _sheets = sheetUrls.Select(assets.Texture).ToArray();

        // animations
        if (pc.Animations != null)
            foreach (var (key, val) in pc.Animations)
                _anims[key] = ParseFrames(val);

        // per-animation fps + mirror toggles
        if (pc.Extra.TryGetValue("animFps", out var fps) && fps.ValueKind == JsonValueKind.Object)
            foreach (var p in fps.EnumerateObject())
                if (p.Value.ValueKind == JsonValueKind.Number) _fps[p.Name] = p.Value.GetDouble();
        if (pc.Extra.TryGetValue("animMirrors", out var mir) && mir.ValueKind == JsonValueKind.Object)
            foreach (var p in mir.EnumerateObject())
                _mirrors[p.Name] = p.Value.ValueKind == JsonValueKind.True;
    }

    private bool Has(string key) => _anims.TryGetValue(key, out var f) && f.Length > 0;

    private int _receiveFrame;
    private int _receiveFrameTimer;
    private bool _isReceiving;

    /// <summary>True once the receive animation has reached (and is holding) its final frame.</summary>
    public bool ReceiveOnLastFrame =>
        _isReceiving && _anims.TryGetValue(_animKey, out var f) && f.Length > 0 && _receiveFrame >= f.Length - 1;

    public void Update(bool moving, string direction, bool receiving = false)
    {
        string key;
        bool flip = false;
        if (receiving)
        {
            string rk = "receiveItem" + DirectionHelper.DirSuffix(DirectionHelper.CardinalOf(direction));
            key = Has(rk) ? rk : Has("receivedItem") ? "receivedItem"
                : "idle" + DirectionHelper.DirSuffix(DirectionHelper.CardinalOf(direction));
        }
        else if (moving)
        {
            var (k, f) = DirectionHelper.ResolveWalkKey(Has, direction);
            key = k; flip = f;
        }
        else
        {
            string idleKey = "idle" + DirectionHelper.DirSuffix(DirectionHelper.CardinalOf(direction));
            key = Has(idleKey) ? idleKey : Has("idle") ? "idle" : "walk" + DirectionHelper.DirSuffix(DirectionHelper.CardinalOf(direction));
        }

        if (_mirrors.TryGetValue(key, out bool m) && m) flip = !flip;
        if (direction == "left" && !Has("walkLeft")) flip = true;

        _animKey = key;
        _flip = flip;

        double fps = _fps.TryGetValue(key, out var f2) ? f2 : 8;
        int frameDelay = Math.Max(1, (int)Math.Round(60.0 / fps));
        int len = _anims.TryGetValue(key, out var fr) ? fr.Length : 1;

        if (receiving)
        {
            // Receive plays ONCE and holds the final frame (Math.min in the engine), not a loop.
            if (!_isReceiving) { _receiveFrame = 0; _receiveFrameTimer = 0; }
            _isReceiving = true;
            _receiveFrameTimer++;
            if (_receiveFrameTimer >= frameDelay && _receiveFrame < len - 1) { _receiveFrameTimer = 0; _receiveFrame++; }
        }
        else
        {
            _isReceiving = false;
            _frameTimer++;
            if (_frameTimer >= frameDelay) { _frameTimer = 0; _frame++; }
        }
    }

    public bool TryGetDraw(out Texture2D tex, out Rectangle src, out bool flip)
    {
        flip = _flip; tex = null!; src = default;
        if (!_anims.TryGetValue(_animKey, out var frames) || frames.Length == 0) return false;
        // Receive plays once and HOLDS the last frame; walk/idle loop via modulo.
        int frameIndex = _isReceiving ? Math.Min(_receiveFrame, frames.Length - 1) : _frame % frames.Length;
        var fr = frames[frameIndex];
        var sheet = (fr.Sheet >= 0 && fr.Sheet < _sheets.Length ? _sheets[fr.Sheet] : null) ?? _sheets.FirstOrDefault();
        if (sheet == null) return false;
        tex = sheet;
        src = new Rectangle(fr.X, fr.Y, fr.W, fr.H);
        return true;
    }

    private static Frame[] ParseFrames(JsonElement arr)
    {
        if (arr.ValueKind != JsonValueKind.Array) return Array.Empty<Frame>();
        var list = new List<Frame>();
        foreach (var e in arr.EnumerateArray())
        {
            if (e.ValueKind != JsonValueKind.Object) continue;
            list.Add(new Frame(JI(e, "x"), JI(e, "y"), JI(e, "w"), JI(e, "h"), JI(e, "sheet")));
        }
        return list.ToArray();
    }

    private static int JI(JsonElement e, string n) =>
        e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.Number
            ? (v.TryGetInt32(out int i) ? i : (int)v.GetDouble()) : 0;

    private static double? GetNum(Dictionary<string, JsonElement> ex, string n) =>
        ex.TryGetValue(n, out var v) && v.ValueKind == JsonValueKind.Number ? v.GetDouble() : null;
}
