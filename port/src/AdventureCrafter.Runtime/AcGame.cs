using System.Text.Json;
using AdventureCrafter.Core.Model;
using AdventureCrafter.Core.Serialization;
using AdventureCrafter.Runtime.Assets;
using AdventureCrafter.Runtime.World;
using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;
using Microsoft.Xna.Framework.Input;

namespace AdventureCrafter.Runtime;

/// <summary>
/// M1 runtime: load a real Adventure Crafter save, render the current map's tile layers, and walk
/// the player around with collision and a centered camera. No Y-sort / lighting / NPCs yet (M2+).
/// Pixel-art fidelity: PointClamp sampling, integer tile positions, tileSize = gridSize * 4.
/// </summary>
public sealed class AcGame : Game
{
    private readonly string _projectPath;
    private readonly GraphicsDeviceManager _graphics;
    private SpriteBatch _spriteBatch = null!;
    private RuntimeAssets _assets = null!;
    private Texture2D _white = null!;

    private RuntimeWorld _world = null!;
    private MapRenderer _renderer = null!;
    private NpcManager _npcs = null!;
    private ItemManager _items = null!;
    private AnimPropController _animProps = null!;
    private Player _player = null!;
    private Camera2D _camera = new(zoom: 1f);

    private PlayerAnimator? _animator;
    private Texture2D _ellipse = null!;
    private LightingRenderer _lighting = null!;

    // Lighting test overrides (the day fixture has no darkness): AC_DARK=0..100 manual darkness,
    // AC_TORCH=1 (or a radius in tiles) forces the player torch.
    private readonly float _manualDark = float.TryParse(Environment.GetEnvironmentVariable("AC_DARK"), out var md) ? md : 0f;
    private readonly string? _torchEnv = Environment.GetEnvironmentVariable("AC_TORCH");
    private bool _nightOn;        // dev toggle (N) until the day/night cycle is ported
    private bool _torchOn;        // dev toggle (T)
    private KeyboardState _prevKs;
    private double _elapsed;      // seconds, drives animated-prop frames

    // Receive-item pickup animation (player pauses, item bobs above head). Duration matches the
    // engine default (itemReceiveDuration 2s + finalPause 1s).
    private bool _receiving;
    private double _receiveElapsed;
    private int _receiveItem = -1;
    private bool _receivePausing;
    private double _receivePauseElapsed;
    private const double ReceiveTotal = 2.0;       // itemReceiveDuration (s)
    private const double ReceiveFinalPause = 1.0;  // itemReceiveFinalPause (s)

    // Original debug/UI keys.
    private bool _showCollision;  // C
    private bool _hideUi;         // H
    private ProjectData _data = null!;
    private float _fade;            // 0..1 black fade after a map transition
    private double _transCooldown;  // brief lock so we don't immediately re-trigger a door

    // Door walk-out / forced-walk (builder-configured): the player auto-walks (to a point, or in a
    // direction for a duration) and faces that way before the map switch. Unset doors transition directly.
    private bool _fwActive;
    private bool _fwHasTarget;
    private float _fwTargetX, _fwTargetY;     // pixels
    private string _fwDir = "down";
    private double _fwDurationMs, _fwElapsedMs;
    private string _fwMap = "";
    private float _fwSpawnTileX, _fwSpawnTileY;

    // Screenshot mode: if AC_SCREENSHOT is set, render a few frames then save a PNG and exit.
    // Lets the port be eyeballed headlessly without a human watching a live window.
    private readonly string? _screenshotPath = Environment.GetEnvironmentVariable("AC_SCREENSHOT");
    private readonly string? _autoWalk = Environment.GetEnvironmentVariable("AC_AUTOWALK"); // up/down/left/right
    private readonly bool _autoA = Environment.GetEnvironmentVariable("AC_AUTO_A") != null;  // headless interact test
    private int _uframe;
    private readonly int _shotFrame = int.TryParse(Environment.GetEnvironmentVariable("AC_SHOT_FRAME"), out var f) ? f : 3;
    private int _frame;

