[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 📷 QR Code Generation

## Overview

EventZen's .NET Ticketing Service generates a **cryptographically signed QR code** for every ticket. The QR code encodes a tamper-proof payload linking the ticket ID, registration ID, and event ID - signed with an HMAC-SHA256 signature using a shared secret. This QR code is embedded in the ticket pass PDF and used at event entry for check-in validation.

This feature is the **server-side counterpart** to the [QR Auto-Scanning novelty feature](./novelty-qr-video-scanning.md), which handles real-time QR detection from a camera feed at the entry gate.

---

## QR Payload Format

```
{ticketId}|{registrationId}|{eventId}.{hmac}

Example:
3f7a1c2d-...|9e4b5a0f-...|c1d2e3f4-....bXlzaWduYXR1cmU=
```

| Part | Description |
|---|---|
| `ticketId` | Unique ticket document ID (GUID) |
| `registrationId` | Registration document ID (GUID) |
| `eventId` | Event this ticket belongs to (GUID) |
| `hmac` | Base64url-encoded HMAC-SHA256 of `payload` using the configured `QR_SECRET` |

The `.` (dot) separator distinguishes the data portion from the signature, making parsing unambiguous.

---

## Generation Process

```csharp
// QrCodeService.cs
public (string Payload, string Signature, string DataUri) Generate(
    Guid ticketId, Guid registrationId, Guid eventId, string secret)
{
    var payload   = $"{ticketId}|{registrationId}|{eventId}";
    var signature = Base64UrlEncode(HmacSha256(payload, secret));
    var qrContent = $"{payload}.{signature}";

    // Build SVG QR code using QRCoder (ECC Level Q = ~25% recovery)
    // Return as data:image/svg+xml;base64,... URI for PDF embedding
}
```

---

## Technical Implementation

| Property | Detail |
|---|---|
| Library | `QRCoder` (NuGet) |
| Output format | SVG (inline, vector) |
| ECC Level | Q - recovers up to 25% data loss (handles minor print/scan damage) |
| Size | 360×360px in output PDF |
| Quiet zone | 4 modules on each side (improves scanner compatibility) |
| Dark colour | `#0f172a` (near-black) on white background |
| Embedding | Serialised as `data:image/svg+xml;base64,{...}` and inlined into the PDF template |

---

## Key Source Files

| File | Purpose |
|---|---|
| `QrCodeService.cs` | Payload construction, HMAC signing, SVG QR generation |
| `JwtTokenService.cs` | Provides `HmacSha256()` and `Base64UrlEncode()` utility methods |
| `TicketDeliveryAssetService.cs` | Calls `QrCodeService.Generate()` and embeds the QR data URI in the ticket PDF |

---

## Verification at Check-In

When the check-in scanner (frontend camera) reads the QR code:

1. Parse the content: split on `.` to get `payload` and `signature`
2. Re-compute `HMAC-SHA256(payload, QR_SECRET)`
3. Compare with the scanned signature (constant-time comparison)
4. Split `payload` on `|` to extract `ticketId`, `registrationId`, `eventId`
5. Look up the ticket in the Ticketing Service DB and validate `status == ACTIVE`

If any step fails → entry denied.

---

## Security Properties

- **Unforgeable** - creating a valid QR requires knowledge of `QR_SECRET` which is stored only in HashiCorp Vault
- **Bound to specific ticket + registration + event** - a QR from one event cannot be used at another
- **Tamper-evident** - modifying any part of the payload invalidates the HMAC signature
- **No server round-trip for initial parse** - the check-in app can verify the signature locally; it only calls the API to confirm `status == ACTIVE` and mark the ticket as used
