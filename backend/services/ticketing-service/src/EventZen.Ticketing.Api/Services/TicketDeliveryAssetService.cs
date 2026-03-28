using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using EventZen.Ticketing.Api.Domain;

namespace EventZen.Ticketing.Api.Services;

public sealed class TicketDeliveryAssetService
{
    private static readonly TimeZoneInfo EventTimeZone = ResolveEventTimeZone();

    public string BuildConfirmationEmailHtml(RegistrationDocument registration, TicketDocument ticket)
    {
        var border = "#d8e2ff";
        var accentSoft = "#eff4ff";
        var text = "#0f172a";
        var muted = "#64748b";
        var success = "#059669";
        var venue = BuildVenue(registration);
        var eventTime = FormatDateTime(registration.EventStartTime);
        var serial = GetTicketSerial(ticket.TicketNumber);

        return $$"""
<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:linear-gradient(135deg,#eef3fb 0%,#f8fbff 50%,#eff4ff 100%);font-family:'Segoe UI',system-ui,-apple-system,BlinkMacSystemFont,Arial,sans-serif;color:{{text}};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:750px;background:#ffffff;border:2px solid {{border}};border-radius:32px;overflow:hidden;box-shadow:0 25px 60px rgba(17,50,212,0.12),0 8px 20px rgba(17,50,212,0.08);">
            <!-- Premium Header -->
            <tr>
              <td style="padding:0;background:linear-gradient(135deg,#1132d4 0%,#4f7cff 40%,#7aa3ff 100%);position:relative;">
                <div style="padding:36px 40px;position:relative;z-index:2;">
                  <div style="display:flex;align-items:center;margin-bottom:20px;">
                    <div style="font-size:13px;letter-spacing:0.25em;text-transform:uppercase;font-weight:800;color:#ffffff;opacity:0.9;background:rgba(255,255,255,0.15);padding:8px 16px;border-radius:20px;display:inline-block;">EventZen Premium</div>
                  </div>
                  <h1 style="margin:0 0 16px;font-size:38px;line-height:1.1;font-weight:900;color:#ffffff;text-shadow:0 2px 4px rgba(0,0,0,0.1);">Ticket Confirmed!</h1>
                  <h2 style="margin:0 0 20px;font-size:24px;line-height:1.3;font-weight:700;color:#ffffff;opacity:0.95;">{{EscapeHtml(registration.EventTitle)}}</h2>
                  <div style="background:rgba(255,255,255,0.1);padding:18px 24px;border-radius:20px;border:1px solid rgba(255,255,255,0.2);backdrop-filter:blur(10px);">
                    <p style="margin:0;font-size:16px;line-height:1.6;color:#ffffff;opacity:0.95;">
                      🎉 Your <strong>{{EscapeHtml(registration.TicketTypeName)}}</strong> pass is confirmed and ready! We've attached your premium PDF ticket pass designed for easy sharing and professional presentation.
                    </p>
                  </div>
                </div>
                <!-- Decorative elements -->
                <div style="position:absolute;top:-20px;right:-20px;width:100px;height:100px;background:rgba(255,255,255,0.05);border-radius:50%;z-index:1;"></div>
                <div style="position:absolute;bottom:-30px;left:-30px;width:80px;height:80px;background:rgba(255,255,255,0.08);border-radius:50%;z-index:1;"></div>
              </td>
            </tr>

            <!-- Enhanced Ticket Information -->
            <tr>
              <td style="padding:40px;">
                <!-- Success Banner -->
                <div style="background:linear-gradient(90deg,{{success}} 0%,#10b981 100%);color:#ffffff;padding:20px 28px;border-radius:24px;margin-bottom:32px;text-align:center;">
                  <div style="font-size:14px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;opacity:0.9;">✓ Registration Complete</div>
                  <div style="font-size:18px;font-weight:700;margin-top:4px;">Ready for Event Entry</div>
                </div>

                <!-- Premium Ticket Serial -->
                <div style="background:linear-gradient(135deg,{{accentSoft}} 0%,#f1f6ff 100%);border:2px solid {{border}};border-radius:28px;padding:28px 32px;margin-bottom:28px;position:relative;overflow:hidden;">
                  <div style="position:absolute;top:-10px;right:-10px;width:60px;height:60px;background:rgba(17,50,212,0.05);border-radius:50%;"></div>
                  <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:#6f89d7;font-weight:800;margin-bottom:8px;">Premium Ticket Serial</div>
                  <div style="font-size:32px;font-weight:900;color:{{text}};margin-bottom:8px;">{{EscapeHtml(serial)}}</div>
                  <div style="font-size:14px;color:{{muted}};font-weight:600;">Ticket ID: {{EscapeHtml(ticket.TicketNumber)}}</div>
                </div>

                <!-- Enhanced Information Grid -->
                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                  <tr>
                    <td valign="top" style="width:48%;padding-right:2%;">
                      <div style="background:#ffffff;border:2px solid #e8f1ff;border-radius:24px;padding:24px;height:100%;box-shadow:0 4px 12px rgba(17,50,212,0.05);">
                        <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6f89d7;font-weight:800;margin-bottom:12px;">🕒 Event Time</div>
                        <div style="font-size:18px;font-weight:800;color:{{text}};line-height:1.3;">{{EscapeHtml(eventTime)}}</div>
                      </div>
                    </td>
                    <td valign="top" style="width:48%;padding-left:2%;">
                      <div style="background:#ffffff;border:2px solid #e8f1ff;border-radius:24px;padding:24px;height:100%;box-shadow:0 4px 12px rgba(17,50,212,0.05);">
                        <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#6f89d7;font-weight:800;margin-bottom:12px;">📍 Venue</div>
                        <div style="font-size:18px;font-weight:800;color:{{text}};line-height:1.3;">{{EscapeHtml(venue)}}</div>
                      </div>
                    </td>
                  </tr>
                </table>

                <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:28px;">
                  <tr>
                    <td valign="top" style="width:48%;padding-right:2%;">
                      <div style="background:linear-gradient(135deg,#fff7ed 0%,#fef3c7 100%);border:2px solid #fbbf24;border-radius:24px;padding:24px;box-shadow:0 4px 12px rgba(251,191,36,0.15);">
                        <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:#92400e;font-weight:800;margin-bottom:12px;">🎫 Admission Tier</div>
                        <div style="font-size:18px;font-weight:800;color:#92400e;line-height:1.3;">{{EscapeHtml(registration.TicketTypeName)}}</div>
                      </div>
                    </td>
                    <td valign="top" style="width:48%;padding-left:2%;">
                      <div style="background:#f8faff;border:2px solid #e2e8f0;border-radius:24px;padding:24px;box-shadow:0 4px 12px rgba(0,0,0,0.03);">
                        <div style="font-size:10px;letter-spacing:0.2em;text-transform:uppercase;color:{{muted}};font-weight:800;margin-bottom:12px;">🔢 Registration</div>
                        <div style="font-size:14px;font-weight:700;color:{{text}};font-family:monospace;">{{registration.Id}}</div>
                      </div>
                    </td>
                  </tr>
                </table>

                {{(registration.SeatRow is not null && registration.SeatColumn is not null ? $$"""
                <!-- Seat Assignment -->
                <div style="background:linear-gradient(135deg,#1132d4 0%,#4f7cff 100%);border-radius:28px;padding:24px 32px;margin-bottom:28px;text-align:center;">
                  <div style="font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.7);font-weight:800;margin-bottom:8px;">&#127916; Your Assigned Seat</div>
                  <div style="font-size:40px;font-weight:900;color:#ffffff;line-height:1;">{{registration.SeatRow}}{{registration.SeatColumn}}</div>
                  <div style="font-size:14px;color:rgba(255,255,255,0.8);margin-top:6px;font-weight:600;">Row {{registration.SeatRow}} &middot; Seat No. {{registration.SeatColumn}}</div>
                </div>
""" : "")}}
                <!-- Enhanced Instructions -->
                <div style="background:linear-gradient(135deg,#f0fdf4 0%,#ecfdf5 100%);border:2px dashed {{success}};border-radius:28px;padding:28px 32px;text-align:center;margin-bottom:20px;">
                  <div style="font-size:16px;font-weight:800;color:{{success}};margin-bottom:12px;">📱 Entry Instructions</div>
                  <div style="color:{{success}};font-size:15px;line-height:1.7;font-weight:600;">
                    Present your attached PDF ticket at the venue entrance. The QR code is uniquely generated for this registration and optimized for quick scanning.
                  </div>
                </div>
              </td>
            </tr>

            <!-- Enhanced Footer -->
            <tr>
              <td style="padding:0 40px 36px;text-align:center;">
                <div style="border-top:1px solid #e8f1ff;padding-top:24px;">
                  <div style="color:#94a3b8;font-size:13px;line-height:1.6;font-weight:500;">
                    EventZen Premium Service • Generated automatically for confirmed registrations<br>
                    <strong>Keep this confirmation for your records</strong>
                  </div>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
""";
    }