    public AcGame(string projectPath)
    {
        _projectPath = projectPath;
        _graphics = new GraphicsDeviceManager(this)
        {
            PreferredBackBufferWidth = 1280,
            PreferredBackBufferHeight = 720,
        };
        // Preserve the backbuffer across render-target switches so the lighting pass (which renders
        // the darkness map into a RenderTarget2D and composites it back) doesn't discard the scene.
        _graphics.PreparingDeviceSettings += (_, e) =>
            e.GraphicsDeviceInformation.PresentationParameters.RenderTargetUsage = RenderTargetUsage.PreserveContents;
        Window.AllowUserResizing = true;
        Window.Title = "Adventure Crafter — MonoGame port (M1)";
        IsMouseVisible = true;
    }

    protected override void LoadContent()
    {
        _spriteBatch = new SpriteBatch(GraphicsDevice);
        _assets = new RuntimeAssets(GraphicsDevice);
        _white = new Texture2D(GraphicsDevice, 1, 1);
        _white.SetData(new[] { Color.White });
        _ellipse = MakeEllipse(GraphicsDevice, 128, 128);
        _lighting = new LightingRenderer(GraphicsDevice, _white);

        ProjectData data = ProjectSerializer.Load(_projectPath);
        _data = data;

        _world = new RuntimeWorld(data);
        _world.LoadTextures(_assets);
        _renderer = new MapRenderer(_world, _white);
        _animProps = new AnimPropController(_world);

        var (sx, sy) = _world.PlayerSpawn();
        // AC_SPAWN="x,y" (tiles) overrides spawn for testing.
        var spawnEnv = Environment.GetEnvironmentVariable("AC_SPAWN");
        if (spawnEnv != null)
        {
            var parts = spawnEnv.Split(',');
            if (parts.Length == 2 && float.TryParse(parts[0], out var tx) && float.TryParse(parts[1], out var ty))
            { sx = tx * _world.TileSize; sy = ty * _world.TileSize; }
        }
        _player = new Player(_world, sx, sy);

        int idx = data.ActivePlayerIndex ?? 0;
        if (data.PlayerCharacters != null && idx >= 0 && idx < data.PlayerCharacters.Count)
            _animator = new PlayerAnimator(data.PlayerCharacters[idx], _assets);

        _npcs = new NpcManager(data, _world, _assets, _ellipse);
        _player.NpcCollides = _npcs.NpcCollides;   // NPCs block the player
        _items = new ItemManager(data, _world, _assets);

        Window.Title = $"Adventure Crafter — {_world.MapName} ({_world.MapCols}x{_world.MapRows})";
    }

    // A filled white ellipse for the player drop-shadow (tinted/scaled at draw time).
    private static Texture2D MakeEllipse(GraphicsDevice gd, int w, int h)
    {
        var tex = new Texture2D(gd, w, h);
        var px = new Color[w * h];
        float rx = w / 2f, ry = h / 2f;
        for (int y = 0; y < h; y++)
            for (int x = 0; x < w; x++)
            {
                float nx = (x + 0.5f - rx) / rx, ny = (y + 0.5f - ry) / ry;
                px[y * w + x] = nx * nx + ny * ny <= 1f ? Color.White : Color.Transparent;
            }
        tex.SetData(px);
        return tex;
    }

