using System.Text;
using EventZen.Ticketing.Api.Security;
using QRCoder;

namespace EventZen.Ticketing.Api.Services;

public sealed class QrCodeService
{
    public (string Payload, string Signature, string DataUri) Generate(Guid ticketId, Guid registrationId, Guid eventId, string secret)
    {
        var payload = $"{ticketId}|{registrationId}|{eventId}";
        var signature = JwtTokenService.Base64UrlEncode(JwtTokenService.HmacSha256(payload, secret));
        var qrContent = $"{payload}.{signature}";
        using var generator = new QRCodeGenerator();
        using var data = generator.CreateQrCode(qrContent, QRCodeGenerator.ECCLevel.Q);
        
        var modules = data.ModuleMatrix;
        var sz = modules.Count;
        var qrSvgBuilder = new StringBuilder();
        var quiet = 4; // Add a quiet zone of 4 modules on each side
        var totalSz = sz + (quiet * 2);
        
        // Use a single SVG so the PDF generator parses all rects
        qrSvgBuilder.AppendLine($"<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"360\" height=\"360\" viewBox=\"0 0 {totalSz} {totalSz}\">");
        qrSvgBuilder.AppendLine($"  <rect width=\"{totalSz}\" height=\"{totalSz}\" fill=\"#ffffff\"/>");
        
        for (int y = 0; y < sz; y++)
        {
            for (int x = 0; x < sz; x++)
            {
                if (modules[y][x])
                {
                    qrSvgBuilder.AppendLine($"  <rect x=\"{x + quiet}\" y=\"{y + quiet}\" width=\"1\" height=\"1\" fill=\"#0f172a\" />");
                }
            }
        }
        qrSvgBuilder.AppendLine("</svg>");
        
        var svg = qrSvgBuilder.ToString();

        var dataUri = $"data:image/svg+xml;base64,{Convert.ToBase64String(Encoding.UTF8.GetBytes(svg))}";
        return (payload, signature, dataUri);
    }
}
