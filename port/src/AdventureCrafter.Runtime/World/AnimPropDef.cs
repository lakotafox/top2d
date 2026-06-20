using System.Text.Json;
using AdventureCrafter.Core.Model;
using AdventureCrafter.Runtime.Assets;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace AdventureCrafter.Runtime.World;

/// <summary>
/// A loaded animated-prop definition (fireplace, torch, water, etc.). Frames are source rects in
/// the prop's sprite sheet; a multi-tile prop's cell draws its own sub-tile of the current frame.
/// </summary>
public sealed class AnimPropDef
{
    public Texture2D? Texture { get; init; }
    public List<Rectangle> Frames { get; init; } = new();
    public double Fps { get; init; }
    public string Type { get; init; } = "loop";   // "loop" | "interactive"
    public bool HasSplit { get; init; }

    // interactive-prop config
    public bool GiveItem { get; init; }
    public int GiveItemIndex { get; init; } = -1;
    public int LockItemIndex { get; init; } = -1;
    public bool LockConsume { get; init; } = true;

    public bool IsInteractive => Type == "interactive";
    public int FrameCount => Frames.Count;

    public static AnimPropDef Parse(AnimatedProp prop, RuntimeAssets assets)
    {
        var frames = new List<Rectangle>();
        if (prop.Extra.TryGetValue("frames", out var fr) && fr.ValueKind == JsonValueKind.Array)
            foreach (var f in fr.EnumerateArray())
                if (f.ValueKind == JsonValueKind.Object)
                    frames.Add(new Rectangle(JI(f, "x"), JI(f, "y"), JI(f, "w"), JI(f, "h")));

        double fps = prop.Extra.TryGetValue("fps", out var fv) && fv.ValueKind == JsonValueKind.Number ? fv.GetDouble() : 8;
        string type = prop.Extra.TryGetValue("type", out var tv) && tv.ValueKind == JsonValueKind.String ? tv.GetString()! : "loop";
        bool hasSplit = prop.Extra.TryGetValue("splitLine", out var sl) &&
                        sl.ValueKind is JsonValueKind.Number or JsonValueKind.Object;

        return new AnimPropDef
        {
            Texture = assets.Texture(prop.SpriteData),
            Frames = frames,
            Fps = fps,
            Type = type,
            HasSplit = hasSplit,
            GiveItem = prop.Extra.TryGetValue("giveItem", out var gi) && gi.ValueKind == JsonValueKind.True,
            GiveItemIndex = prop.Extra.TryGetValue("giveItemIndex", out var gii) && gii.ValueKind == JsonValueKind.Number ? gii.GetInt32() : -1,
            LockItemIndex = prop.Extra.TryGetValue("lockItemIndex", out var li) && li.ValueKind == JsonValueKind.Number ? li.GetInt32() : -1,
            LockConsume = !(prop.Extra.TryGetValue("lockConsume", out var lc) && lc.ValueKind == JsonValueKind.False),
        };
    }

    private static int JI(JsonElement e, string n) =>
        e.TryGetProperty(n, out var v) && v.ValueKind == JsonValueKind.Number
            ? (v.TryGetInt32(out int i) ? i : (int)v.GetDouble()) : 0;
}
