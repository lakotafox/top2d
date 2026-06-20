using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace AdventureCrafter.Runtime.World;

/// <summary>
/// The engine's multi-pass Y-sort renderer (60-draw.js / 65-ysort-helpers.js):
///   PASS 1  ground layer (0), flat behind everything
///   PASS 2  layers 1+ row-by-row, split tiles as TRUNK only, entities interleaved by foot row
///   PASS 3  canopy overlay — split-tile tops drawn over everything (player walks "under" them)
/// Split lines are a per-column staircase, so trunk/canopy are drawn as axis-aligned per-column
/// sub-rectangle strips (pixel-exact, no stencil/polygon clip needed). M1.5 interleaves only the
/// player; NPCs/items/static objects slot into the same pass in M2.
/// </summary>
public sealed class MapRenderer
{
    private readonly RuntimeWorld _world;
    private readonly Texture2D _white;
    private Func<int, int, int, int>? _animFrame;   // (originX, originY, layer) -> frame index
    public MapRenderer(RuntimeWorld world, Texture2D whitePixel) { _world = world; _white = whitePixel; }

    /// <summary>A Y-sortable thing drawn between tile rows (player, NPC, item, static object).</summary>
    public readonly record struct Entity(int GridY, float SubSort, Action Draw);

    public void Render(SpriteBatch sb, float camX, float camY, int viewW, int viewH,
                       IReadOnlyList<Entity> entities, Func<int, int, int, int>? animFrame = null)
    {
        _animFrame = animFrame;
        int tileSize = _world.TileSize;
        var layers = _world.Layers;

        int startX = Math.Max(0, (int)(camX / tileSize) - 4);
        int endX = Math.Min(_world.MapCols, (int)((camX + viewW) / tileSize) + 5);
        int startY = Math.Max(0, (int)(camY / tileSize) - 4);
        int endY = Math.Min(_world.MapRows, (int)((camY + viewH) / tileSize) + 5);

        // PASS 1 — ground layer, fully (no split here, matching drawLayer(0)).
        if (layers.Count > 0 && _world.LayerVisibility[0])
            DrawLayerFull(sb, layers[0], startX, endX, startY, endY, camX, camY);

        // Entities sorted by foot row then sub-sort (player 0.5, otherPlayer 0.45, npc 0.4, item 0.3, static 0.2).
        var sorted = entities.OrderBy(e => e.GridY).ThenBy(e => e.SubSort).ToList();
        int ei = 0;

        // PASS 2 — layers 1+, row by row; split tiles draw trunk; entities inserted at their foot row.
        for (int y = startY; y < endY; y++)
        {
            for (int li = 1; li < layers.Count; li++)
            {
                if (!_world.LayerVisibility[li]) continue;
                var layer = layers[li];
                if (y >= layer.Length) continue;
                var row = layer[y];
                if (row == null) continue;
                for (int x = startX; x < endX && x < row.Length; x++)
                {
                    var cell = row[x];
                    if (cell is { IsTile: true } c)
                    {
                        string key = $"{c.TilesetIndex}:{c.X},{c.Y}";
                        var split = _world.SplitLine(key);
                        if (split != null) DrawTileTrunk(sb, c, x, y, camX, camY, split, _world.IsSplitFlipped(key));
                        else DrawTileFull(sb, c, x, y, camX, camY);
                    }
                    else if (cell is { IsAnimTile: true } a)
                    {
                        int frame = _animFrame?.Invoke(x - a.OffsetX, y - a.OffsetY, li) ?? 0;
                        DrawAnimTile(sb, a, x, y, camX, camY, frame);
                    }
                }
            }

            while (ei < sorted.Count && sorted[ei].GridY <= y) { sorted[ei].Draw(); ei++; }
        }
        while (ei < sorted.Count) { sorted[ei].Draw(); ei++; }

        // PASS 3 — canopy tops over everything.
        for (int li = 1; li < layers.Count; li++)
        {
            if (!_world.LayerVisibility[li]) continue;
            var layer = layers[li];
            for (int y = startY; y < endY; y++)
            {
                if (y >= layer.Length) continue;
                var row = layer[y];
                if (row == null) continue;
                for (int x = startX; x < endX && x < row.Length; x++)
                {
                    if (row[x] is not { IsTile: true } c) continue;
                    string key = $"{c.TilesetIndex}:{c.X},{c.Y}";
                    var split = _world.SplitLine(key);
                    if (split != null) DrawTileCanopy(sb, c, x, y, camX, camY, split, _world.IsSplitFlipped(key));
                }
            }
        }
    }

