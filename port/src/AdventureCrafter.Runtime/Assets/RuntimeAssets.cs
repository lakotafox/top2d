using AdventureCrafter.Core.Assets;
using Microsoft.Xna.Framework.Graphics;

namespace AdventureCrafter.Runtime.Assets;

/// <summary>
/// Turns the save file's in-JSON base64 data: URLs into live GPU resources, with caching so a given
/// data URL is decoded exactly once. This is the runtime side of <see cref="DataUrlCodec"/>: the
/// editor stores assets as base64 in the project; the runtime decodes them to Texture2D here (and,
/// later, OGG → SoundEffect). No MonoGame content pipeline / .xnb files are involved.
/// </summary>
public sealed class RuntimeAssets : IDisposable
{
    private readonly GraphicsDevice _gd;
    private readonly Dictionary<string, Texture2D> _textures = new(ReferenceEqualityComparer.Instance);
    private readonly List<IDisposable> _owned = new();

    public RuntimeAssets(GraphicsDevice graphicsDevice) => _gd = graphicsDevice;

    /// <summary>
    /// Decode a base64 PNG data URL into a Texture2D (cached by the data-URL string reference).
    /// Returns null for a null/empty input. Uses PointClamp-friendly straight pixels — sampler
    /// state is set at draw time, not here.
    /// </summary>
    public Texture2D? Texture(string? dataUrl)
    {
        if (string.IsNullOrEmpty(dataUrl)) return null;
        if (_textures.TryGetValue(dataUrl, out var cached)) return cached;

        var decoded = DataUrlCodec.TryDecode(dataUrl);
        if (decoded is null)
        {
            Console.Error.WriteLine("[assets] not a data URL; skipping texture");
            return null;
        }

        try
        {
            using var ms = new MemoryStream(decoded.Value.Bytes);
            var tex = Texture2D.FromStream(_gd, ms);
            _textures[dataUrl] = tex;
            _owned.Add(tex);
            return tex;
        }
        catch (Exception ex)
        {
            // A non-PNG/unsupported image (e.g. WebP) shouldn't take down the whole load — render
            // the fallback tile instead. Log the mime + size so we can spot what to support later.
            Console.Error.WriteLine(
                $"[assets] decode failed ({decoded.Value.MimeType}, {decoded.Value.Bytes.Length}B): {ex.GetType().Name} {ex.Message}");
            return null;
        }
    }

    public void Dispose()
    {
        foreach (var d in _owned) d.Dispose();
        _owned.Clear();
        _textures.Clear();
    }
}
