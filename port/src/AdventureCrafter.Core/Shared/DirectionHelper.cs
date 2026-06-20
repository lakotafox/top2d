namespace AdventureCrafter.Core.Shared;

/// <summary>
/// 8-direction movement/animation helpers, ported verbatim from the engine's 15-8dir-movement.js.
/// In the browser these are duplicated across the builder and game documents (the "two-document
/// trap"); in C# they live here once and both Runtime and Editor share them.
/// Directions are the same camelCase strings the save uses: up/down/left/right + upLeft/upRight/
/// downLeft/downRight.
/// </summary>
public static class DirectionHelper
{
    public const float Diag = 0.7071f; // 1/sqrt(2)

    public static string DirSuffix(string dir) =>
        string.IsNullOrEmpty(dir) ? "" : char.ToUpperInvariant(dir[0]) + dir.Substring(1);

    public static string? Dir8FromVector(float dx, float dy, bool allowDiagonal)
    {
        if (dx == 0 && dy == 0) return null;
        float ax = Math.Abs(dx), ay = Math.Abs(dy);
        if (allowDiagonal && ax > 0.0001f && ay > 0.0001f && ax > ay * 0.41f && ay > ax * 0.41f)
            return (dy < 0 ? "up" : "down") + (dx < 0 ? "Left" : "Right");
        if (ax > ay) return dx < 0 ? "left" : "right";
        return dy < 0 ? "up" : "down";
    }

    public static string CardinalOf(string dir) => dir switch
    {
        "upLeft" or "upRight" => "up",
        "downLeft" or "downRight" => "down",
        _ => dir,
    };

    public static (float x, float y) DirToVec(string dir) => dir switch
    {
        "left" => (-1, 0),
        "right" => (1, 0),
        "up" => (0, -1),
        "down" => (0, 1),
        "upLeft" => (-Diag, -Diag),
        "upRight" => (Diag, -Diag),
        "downLeft" => (-Diag, Diag),
        "downRight" => (Diag, Diag),
        _ => (0, 1),
    };

    /// <summary>
    /// Pick the walk animation key for a direction, with the engine's fallback chain:
    /// exact key → mirrored opposite-horizontal (flip=true) → cardinal collapse → right-flipped.
    /// <paramref name="has"/> reports whether an animation key exists and is non-empty.
    /// </summary>
    public static (string key, bool flip) ResolveWalkKey(Func<string, bool> has, string dir)
    {
        string own = "walk" + DirSuffix(dir);
        if (has(own)) return (own, false);

        string? mirrorFrom = dir switch
        {
            "left" => "right",
            "upLeft" => "upRight",
            "downLeft" => "downRight",
            _ => null,
        };
        if (mirrorFrom != null)
        {
            string src = "walk" + DirSuffix(mirrorFrom);
            if (has(src)) return (src, true);
        }

        string card = CardinalOf(dir);
        if (card != dir)
        {
            if (has("walk" + DirSuffix(card))) return ("walk" + DirSuffix(card), false);
            if (card == "left" && has("walkRight")) return ("walkRight", true);
        }
        return (own, false);
    }
}
