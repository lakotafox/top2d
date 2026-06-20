using System.Globalization;
using System.Text.Json;

namespace AdventureCrafter.Core.Serialization;

/// <summary>
/// Order-insensitive structural equality for JSON, used by the round-trip gate. Object keys are
/// compared as a set (order doesn't matter — re-serialization reorders keys), arrays are compared
/// in order, and numbers compare by value (so 8 == 8.0). Reports the first differing path.
/// </summary>
public static class JsonStructuralComparer
{
    public static bool Equal(string jsonA, string jsonB, out string? firstDiff)
    {
        using var a = JsonDocument.Parse(jsonA);
        using var b = JsonDocument.Parse(jsonB);
        firstDiff = null;
        return Equal(a.RootElement, b.RootElement, "$", ref firstDiff);
    }

    private static bool Equal(JsonElement a, JsonElement b, string path, ref string? firstDiff)
    {
        if (Kind(a) != Kind(b))
        {
            firstDiff ??= $"{path}: kind {a.ValueKind} vs {b.ValueKind}";
            return false;
        }

        switch (a.ValueKind)
        {
            case JsonValueKind.Object:
                // Compare keys as a set. A key that is ABSENT on one side is treated as equal to an
                // explicit `null` on the other — the browser emits some fields as explicit null
                // (e.g. propImageData, cameraBounds) that our null-omitting serializer drops; both
                // mean "no value", so this is the correct, loss-free equivalence.
                var am = new Dictionary<string, JsonElement>();
                foreach (var p in a.EnumerateObject()) am[p.Name] = p.Value;
                var bm = new Dictionary<string, JsonElement>();
                foreach (var p in b.EnumerateObject()) bm[p.Name] = p.Value;

                foreach (var key in am.Keys.Union(bm.Keys))
                {
                    bool ha = am.TryGetValue(key, out var av);
                    bool hb = bm.TryGetValue(key, out var bv);
                    bool aNull = !ha || av.ValueKind == JsonValueKind.Null;
                    bool bNull = !hb || bv.ValueKind == JsonValueKind.Null;
                    if (aNull && bNull) continue;
                    if (aNull != bNull)
                    {
                        firstDiff ??= $"{path}.{key}: {(aNull ? "null/absent" : "present")} vs {(bNull ? "null/absent" : "present")}";
                        return false;
                    }
                    if (!Equal(av, bv, $"{path}.{key}", ref firstDiff)) return false;
                }
                return true;

            case JsonValueKind.Array:
                var al = a.EnumerateArray().ToList();
                var bl = b.EnumerateArray().ToList();
                if (al.Count != bl.Count)
                {
                    firstDiff ??= $"{path}: array length {al.Count} vs {bl.Count}";
                    return false;
                }
                for (int i = 0; i < al.Count; i++)
                    if (!Equal(al[i], bl[i], $"{path}[{i}]", ref firstDiff)) return false;
                return true;

            case JsonValueKind.Number:
                if (NumbersEqual(a, b)) return true;
                firstDiff ??= $"{path}: number {a.GetRawText()} vs {b.GetRawText()}";
                return false;

            case JsonValueKind.String:
                if (a.GetString() == b.GetString()) return true;
                firstDiff ??= $"{path}: string differs";
                return false;

            default: // True / False / Null
                return true;
        }
    }

    // Treat True/False as one logical kind ("boolean") so we don't false-fail on kind check.
    private static int Kind(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.True or JsonValueKind.False => 100,
        _ => (int)e.ValueKind,
    };

    private static bool NumbersEqual(JsonElement a, JsonElement b)
    {
        if (a.TryGetDecimal(out var da) && b.TryGetDecimal(out var db) && da == db) return true;
        if (double.TryParse(a.GetRawText(), NumberStyles.Float, CultureInfo.InvariantCulture, out var fa) &&
            double.TryParse(b.GetRawText(), NumberStyles.Float, CultureInfo.InvariantCulture, out var fb))
            return fa == fb;
        return a.GetRawText() == b.GetRawText();
    }
}