    public byte[] BuildTicketPassPdf(RegistrationDocument registration, TicketDocument ticket)
    {
        var commands = new List<string>();
        const int pageWidth = 595;
        const int pageHeight = 842;
        
        var serial = GetTicketSerial(ticket.TicketNumber);

        // Background (Pale Blue)
        DrawFilledRectangle(commands, 0, 0, pageWidth, pageHeight, 235, 245, 255);

        // Ticket dimensions
        decimal ticketWidth = 320m;
        decimal ticketHeight = 720m;
        decimal ticketX = (pageWidth - ticketWidth) / 2m;
        decimal ticketY = (pageHeight - ticketHeight) / 2m;

        decimal bottomHeight = 420m; 
        decimal topHeight = ticketHeight - bottomHeight;
        decimal bottomY = ticketY;
        decimal topY = ticketY + bottomHeight;

        // Main ticket container with shadow
        DrawFilledRectangle(commands, ticketX + 5, ticketY - 5, ticketWidth, ticketHeight, 200, 215, 235);
        DrawFilledRectangle(commands, ticketX, ticketY, ticketWidth, ticketHeight, 255, 255, 255);

        // Bottom part (Blue)
        DrawFilledRectangle(commands, ticketX, bottomY, ticketWidth, bottomHeight, 17, 50, 212);
        
        // Striped top margin (Blue stripe at the very top of the white part)
        DrawFilledRectangle(commands, ticketX, ticketY + ticketHeight - 15m, ticketWidth, 15m, 17, 50, 212);

        // Helper to draw circles for side notches (matching background color to simulate cutout)
        DrawFilledCircle(commands, ticketX, topY, 15m, 235, 245, 255);
        DrawFilledCircle(commands, ticketX + ticketWidth, topY, 15m, 235, 245, 255);

        // Separator line (Dashed or solid)
        DrawFilledRectangle(commands, ticketX + 20, topY, ticketWidth - 40, 2m, 235, 245, 255);

        // --- White Section Content (Top) ---
        decimal currentY = topY + topHeight - 40m;
        WriteText(commands, "EVENT PASS", ticketX + 25, currentY, 10, "Helvetica-Bold", 100, 116, 139);
        currentY -= 25m;
        WriteMultilineText(commands, registration.EventTitle, ticketX + 25, currentY, 22, "Helvetica-Bold", 17, 50, 212, 22, 26);
        currentY -= 70m;
        
        WriteText(commands, "EVENT TIME", ticketX + 25, currentY, 9, "Helvetica-Bold", 150, 160, 180);
        currentY -= 15m;
        WriteMultilineText(commands, FormatDateTime(registration.EventStartTime), ticketX + 25, currentY, 12, "Helvetica", 30, 40, 50, 35, 14);
        currentY -= 30m;

        WriteText(commands, "VENUE", ticketX + 25, currentY, 9, "Helvetica-Bold", 150, 160, 180);
        currentY -= 15m;
        WriteMultilineText(commands, BuildVenue(registration), ticketX + 25, currentY, 12, "Helvetica", 30, 40, 50, 35, 14);
        currentY -= 40m;

        WriteText(commands, "ENTRY INSTRUCTIONS", ticketX + 25, currentY, 9, "Helvetica-Bold", 150, 160, 180);
        currentY -= 15m;
        WriteMultilineText(commands, "Present this pass at venue entrance. Keep QR code visible for scanning.", ticketX + 25, currentY, 10, "Helvetica", 30, 40, 50, 45, 12);

        // --- Blue Section Content (Bottom) ---
        currentY = topY - 35m;
        
        WriteText(commands, "TICKET TYPE", ticketX + 25, currentY, 9, "Helvetica-Bold", 150, 180, 255);
        WriteText(commands, "TICKET SERIAL", ticketX + 180, currentY, 9, "Helvetica-Bold", 150, 180, 255);
        currentY -= 15m;
        var ticketTypeLines = WriteWrappedText(commands, registration.TicketTypeName, ticketX + 25, currentY, 12, "Helvetica-Bold", 255, 255, 255, 18, 14);
        var serialLines = WriteWrappedText(commands, serial, ticketX + 180, currentY, 12, "Helvetica-Bold", 255, 255, 255, 12, 14);
        currentY -= Math.Max(ticketTypeLines, serialLines) * 14m + 18m;

        if (registration.SeatRow is not null && registration.SeatColumn is not null)
        {
            WriteText(commands, "SEAT", ticketX + 25, currentY, 9, "Helvetica-Bold", 150, 180, 255);
            currentY -= 15m;
            var seatLines = WriteWrappedText(commands, $"Row {registration.SeatRow} / No. {registration.SeatColumn}", ticketX + 25, currentY, 12, "Helvetica-Bold", 255, 255, 255, 22, 14);
            currentY -= seatLines * 14m + 18m;
        }

        WriteText(commands, "REGISTRATION ID", ticketX + 25, currentY, 9, "Helvetica-Bold", 150, 180, 255);
        currentY -= 15m;
        var registrationIdLines = WriteWrappedText(commands, registration.Id.ToString(), ticketX + 25, currentY, 11, "Courier", 255, 255, 255, 26, 12);
        currentY -= registrationIdLines * 12m + 18m;

        WriteText(commands, "VERIFICATION DATA", ticketX + 25, currentY, 9, "Helvetica-Bold", 150, 180, 255);
        currentY -= 15m;
        var verificationLines = WriteWrappedText(commands, ticket.QrPayload, ticketX + 25, currentY, 8, "Courier", 200, 220, 255, 42, 10);
        currentY -= verificationLines * 10m + 18m;

        // QR Code securely placed below text
        decimal qrSize = 120m;
        decimal qrX = ticketX + (ticketWidth - qrSize) / 2m;
        decimal qrY = currentY - qrSize;

        DrawFilledRectangle(commands, qrX - 5, qrY - 5, qrSize + 10, qrSize + 10, 255, 255, 255);

        if (!TryDrawQrSvg(commands, ticket.QrCodeSvgDataUri, qrX, qrY, qrSize, qrSize))
        {
            DrawStrokedRectangle(commands, qrX, qrY, qrSize, qrSize, 17, 50, 212, 2m);
            WriteText(commands, "QR CODE", qrX + (qrSize / 2) - 25, qrY + (qrSize / 2), 12, "Helvetica-Bold", 17, 50, 212);
        }

        var stream = string.Join("\n", commands) + "\n";
        return BuildPdfDocument(stream, pageWidth, pageHeight);
    }