    private void DrawLayerFull(SpriteBatch sb, Cell?[][] layer, int startX, int endX, int startY, int endY, float camX, float camY)
    {
        for (int y = startY; y < endY; y++)
        {
            if (y >= layer.Length) continue;
            var row = layer[y];
            if (row == null) continue;
            for (int x = startX; x < endX && x < row.Length; x++)
                if (row[x] is { IsTile: true } c) DrawTileFull(sb, c, x, y, camX, camY);
        }
    }

    // Full tile, centered so rotation/flip pivot on the tile center (matches drawTileWithEffects).
    private void DrawTileFull(SpriteBatch sb, Cell c, int gx, int gy, float camX, float camY)
    {
        var tex = _world.TilesetTexture(c.TilesetIndex);
        int tileSize = _world.TileSize, gridSize = _world.GridSize;
        int dx = (int)Math.Round(gx * (float)tileSize - camX);
        int dy = (int)Math.Round(gy * (float)tileSize - camY);
        if (tex == null)
        {
            sb.Draw(_white, new Rectangle(dx, dy, tileSize, tileSize), new Color(74, 124, 89));
            return;
        }
        var src = new Rectangle(c.X, c.Y, gridSize, gridSize);
        float scale = (float)tileSize / gridSize;
        var effects = c.Flipped ? SpriteEffects.FlipHorizontally : SpriteEffects.None;
        float rot = c.Rotation * MathHelper.Pi / 180f;
        var pos = new Vector2(dx + tileSize / 2f, dy + tileSize / 2f);
        var origin = new Vector2(gridSize / 2f, gridSize / 2f);
        sb.Draw(tex, pos, src, Color.White, rot, origin, scale, effects, 0f);
    }

    // One sub-tile of a multi-tile animated prop's current frame — full drawAnimTile port: per-instance
    // scale (from the PROP's center, not each tile), pixel nudge, horizontal mirror, and rotation.
    private void DrawAnimTile(SpriteBatch sb, Cell a, int gx, int gy, float camX, float camY, int frameIndex)
    {
        var prop = _world.AnimProp(a.PropIndex);
        if (prop?.Texture == null || prop.Frames.Count == 0) return;
        var tex = prop.Texture;
        int gridSize = _world.GridSize, tileSize = _world.TileSize;
        var frame = prop.Frames[frameIndex % prop.Frames.Count];

        float scale = a.Scale <= 0 ? 1f : a.Scale;
        float scaledTileSize = tileSize * scale;
        float propW = a.TilesW * tileSize, propH = a.TilesH * tileSize;
        float scaledPropW = propW * scale, scaledPropH = propH * scale;
        float centerOffX = (scaledPropW - propW) / 2f, centerOffY = (scaledPropH - propH) / 2f;
        float scaledTileOffX = a.OffsetX * tileSize * scale, scaledTileOffY = a.OffsetY * tileSize * scale;

        int originTileX = gx - a.OffsetX, originTileY = gy - a.OffsetY;
        float originPx = (float)Math.Floor(originTileX * (float)tileSize - camX);
        float originPy = (float)Math.Floor(originTileY * (float)tileSize - camY);

        var src = new Rectangle(frame.X + a.OffsetX * gridSize, frame.Y + a.OffsetY * gridSize, gridSize, gridSize);
        float nx = a.NudgeX * RuntimeWorld.TileScale, ny = a.NudgeY * RuntimeWorld.TileScale;

        if (a.Rotation == 0)
        {
            float drawX = originPx - centerOffX + scaledTileOffX;
            float drawY = originPy - centerOffY + scaledTileOffY;
            var fx = SpriteEffects.None;
            if (a.Mirror)
            {
                float centerScreenX = originPx - centerOffX + scaledPropW / 2f;
                drawX = 2f * centerScreenX - drawX - scaledTileSize;   // reflect about prop center
                fx = SpriteEffects.FlipHorizontally;
            }
            var dest = new Rectangle((int)Math.Round(drawX + nx), (int)Math.Round(drawY + ny),
                                     (int)Math.Round(scaledTileSize), (int)Math.Round(scaledTileSize));
            sb.Draw(tex, dest, src, Color.White, 0f, Vector2.Zero, fx, 0f);
        }
        else
        {
            // Rotate the whole prop about its (unscaled) center; place this sub-tile via origin offset.
            float angle = a.Rotation * MathHelper.Pi / 180f;
            var propCenter = new Vector2(originPx + propW / 2f + nx, originPy + propH / 2f + ny);
            float rotDrawX = -scaledPropW / 2f + scaledTileOffX;
            float rotDrawY = -scaledPropH / 2f + scaledTileOffY;
            float scaleFactor = scaledTileSize / gridSize;
            var origin = new Vector2(-rotDrawX / scaleFactor, -rotDrawY / scaleFactor); // source-px origin
            var fx = a.Mirror ? SpriteEffects.FlipHorizontally : SpriteEffects.None;
            sb.Draw(tex, propCenter, src, Color.White, angle, origin, scaleFactor, fx, 0f);
        }
    }

