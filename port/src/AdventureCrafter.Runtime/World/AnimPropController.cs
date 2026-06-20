namespace AdventureCrafter.Runtime.World;

/// <summary>
/// Per-origin animation state for animated props, mirroring animPropFrameTimers + interactivePropStates.
/// Loop props advance and wrap; interactive props (chests/gates/doors) hold frame 0 until interacted,
/// then play once and hold the final frame ("open"). Keyed by the prop's ORIGIN tile + layer so all
/// sub-tiles of a multi-tile prop animate together.
/// </summary>
public sealed class AnimPropController
{
    private sealed class State
    {
        public int PropIndex;
        public int Frame;
        public double Timer;
        public bool Animating;   // interactive: currently playing its one-shot
        public bool Used;        // interactive: already opened (holds last frame)
    }

    public readonly record struct Interactive(int OriginX, int OriginY, int Layer, AnimPropDef Prop);

    private readonly RuntimeWorld _world;
    private readonly Dictionary<(int, int, int), State> _states = new();

    public AnimPropController(RuntimeWorld world)
    {
        _world = world;
        // Register one state per (origin, layer) across all animTile cells on the current map.
        var layers = world.Layers;
        for (int li = 0; li < layers.Count; li++)
        {
            var layer = layers[li];
            for (int y = 0; y < layer.Length; y++)
            {
                var row = layer[y];
                if (row == null) continue;
                for (int x = 0; x < row.Length; x++)
                {
                    if (row[x] is not { IsAnimTile: true } a) continue;
                    var key = (x - a.OffsetX, y - a.OffsetY, li);
                    if (!_states.ContainsKey(key)) _states[key] = new State { PropIndex = a.PropIndex };
                }
            }
        }
    }

    public void Update(double dt)
    {
        foreach (var st in _states.Values)
        {
            var prop = _world.AnimProp(st.PropIndex);
            if (prop == null || prop.FrameCount <= 1) continue;
            double fps = prop.Fps <= 0 ? 8 : prop.Fps;
            double frameTime = 1.0 / fps;

            if (prop.IsInteractive)
            {
                if (!st.Animating) continue;
                st.Timer += dt;
                if (st.Timer >= frameTime)
                {
                    st.Timer -= frameTime;
                    st.Frame++;
                    if (st.Frame >= prop.FrameCount) { st.Animating = false; st.Used = true; st.Frame = prop.FrameCount - 1; }
                }
            }
            else
            {
                st.Timer += dt;
                while (st.Timer >= frameTime) { st.Timer -= frameTime; st.Frame = (st.Frame + 1) % prop.FrameCount; }
            }
        }
    }

    /// <summary>Current frame for a prop origin (0 if unknown — e.g. an un-triggered interactive prop).</summary>
    public int Frame(int originX, int originY, int layer) =>
        _states.TryGetValue((originX, originY, layer), out var st) ? st.Frame : 0;

    /// <summary>Find an un-used, idle interactive prop within ±1 tile of the player's foot tile (checkAnimPropInteraction).</summary>
    public Interactive? FindInteractive(int playerTileX, int playerTileY)
    {
        var layers = _world.Layers;
        for (int li = 0; li < layers.Count; li++)
        {
            var layer = layers[li];
            for (int dy = -1; dy <= 1; dy++)
                for (int dx = -1; dx <= 1; dx++)
                {
                    int ty = playerTileY + dy, tx = playerTileX + dx;
                    if (ty < 0 || ty >= layer.Length) continue;
                    var row = layer[ty];
                    if (row == null || tx < 0 || tx >= row.Length) continue;
                    if (row[tx] is not { IsAnimTile: true } a) continue;
                    var prop = _world.AnimProp(a.PropIndex);
                    if (prop == null || !prop.IsInteractive) continue;
                    var key = (tx - a.OffsetX, ty - a.OffsetY, li);
                    if (_states.TryGetValue(key, out var st) && (st.Used || st.Animating)) continue;
                    return new Interactive(key.Item1, key.Item2, li, prop);
                }
        }
        return null;
    }

    /// <summary>Begin an interactive prop's one-shot animation.</summary>
    public void Trigger(int originX, int originY, int layer)
    {
        if (_states.TryGetValue((originX, originY, layer), out var st)) { st.Animating = true; st.Frame = 0; st.Timer = 0; }
    }
}