    private static void DrawFilledCircle(List<string> commands, decimal cx, decimal cy, decimal r, int red, int green, int blue)
    {
        commands.Add($"{ToDecimal(red / 255m)} {ToDecimal(green / 255m)} {ToDecimal(blue / 255m)} rg");
        decimal magic = 0.552284749831m;
        decimal control = r * magic;
        commands.Add($"{ToDecimal(cx)} {ToDecimal(cy - r)} m");
        commands.Add($"{ToDecimal(cx + control)} {ToDecimal(cy - r)} {ToDecimal(cx + r)} {ToDecimal(cy - control)} {ToDecimal(cx + r)} {ToDecimal(cy)} c");
        commands.Add($"{ToDecimal(cx + r)} {ToDecimal(cy + control)} {ToDecimal(cx + control)} {ToDecimal(cy + r)} {ToDecimal(cx)} {ToDecimal(cy + r)} c");
        commands.Add($"{ToDecimal(cx - control)} {ToDecimal(cy + r)} {ToDecimal(cx - r)} {ToDecimal(cy + control)} {ToDecimal(cx - r)} {ToDecimal(cy)} c");
        commands.Add($"{ToDecimal(cx - r)} {ToDecimal(cy - control)} {ToDecimal(cx - control)} {ToDecimal(cy - r)} {ToDecimal(cx)} {ToDecimal(cy - r)} c");
        commands.Add("f");
    }

