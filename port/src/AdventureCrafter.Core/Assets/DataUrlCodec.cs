using System.Text;

namespace AdventureCrafter.Core.Assets;

/// <summary>
/// Encodes/decodes RFC 2397 "data:" URLs. Every binary asset in an Adventure Crafter save
/// (tileset images, sprite sheets, audio) is stored in-JSON as a base64 data URL, e.g.
/// "data:image/png;base64,iVBOR…". This is the one place that knows that format; the Runtime
/// turns the decoded bytes into Texture2D / audio, and the Editor re-encodes on save.
/// </summary>
public static class DataUrlCodec
{
    public readonly record struct DataUrl(string MimeType, byte[] Bytes);

    /// <summary>Parse a data URL into its mime type and raw bytes. Returns null if not a data URL.</summary>
    public static DataUrl? TryDecode(string? dataUrl)
    {
        if (string.IsNullOrEmpty(dataUrl) || !dataUrl.StartsWith("data:", StringComparison.Ordinal))
            return null;

        int comma = dataUrl.IndexOf(',');
        if (comma < 0) return null;

        string header = dataUrl.Substring(5, comma - 5); // between "data:" and ","
        string payload = dataUrl[(comma + 1)..];

        bool isBase64 = header.EndsWith(";base64", StringComparison.OrdinalIgnoreCase);
        string mime = header;
        if (isBase64) mime = header[..^7]; // strip ";base64"
        if (mime.Length == 0) mime = "text/plain";

        byte[] bytes = isBase64
            ? Convert.FromBase64String(payload)
            : Encoding.UTF8.GetBytes(Uri.UnescapeDataString(payload));

        return new DataUrl(mime, bytes);
    }

    /// <summary>Decode a data URL's bytes, throwing if the string is not a valid data URL.</summary>
    public static byte[] DecodeBytes(string dataUrl) =>
        TryDecode(dataUrl)?.Bytes ?? throw new FormatException("Not a valid data: URL");

    /// <summary>Build a base64 data URL from raw bytes and a mime type (e.g. "image/png").</summary>
    public static string Encode(byte[] bytes, string mimeType) =>
        $"data:{mimeType};base64,{Convert.ToBase64String(bytes)}";

    /// <summary>True if the string looks like a data URL.</summary>
    public static bool IsDataUrl(string? s) =>
        !string.IsNullOrEmpty(s) && s.StartsWith("data:", StringComparison.Ordinal);
}