    protected override void Update(GameTime gameTime)
    {
        var ks = Keyboard.GetState();
        if (ks.IsKeyDown(Keys.Escape)) Exit();
        // Original keys: A = interact, C = collision overlay, H = hide UI. (N/T are dev-only until
        // the day/night cycle ports; I/Q/P/S/L hook up with the HUD/dialog/debug panels later.)
        bool interactPressed = ks.IsKeyDown(Keys.A) && _prevKs.IsKeyUp(Keys.A);
        if (ks.IsKeyDown(Keys.C) && _prevKs.IsKeyUp(Keys.C)) _showCollision = !_showCollision;
        if (ks.IsKeyDown(Keys.H) && _prevKs.IsKeyUp(Keys.H)) _hideUi = !_hideUi;
        if (ks.IsKeyDown(Keys.N) && _prevKs.IsKeyUp(Keys.N)) _nightOn = !_nightOn;
        if (ks.IsKeyDown(Keys.T) && _prevKs.IsKeyUp(Keys.T)) _torchOn = !_torchOn;
        _prevKs = ks;
        if (_autoA && ++_uframe == 12) interactPressed = true;   // headless interact test

        double dt = gameTime.ElapsedGameTime.TotalSeconds;

        if (_receiving)
        {
            _player.Moving = false;          // frozen during the receive animation
            _receiveElapsed += dt;
        }
        else if (_fwActive)
        {
            UpdateForcedWalk(dt);            // scripted walk-out; player input ignored
        }
        else if (_autoWalk != null)
        {
            (float rx, float ry) = _autoWalk switch
            {
                "up" => (0f, -1f), "down" => (0f, 1f),
                "left" => (-1f, 0f), "right" => (1f, 0f),
                _ => (0f, 0f),
            };
            _player.Step(rx, ry);
        }
        else
        {
            _player.Update(ks);
        }
        _animator?.Update(_player.Moving, _player.Direction, _receiving);

        // End receive at the EARLIER of: total duration, or final-frame reached + final pause.
        if (_receiving)
        {
            if (_animator?.ReceiveOnLastFrame == true && !_receivePausing) { _receivePausing = true; _receivePauseElapsed = 0; }
            else if (_receivePausing) _receivePauseElapsed += dt;
            if (_receiveElapsed >= ReceiveTotal || (_receivePausing && _receivePauseElapsed >= ReceiveFinalPause))
            { _receiving = false; _receiveItem = -1; _receivePausing = false; }
        }

        _elapsed += dt;
        if (_fade > 0) _fade = Math.Max(0f, _fade - (float)(dt / 0.3));
        if (_transCooldown > 0) _transCooldown -= dt;

        // Foot tile used for both NPC patrol-collision and tile-adjacency item pickup.
        int tileSize = _world.TileSize;
        int ptx = (int)Math.Floor((_player.X + Player.Width / 2f) / tileSize);
        int pty = (int)Math.Floor((_player.Y + Player.Height * 0.8f) / tileSize);

        float footH = Player.Height / 3f, footY = _player.Y + Player.Height * 2f / 3f;
        _npcs.Update(dt, _player.X, footY, Player.Width, footH);
        _items.Update(dt);
        _animProps.Update(dt);

        if (!_fwActive && !_receiving)
        {
            TryDoors(ptx, pty, dtype => dtype is "walkover" or "external");  // auto (walkover) doors
            if (interactPressed) HandleInteract(ptx, pty);                   // A: item -> (prop/dialog) -> interact-door
        }
        _camera.Follow(_player, GraphicsDevice.Viewport.Width, GraphicsDevice.Viewport.Height);

        base.Update(gameTime);
    }

    protected override void Draw(GameTime gameTime)
    {
        GraphicsDevice.Clear(new Color(20, 20, 28));

        _spriteBatch.Begin(samplerState: SamplerState.PointClamp);
        int playerGridY = (int)Math.Floor((_player.Y + Player.Height) / _world.TileSize);
        var entities = new List<MapRenderer.Entity>
        {
            new(playerGridY, 0.5f, DrawPlayer),
        };
        entities.AddRange(_npcs.Entities(_spriteBatch, _camera.X, _camera.Y, _elapsed));
        entities.AddRange(_items.Entities(_spriteBatch, _camera.X, _camera.Y));
        _renderer.Render(_spriteBatch, _camera.X, _camera.Y,
                         GraphicsDevice.Viewport.Width, GraphicsDevice.Viewport.Height,
                         entities, _animProps.Frame);
        DrawReceiveItem(_spriteBatch);
        _spriteBatch.End();

        DrawLighting();
        DrawFade();

        base.Draw(gameTime);

        if (_screenshotPath != null && ++_frame == _shotFrame)
        {
            CaptureScreenshot(_screenshotPath);
            Exit();
        }
    }