    private static string BuildVenue(RegistrationDocument registration)
    {
        return string.IsNullOrWhiteSpace(registration.VenueCity)
            ? registration.VenueName ?? "Venue TBD"
            : $"{registration.VenueName ?? "Venue TBD"}, {registration.VenueCity}";
    }

    private static string FormatDateTime(DateTimeOffset value)
    {
        var localized = TimeZoneInfo.ConvertTime(value, EventTimeZone);
        return localized.ToString("ddd, dd MMM yyyy - hh:mm tt", CultureInfo.InvariantCulture);
    }

    private static TimeZoneInfo ResolveEventTimeZone()
    {
        foreach (var timeZoneId in new[] { "Asia/Kolkata", "India Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(timeZoneId);
            }
            catch (TimeZoneNotFoundException)
            {
            }
            catch (InvalidTimeZoneException)
            {
            }
        }

        return TimeZoneInfo.Utc;
    }

    private static string GetTicketSerial(string ticketNumber)
    {
        var segments = ticketNumber.Split('-', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length == 0 ? ticketNumber : segments[^1];
    }

    private static void DrawFilledRectangle(List<string> commands, decimal x, decimal y, decimal width, decimal height, int r, int g, int b)
    {
        commands.Add($"{ToDecimal(r / 255m)} {ToDecimal(g / 255m)} {ToDecimal(b / 255m)} rg");
        commands.Add($"{ToDecimal(x)} {ToDecimal(y)} {ToDecimal(width)} {ToDecimal(height)} re f");
    }

    private static void DrawStrokedRectangle(List<string> commands, decimal x, decimal y, decimal width, decimal height, int r, int g, int b, decimal lineWidth)
    {
        commands.Add($"{ToDecimal(lineWidth)} w");
        commands.Add($"{ToDecimal(r / 255m)} {ToDecimal(g / 255m)} {ToDecimal(b / 255m)} RG");
        commands.Add($"{ToDecimal(x)} {ToDecimal(y)} {ToDecimal(width)} {ToDecimal(height)} re S");
    }

    private static void WriteText(List<string> commands, string text, decimal x, decimal y, decimal fontSize, string fontName, int r, int g, int b)
    {
        commands.Add("BT");
        commands.Add($"/{MapFont(fontName)} {ToDecimal(fontSize)} Tf");
        commands.Add($"{ToDecimal(r / 255m)} {ToDecimal(g / 255m)} {ToDecimal(b / 255m)} rg");
        commands.Add($"1 0 0 1 {ToDecimal(x)} {ToDecimal(y)} Tm");
        commands.Add($"({EscapePdf(text)}) Tj");
        commands.Add("ET");
    }

    private static void WriteMultilineText(
        List<string> commands,
        string text,
        decimal x,
        decimal y,
        decimal fontSize,
        string fontName,
        int r,
        int g,
        int b,
        int maxCharsPerLine,
        decimal lineHeight)
    {
        var currentY = y;
        foreach (var line in WrapText(text, maxCharsPerLine))
        {
            WriteText(commands, line, x, currentY, fontSize, fontName, r, g, b);
            currentY -= lineHeight;
        }
    }

    private static int WriteWrappedText(
        List<string> commands,
        string text,
        decimal x,
        decimal y,
        decimal fontSize,
        string fontName,
        int r,
        int g,
        int b,
        int maxCharsPerLine,
        decimal lineHeight)
    {
        var lines = WrapText(text, maxCharsPerLine).ToList();
        var currentY = y;
        foreach (var line in lines)
        {
            WriteText(commands, line, x, currentY, fontSize, fontName, r, g, b);
            currentY -= lineHeight;
        }

        return Math.Max(lines.Count, 1);
    }

    private static IEnumerable<string> WrapText(string text, int maxCharsPerLine)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            yield return string.Empty;
            yield break;
        }

