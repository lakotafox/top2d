using Microsoft.Xna.Framework;
using Microsoft.Xna.Framework.Graphics;

namespace AdventureCrafter.Runtime.World;

/// <summary>
/// Ports renderLighting() (50-lighting-render.js). The browser fills an offscreen canvas with
/// ambient darkness, then cuts light holes with radial gradients via
/// globalCompositeOperation='destination-out', then draws the canvas over the scene.
///
/// MonoGame equivalent:
///   • a RenderTarget2D is the "lightCanvas"
///   • fill it with the darkness colour (Opaque blend writes exact RGBA)
///   • cut holes by drawing a baked radial-gradient light texture with a custom BlendState that
///     does dest.a *= (1 - src.a) (the destination-out on alpha) while leaving the dark RGB intact
///   • composite the target over the scene with straight (NonPremultiplied) alpha
/// </summary>
public sealed class LightingRenderer : IDisposable
{
    // dest.a = dest.a*(1-src.a); dest.rgb preserved. == Canvas2D 'destination-out' on alpha.
    private static readonly BlendState CutoutAlpha = new()
    {
        ColorSourceBlend = Blend.Zero,
        ColorDestinationBlend = Blend.One,
        ColorBlendFunction = BlendFunction.Add,
        AlphaSourceBlend = Blend.Zero,
        AlphaDestinationBlend = Blend.InverseSourceAlpha,
        AlphaBlendFunction = BlendFunction.Add,
    };

    private readonly GraphicsDevice _gd;
    private readonly Texture2D _gradient;   // white, alpha falloff 1 -> 0.6@0.5 -> 0@1
    private readonly Texture2D _white;
    private RenderTarget2D? _target;

    public readonly record struct Light(float ScreenX, float ScreenY, float RadiusPx);

    public LightingRenderer(GraphicsDevice gd, Texture2D white)
    {
        _gd = gd;
        _white = white;
        _gradient = BakeRadialGradient(gd, 256);
    }

    /// <summary>
    /// Composite ambient darkness + light cut-outs over whatever is already on the backbuffer.
    /// darknessAlpha 0..1 (0.95 = night); skipped entirely if there's no darkness and no lights.
    /// </summary>
    public void RenderOverlay(SpriteBatch sb, Color darknessRgb, float darknessAlpha, IReadOnlyList<Light> lights)
    {
        if (darknessAlpha < 0.01f && lights.Count == 0) return;

        int w = _gd.PresentationParameters.BackBufferWidth;
        int h = _gd.PresentationParameters.BackBufferHeight;
        EnsureTarget(w, h);

        var prevTargets = _gd.GetRenderTargets();
        _gd.SetRenderTarget(_target);

        // Fill with ambient darkness (straight RGBA via Opaque).
        var dark = new Color(darknessRgb.R, darknessRgb.G, darknessRgb.B, (byte)(darknessAlpha * 255));
        sb.Begin(SpriteBatchMode(), BlendState.Opaque, SamplerState.PointClamp);
        sb.Draw(_white, new Rectangle(0, 0, w, h), dark);
        sb.End();

        // Cut light holes (destination-out on alpha), gradient sampled linearly for smooth falloff.
        if (lights.Count > 0)
        {
            sb.Begin(SpriteBatchMode(), CutoutAlpha, SamplerState.LinearClamp);
            foreach (var l in lights)
            {
                var dest = new Rectangle(
                    (int)(l.ScreenX - l.RadiusPx), (int)(l.ScreenY - l.RadiusPx),
                    (int)(l.RadiusPx * 2), (int)(l.RadiusPx * 2));
                sb.Draw(_gradient, dest, Color.White);
            }
            sb.End();
        }

        // Back to the screen; composite the darkness map over the scene with straight alpha.
        _gd.SetRenderTargets(prevTargets);
        sb.Begin(SpriteBatchMode(), BlendState.NonPremultiplied, SamplerState.PointClamp);
        sb.Draw(_target, new Rectangle(0, 0, w, h), Color.White);
        sb.End();
    }

    private static SpriteSortMode SpriteBatchMode() => SpriteSortMode.Deferred;

    private void EnsureTarget(int w, int h)
    {
        if (_target != null && _target.Width == w && _target.Height == h) return;
        _target?.Dispose();
        _target = new RenderTarget2D(_gd, w, h, false, SurfaceFormat.Color, DepthFormat.None);
    }

    // Radial gradient matching the engine's stops: alpha 1 at center, 0.6 at 50%, 0 at edge.
    private static Texture2D BakeRadialGradient(GraphicsDevice gd, int size)
    {
        var tex = new Texture2D(gd, size, size);
        var px = new Color[size * size];
        float c = size / 2f;
        for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                float r = MathF.Sqrt((x + 0.5f - c) * (x + 0.5f - c) + (y + 0.5f - c) * (y + 0.5f - c)) / c;
                float a = r <= 0.5f ? MathHelper.Lerp(1f, 0.6f, r / 0.5f)
                        : r <= 1f ? MathHelper.Lerp(0.6f, 0f, (r - 0.5f) / 0.5f)
                        : 0f;
                px[y * size + x] = new Color((byte)255, (byte)255, (byte)255, (byte)(a * 255)); // straight white, alpha=falloff
            }
        tex.SetData(px);
        return tex;
    }

    public void Dispose()
    {
        _gradient.Dispose();
        _target?.Dispose();
    }
}