    // The A-key interact, in the engine's priority order: item pickup -> interactive prop -> (dialog) -> interact-door.
    private void HandleInteract(int ptx, int pty)
    {
        int picked = _items.TryPickup(ptx, pty);
        if (picked >= 0) { BeginReceive(picked); return; }

        var inter = _animProps.FindInteractive(ptx, pty);
        if (inter.HasValue)
        {
            var prop = inter.Value.Prop;
            if (prop.LockItemIndex >= 0)
            {
                if (!_items.HasItem(prop.LockItemIndex)) return;     // locked — needs the key (TODO toast)
                if (prop.LockConsume) _items.Consume(prop.LockItemIndex, 1);
            }
            _animProps.Trigger(inter.Value.OriginX, inter.Value.OriginY, inter.Value.Layer);
            if (prop.GiveItem && prop.GiveItemIndex >= 0) { _items.Add(prop.GiveItemIndex, 1); BeginReceive(prop.GiveItemIndex); }
            return;
        }

        // TODO: NPC / shop dialog.
        TryDoors(ptx, pty, dtype => dtype == "interact");
    }

    private void BeginReceive(int itemIndex)
    {
        _receiving = true; _receiveElapsed = 0; _receiveItem = itemIndex; _player.Moving = false;
        _receivePausing = false; _receivePauseElapsed = 0;
    }

    // Fire the first door at the player's foot tile whose doorType matches (walkover auto vs interact).
    private void TryDoors(int ptx, int pty, Func<string, bool> typeMatches)
    {
        if (_transCooldown > 0) return;
        foreach (var t in _world.TriggersForMap())
        {
            int tx = (int)(t.X ?? 0), ty = (int)(t.Y ?? 0);
            int tw = (int)(t.Width ?? 1), th = (int)(t.Height ?? 1);
            if (ptx < tx || ptx >= tx + tw || pty < ty || pty >= ty + th) continue;

            string doorType = t.Extra.TryGetValue("doorType", out var dt) && dt.ValueKind == JsonValueKind.String
                ? dt.GetString()! : "walkover";
            if (!typeMatches(doorType)) continue;
            if (doorType == "external") continue;            // external link, no in-game target (TODO)
            if (t.TargetMap == null || !_world.HasMap(t.TargetMap)) continue;
            if (t.TargetX == null || t.TargetY == null) continue;
            StartDoor(t, doorType);
            return;
        }
    }

    // Decide between a builder-configured walk-out (auto-walk + facing, then switch) and a direct switch.
    private void StartDoor(Trigger t, string doorType)
    {
        float tileSize = _world.TileSize;
        float? woX = JNum(t.Extra, "walkOutX"), woY = JNum(t.Extra, "walkOutY");
        string? wDir = JStr(t.Extra, "walkDirection");
        double wDur = JNum(t.Extra, "walkDuration") ?? 0;
        bool hasWalkOut = woX.HasValue && woY.HasValue;
        bool hasWalkDir = wDir != null && wDur > 0;

        if (doorType == "walkover" && (hasWalkOut || hasWalkDir))
        {
            _fwActive = true; _fwElapsedMs = 0;
            _fwMap = t.TargetMap!; _fwSpawnTileX = (float)t.TargetX!.Value; _fwSpawnTileY = (float)t.TargetY!.Value;
            if (hasWalkOut)
            {
                _fwHasTarget = true;
                _fwTargetX = woX!.Value * tileSize; _fwTargetY = woY!.Value * tileSize;
                float dx = _fwTargetX - _player.X, dy = _fwTargetY - _player.Y;
                _player.Direction = Math.Abs(dx) > Math.Abs(dy) ? (dx > 0 ? "right" : "left") : (dy > 0 ? "down" : "up");
            }
            else
            {
                _fwHasTarget = false; _fwDir = wDir!; _fwDurationMs = wDur * 1000; _player.Direction = wDir!;
            }
            _transCooldown = 0.6;
        }
        else
        {
            DoTransition(t.TargetMap!, (float)t.TargetX!.Value, (float)t.TargetY!.Value);
        }
    }