        foreach (var paragraph in text.Split('\n'))
        {
            var words = paragraph.Split(' ', StringSplitOptions.RemoveEmptyEntries);
            var line = new StringBuilder();
            foreach (var word in words)
            {
                if (word.Length > maxCharsPerLine)
                {
                    if (line.Length > 0)
                    {
                        yield return line.ToString();
                        line.Clear();
                    }

                    foreach (var chunk in ChunkWord(word, maxCharsPerLine))
                    {
                        yield return chunk;
                    }

                    continue;
                }

                if (line.Length == 0)
                {
                    line.Append(word);
                    continue;
                }

                if (line.Length + 1 + word.Length <= maxCharsPerLine)
                {
                    line.Append(' ').Append(word);
                    continue;
                }

                yield return line.ToString();
                line.Clear();
                line.Append(word);
            }

            if (line.Length > 0)
            {
                yield return line.ToString();
            }
        }
    }

    private static IEnumerable<string> ChunkWord(string word, int maxCharsPerLine)
    {
        for (var index = 0; index < word.Length; index += maxCharsPerLine)
        {
            yield return word.Substring(index, Math.Min(maxCharsPerLine, word.Length - index));
        }
    }

    private static bool TryDrawQrSvg(List<string> commands, string dataUri, decimal x, decimal y, decimal width, decimal height)
    {
        const string prefix = "data:image/svg+xml;base64,";
        if (string.IsNullOrWhiteSpace(dataUri) || !dataUri.StartsWith(prefix, StringComparison.Ordinal))
        {
            return false;
        }

        try
        {
            var svgBytes = Convert.FromBase64String(dataUri[prefix.Length..]);
            var svgMarkup = Encoding.UTF8.GetString(svgBytes);
            var document = XDocument.Parse(svgMarkup);
            var svgNodes = document.Descendants().Where(node => string.Equals(node.Name.LocalName, "svg", StringComparison.OrdinalIgnoreCase)).ToList();
            var root = svgNodes.Count > 1 ? svgNodes[1] : document.Root;
            if (root is null)
            {
                return false;
            }

            var viewBox = ParseViewBox(root.Attribute("viewBox")?.Value);
            if (viewBox is null)
            {
                return false;
            }

            DrawSvgNode(commands, root, new SvgTransform(0m, 0m, 1m, 1m), x, y, width, height, viewBox.Value.Width, viewBox.Value.Height);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static void DrawSvgNode(
        List<string> commands,
        XElement node,
        SvgTransform inheritedTransform,
        decimal targetX,
        decimal targetY,
        decimal targetWidth,
        decimal targetHeight,
        decimal viewBoxWidth,
        decimal viewBoxHeight)
    {
        var transform = inheritedTransform.Combine(ParseTransform(node.Attribute("transform")?.Value));
        if (string.Equals(node.Name.LocalName, "rect", StringComparison.OrdinalIgnoreCase))
        {
            var rectX = transform.TranslateX + (ParseDecimal(node.Attribute("x")?.Value) * transform.ScaleX);
            var rectY = transform.TranslateY + (ParseDecimal(node.Attribute("y")?.Value) * transform.ScaleY);
            var rectWidth = ParseDecimal(node.Attribute("width")?.Value) * transform.ScaleX;
            var rectHeight = ParseDecimal(node.Attribute("height")?.Value) * transform.ScaleY;
            var fill = node.Attribute("fill")?.Value;
            var stroke = node.Attribute("stroke")?.Value;

            var pdfX = targetX + (rectX / viewBoxWidth) * targetWidth;
            var pdfWidth = (rectWidth / viewBoxWidth) * targetWidth;
            var pdfHeight = (rectHeight / viewBoxHeight) * targetHeight;
            var pdfY = targetY + targetHeight - ((rectY + rectHeight) / viewBoxHeight) * targetHeight;

            if (!string.Equals(fill, "none", StringComparison.OrdinalIgnoreCase) && TryParseHexColor(fill, out var fillColor))
            {
                DrawFilledRectangle(commands, pdfX, pdfY, pdfWidth, pdfHeight, fillColor.R, fillColor.G, fillColor.B);
            }

            if (!string.IsNullOrWhiteSpace(stroke) &&
                !string.Equals(stroke, "none", StringComparison.OrdinalIgnoreCase) &&
                TryParseHexColor(stroke, out var strokeColor))
            {
                DrawStrokedRectangle(commands, pdfX, pdfY, pdfWidth, pdfHeight, strokeColor.R, strokeColor.G, strokeColor.B, Math.Max(0.5m, ParseDecimal(node.Attribute("stroke-width")?.Value)));
            }
        }

        foreach (var child in node.Elements())
        {
            DrawSvgNode(commands, child, transform, targetX, targetY, targetWidth, targetHeight, viewBoxWidth, viewBoxHeight);
        }
    }

    private static SvgViewBox? ParseViewBox(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var parts = value.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length != 4)
        {
            return null;
        }

        return new SvgViewBox(
            ParseDecimal(parts[0]),
            ParseDecimal(parts[1]),
            ParseDecimal(parts[2]),
            ParseDecimal(parts[3]));
    }

    private static SvgTransform ParseTransform(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return new SvgTransform(0m, 0m, 1m, 1m);
        }

        decimal translateX = 0m;
        decimal translateY = 0m;
        decimal scaleX = 1m;
        decimal scaleY = 1m;

        var translateMatch = Regex.Match(value, @"translate\(([-0-9.]+)(?:[,\s]+([-0-9.]+))?\)", RegexOptions.IgnoreCase);
        if (translateMatch.Success)
        {
            translateX = ParseDecimal(translateMatch.Groups[1].Value);
            translateY = translateMatch.Groups[2].Success ? ParseDecimal(translateMatch.Groups[2].Value) : 0m;
        }

        var scaleMatch = Regex.Match(value, @"scale\(([-0-9.]+)(?:[,\s]+([-0-9.]+))?\)", RegexOptions.IgnoreCase);
        if (scaleMatch.Success)
        {
            scaleX = ParseDecimal(scaleMatch.Groups[1].Value);
            scaleY = scaleMatch.Groups[2].Success ? ParseDecimal(scaleMatch.Groups[2].Value) : scaleX;
        }

        return new SvgTransform(translateX, translateY, scaleX, scaleY);
    }

    private static decimal ParseDecimal(string? value)
    {
        return decimal.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed) ? parsed : 0m;
    }

    private static bool TryParseHexColor(string? value, out PdfColor color)
    {
        color = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var normalized = value.Trim();
        if (!normalized.StartsWith("#", StringComparison.Ordinal) || (normalized.Length != 7 && normalized.Length != 4))
        {
            return false;
        }

        if (normalized.Length == 4)
        {
            normalized = $"#{normalized[1]}{normalized[1]}{normalized[2]}{normalized[2]}{normalized[3]}{normalized[3]}";
        }

        color = new PdfColor(
            Convert.ToInt32(normalized.Substring(1, 2), 16),
            Convert.ToInt32(normalized.Substring(3, 2), 16),
            Convert.ToInt32(normalized.Substring(5, 2), 16));
        return true;
    }

    private static byte[] BuildPdfDocument(string stream, int pageWidth, int pageHeight)
    {
        var objects = new List<string>
        {
            "<< /Type /Catalog /Pages 2 0 R >>",
            "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
            $"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {pageWidth} {pageHeight}] /Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
            "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>"
        };

        var streamBytes = Encoding.ASCII.GetBytes(stream);
        objects.Add($"<< /Length {streamBytes.Length} >>\nstream\n{stream}\nendstream");

        var builder = new StringBuilder("%PDF-1.4\n");
        var offsets = new List<int>();
        for (var index = 0; index < objects.Count; index++)
        {
            offsets.Add(builder.Length);
            builder.Append(index + 1).Append(" 0 obj\n").Append(objects[index]).Append("\nendobj\n");
        }

        var xrefOffset = builder.Length;
        builder.Append("xref\n0 ").Append(objects.Count + 1).Append('\n');
        builder.Append("0000000000 65535 f \n");
        foreach (var offset in offsets)
        {
            builder.Append(offset.ToString("D10", CultureInfo.InvariantCulture)).Append(" 00000 n \n");
        }

        builder.Append("trailer\n<< /Size ").Append(objects.Count + 1).Append(" /Root 1 0 R >>\n");
        builder.Append("startxref\n").Append(xrefOffset).Append("\n%%EOF");
        return Encoding.ASCII.GetBytes(builder.ToString());
    }

    private static string MapFont(string fontName) => fontName switch
    {
        "Helvetica-Bold" => "F2",
        "Courier" => "F3",
        _ => "F1"
    };

    private static string ToDecimal(decimal value) => value.ToString("0.###", CultureInfo.InvariantCulture);

    private static string EscapePdf(string value) => value
        .Replace("\\", "\\\\", StringComparison.Ordinal)
        .Replace("(", "\\(", StringComparison.Ordinal)
        .Replace(")", "\\)", StringComparison.Ordinal);

    private static string EscapeHtml(string value) => System.Net.WebUtility.HtmlEncode(value);

    private readonly record struct SvgTransform(decimal TranslateX, decimal TranslateY, decimal ScaleX, decimal ScaleY)
    {
        public SvgTransform Combine(SvgTransform local) => new(
            TranslateX + (local.TranslateX * ScaleX),
            TranslateY + (local.TranslateY * ScaleY),
            ScaleX * local.ScaleX,
            ScaleY * local.ScaleY);
    }

    private readonly record struct SvgViewBox(decimal X, decimal Y, decimal Width, decimal Height);

    private readonly record struct PdfColor(int R, int G, int B);
}