    private void DrawTileTrunk(SpriteBatch sb, Cell c, int gx, int gy, float camX, float camY, int[] split, bool flipped)
    {
        // Rotated/flipped split tiles are drawn full in the trunk pass (engine skips their canopy too).
        if (c.Rotation != 0 || c.Flipped) { DrawTileFull(sb, c, gx, gy, camX, camY); return; }
        DrawSplitStrips(sb, c, gx, gy, camX, camY, split, trunk: true, flipped);
    }

    private void DrawTileCanopy(SpriteBatch sb, Cell c, int gx, int gy, float camX, float camY, int[] split, bool flipped)
    {
        if (c.Rotation != 0 || c.Flipped) return; // already drawn full in trunk pass
        DrawSplitStrips(sb, c, gx, gy, camX, camY, split, trunk: false, flipped);
    }

    // Draw the trunk (or canopy) of a split tile as per-column vertical strips. NORMAL: trunk is the
    // part BELOW the split line, canopy ABOVE. FLIPPED swaps them.
    private void DrawSplitStrips(SpriteBatch sb, Cell c, int gx, int gy, float camX, float camY, int[] split, bool trunk, bool flipped)
    {
        var tex = _world.TilesetTexture(c.TilesetIndex);
        if (tex == null) return;
        int tileSize = _world.TileSize, gridSize = _world.GridSize;
        int scale = tileSize / gridSize; // TILE_SCALE
        int px = (int)Math.Round(gx * (float)tileSize - camX);
        int py = (int)Math.Round(gy * (float)tileSize - camY);

        // "below the line covers" by default; trunk==below unless flipped.
        bool drawBelow = trunk ^ flipped; // trunk normal -> below; canopy normal -> above; flip swaps

        for (int col = 0; col < gridSize; col++)
        {
            int sy = split[col];
            if (drawBelow)
            {
                int h = gridSize - sy;
                if (h <= 0) continue;
                var src = new Rectangle(c.X + col, c.Y + sy, 1, h);
                var dest = new Rectangle(px + col * scale, py + sy * scale, scale, h * scale);
                sb.Draw(tex, dest, src, Color.White);
            }
            else
            {
                int h = sy;
                if (h <= 0) continue;
                var src = new Rectangle(c.X + col, c.Y, 1, h);
                var dest = new Rectangle(px + col * scale, py, scale, h * scale);
                sb.Draw(tex, dest, src, Color.White);
            }
        }
    }
}