    private void UpdateForcedWalk(double dt)
    {
        _player.Moving = true;
        float speed = Player.Speed;
        if (_fwHasTarget)
        {
            float dx = _fwTargetX - _player.X, dy = _fwTargetY - _player.Y;
            float dist = MathF.Sqrt(dx * dx + dy * dy);
            if (dist <= speed) { _player.X = _fwTargetX; _player.Y = _fwTargetY; FinishForcedWalk(); }
            else { _player.X += dx / dist * speed; _player.Y += dy / dist * speed; }
        }
        else
        {
            var (vx, vy) = AdventureCrafter.Core.Shared.DirectionHelper.DirToVec(_fwDir);
            _player.X += vx * speed; _player.Y += vy * speed;
            _fwElapsedMs += dt * 1000;
            if (_fwElapsedMs >= _fwDurationMs) FinishForcedWalk();
        }
    }

    private void FinishForcedWalk()
    {
        _fwActive = false;
        DoTransition(_fwMap, _fwSpawnTileX, _fwSpawnTileY);
    }

    private static float? JNum(Dictionary<string, JsonElement> ex, string n) =>
        ex.TryGetValue(n, out var v) && v.ValueKind == JsonValueKind.Number ? (float)v.GetDouble() : null;
    private static string? JStr(Dictionary<string, JsonElement> ex, string n) =>
        ex.TryGetValue(n, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private void DoTransition(string targetMap, float tileX, float tileY)
    {
        _world.SwitchMap(targetMap);
        _npcs = new NpcManager(_data, _world, _assets, _ellipse);   // re-filter NPCs for new map
        _player.NpcCollides = _npcs.NpcCollides;
        _items = new ItemManager(_data, _world, _assets);           // re-filter loot for new map
        _animProps = new AnimPropController(_world);                // per-origin anim state for new map
        _player.X = tileX * _world.TileSize;
        _player.Y = tileY * _world.TileSize;
        _camera.Follow(_player, GraphicsDevice.Viewport.Width, GraphicsDevice.Viewport.Height);
        _fade = 1f;
        _transCooldown = 0.6;
        Window.Title = $"Adventure Crafter — {_world.MapName} ({_world.MapCols}x{_world.MapRows})";
    }

    // Floating item bobbing above the player's head during the receive animation.
    private void DrawReceiveItem(SpriteBatch sb)
    {
        if (!_receiving || _receiveItem < 0) return;
        if (!_items.IconFor(_receiveItem, out var tex, out var src, out _, out _)) return;
        float bob = MathF.Sin((float)_receiveElapsed * 6f) * 5f;
        float cx = _player.X - _camera.X + Player.Width / 2f;
        float cy = _player.Y - _camera.Y - 34f + bob;   // above the head
        const int size = 36;
        sb.Draw(tex, new Rectangle((int)(cx - size / 2f), (int)(cy - size / 2f), size, size), src, Color.White);
    }

    private void DrawFade()
    {
        if (_fade <= 0) return;
        _spriteBatch.Begin();
        _spriteBatch.Draw(_white, new Rectangle(0, 0, GraphicsDevice.Viewport.Width, GraphicsDevice.Viewport.Height), Color.Black * _fade);
        _spriteBatch.End();
    }

    private void DrawLighting()
    {
        float tileSize = _world.TileSize;
        float camX = _camera.X, camY = _camera.Y;

        // Manual darkness (0..100 -> 0..0.95), matching the engine's slider mapping.
        float darkPct = _nightOn ? 85f : _manualDark;
        float darknessAlpha = darkPct / 100f * 0.95f;

        bool playerLight = _world.PlayerLight || _torchEnv != null || _torchOn;
        float torchRadiusTiles = _torchEnv != null && float.TryParse(_torchEnv, out var tr) && tr > 0
            ? tr : (float)_world.PlayerLightRadius;

        var lights = new List<LightingRenderer.Light>();
        if (playerLight)
        {
            float px = _player.X - camX + Player.Width / 2f;
            float py = _player.Y - camY + Player.Height / 2f;
            lights.Add(new LightingRenderer.Light(px, py, torchRadiusTiles * tileSize));
        }
        foreach (var pl in _world.PointLightsForMap())
        {
            float sx = (pl.TileX * tileSize + tileSize / 2f) - camX;
            float sy = (pl.TileY * tileSize + tileSize / 2f) - camY;
            lights.Add(new LightingRenderer.Light(sx, sy, (float)(pl.RadiusTiles * tileSize)));
        }

        _lighting.RenderOverlay(_spriteBatch, new Color(0, 0, 20), darknessAlpha, lights);
    }

    private void CaptureScreenshot(string path)
    {
        int w = GraphicsDevice.PresentationParameters.BackBufferWidth;
        int h = GraphicsDevice.PresentationParameters.BackBufferHeight;
        var data = new Color[w * h];
        GraphicsDevice.GetBackBufferData(data);
        using var tex = new Texture2D(GraphicsDevice, w, h);
        tex.SetData(data);
        using var fs = File.Create(path);
        tex.SaveAsPng(fs, w, h);
        Console.Error.WriteLine($"[screenshot] wrote {path} ({w}x{h}) playerPx=({_player.X:0},{_player.Y:0}) tile=({_player.X / _world.TileSize:0.0},{_player.Y / _world.TileSize:0.0})");
    }

    private void DrawPlayer()
    {
        float sx = _player.X - _camera.X;
        float sy = _player.Y - _camera.Y;

        if (_animator != null && _animator.TryGetDraw(out var tex, out var src, out var flip))
        {
            float drawW = _animator.FrameWidth * _animator.Scale;
            float drawH = _animator.FrameHeight * _animator.Scale;
            float spriteX = sx + Player.Width / 2f - drawW / 2f;
            float spriteY = sy - 15f;                            // engine offset

            if (!_animator.NoShadow)
            {
                float rx = drawW * (_animator.ShadowWidthPct / 100f);
                float ry = drawW * (_animator.ShadowHeightPct / 100f);
                float cx = spriteX + drawW / 2f;
                float cy = spriteY + drawH - _animator.ShadowYOffset;
                var shadow = new Rectangle((int)(cx - rx), (int)(cy - ry), (int)(rx * 2), (int)(ry * 2));
                _spriteBatch.Draw(_ellipse, shadow, Color.Black * 0.3f);
            }

            var effects = flip ? SpriteEffects.FlipHorizontally : SpriteEffects.None;
            var dest = new Rectangle((int)Math.Round(spriteX), (int)Math.Round(spriteY),
                                     (int)Math.Round(drawW), (int)Math.Round(drawH));
            _spriteBatch.Draw(tex, dest, src, Color.White, 0f, Vector2.Zero, effects, 0f);
        }
        else
        {
            var dest = new Rectangle((int)Math.Round(sx), (int)Math.Round(sy - 15f), 64, 109);
            _spriteBatch.Draw(_white, dest, new Color(220, 80, 200));
        }
    }

    protected override void UnloadContent()
    {
        _assets.Dispose();
        _white.Dispose();
        _ellipse.Dispose();
        _lighting.Dispose();
    }
}
