using Microsoft.Xna.Framework.Input;

namespace AdventureCrafter.Runtime.World;

/// <summary>
/// M1 player: 8-direction arrow/WASD movement at the engine's constants (28x76 body, speed 5.5),
/// with the foot hitbox (bottom 1/3) checked separately on X and Y so you slide along walls instead
/// of sticking. Diagonals are normalized by 1/sqrt(2) so they aren't faster. Animation/attack come
/// in M2; this is movement + collision only.
/// </summary>
public sealed class Player
{
    public const float Width = 28f;
    public const float Height = 76f;
    public const float Speed = 5.5f;
    private const float Diag = 0.7071f;

    public float X;
    public float Y;
    public string Direction = "down";
    public bool Moving;

    /// <summary>Optional NPC collision test (foot hitbox in scaled px) so NPCs block the player.</summary>
    public Func<float, float, float, float, bool>? NpcCollides;

    private readonly RuntimeWorld _world;

    public Player(RuntimeWorld world, float spawnX, float spawnY)
    {
        _world = world; X = spawnX; Y = spawnY;
    }

    public void Update(KeyboardState ks)
    {
        // Arrow keys only — matches the original (A is interact, S is sound-debug, so no WASD).
        float rx = 0, ry = 0;
        if (ks.IsKeyDown(Keys.Up)) { ry = -1; Direction = "up"; }
        if (ks.IsKeyDown(Keys.Down)) { ry = 1; Direction = "down"; }
        if (ks.IsKeyDown(Keys.Left)) { rx = -1; Direction = "left"; }
        if (ks.IsKeyDown(Keys.Right)) { rx = 1; Direction = "right"; }
        Step(rx, ry);
    }

    /// <summary>Move by a raw direction (-1..1 per axis): normalize diagonal, apply speed, collide.</summary>
    public void Step(float rx, float ry)
    {
        Moving = rx != 0 || ry != 0;
        float dx = rx, dy = ry;
        if (dx != 0 && dy != 0) { dx *= Diag; dy *= Diag; }
        dx *= Speed; dy *= Speed;

        // Foot hitbox = bottom 1/3 of the body; check X then Y independently (wall-slide).
        float footH = Height / 3f;
        float footY = Y + Height * 2f / 3f;

        bool movedX = false, movedY = false;
        if (dx != 0 && !_world.Collides(X + dx, footY, Width, footH) && !(NpcCollides?.Invoke(X + dx, footY, Width, footH) ?? false))
        { X += dx; movedX = true; }
        if (dy != 0 && !_world.Collides(X, footY + dy, Width, footH) && !(NpcCollides?.Invoke(X, footY + dy, Width, footH) ?? false))
        { Y += dy; movedY = true; }

        if (Moving && !movedX && !movedY) Moving = false;
    }
}

/// <summary>
/// Camera that centers on the player exactly like the engine:
///   camX = floor(player.x - viewW/2 + player.width/2), with viewW = backbufferWidth / zoom.
/// Desktop zoom is 1. Returned as the world-space top-left to subtract when drawing.
/// </summary>
public struct Camera2D
{
    public float X;
    public float Y;
    public float Zoom;

    public Camera2D(float zoom = 1f) { X = 0; Y = 0; Zoom = zoom; }

    public void Follow(Player p, int backbufferWidth, int backbufferHeight)
    {
        float viewW = backbufferWidth / Zoom;
        float viewH = backbufferHeight / Zoom;
        X = (float)Math.Floor(p.X - viewW / 2f + Player.Width / 2f);
        Y = (float)Math.Floor(p.Y - viewH / 2f + Player.Height / 2f);
    }
}
