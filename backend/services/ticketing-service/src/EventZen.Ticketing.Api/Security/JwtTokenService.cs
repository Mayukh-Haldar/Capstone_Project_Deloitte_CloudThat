using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using EventZen.Ticketing.Api.Options;
using Microsoft.Extensions.Options;

namespace EventZen.Ticketing.Api.Security;

public sealed class JwtTokenService
{
    private readonly JwtOptions _options;

    public JwtTokenService(IOptions<JwtOptions> options)
    {
        _options = options.Value;
    }

    public UserContext ParseAccessToken(string token)
    {
        var parts = token.Split('.');
        if (parts.Length != 3)
        {
            throw new InvalidOperationException("Malformed token");
        }

        var headerJson = Encoding.UTF8.GetString(Base64UrlDecode(parts[0]));
        using var header = JsonDocument.Parse(headerJson);
        var algorithm = header.RootElement.TryGetProperty("alg", out var algElement)
            ? algElement.GetString()
            : null;

        var signingInput = $"{parts[0]}.{parts[1]}";
        var actualSignature = Base64UrlEncode(ComputeSignature(signingInput, _options.Secret, algorithm));
        if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(actualSignature), Encoding.UTF8.GetBytes(parts[2])))
        {
            throw new InvalidOperationException("Invalid signature");
        }

        var payloadJson = Encoding.UTF8.GetString(Base64UrlDecode(parts[1]));
        using var payload = JsonDocument.Parse(payloadJson);
        var root = payload.RootElement;

        if (root.TryGetProperty("iss", out var issuer) && !string.Equals(issuer.GetString(), _options.Issuer, StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Invalid issuer");
        }

        if (!root.TryGetProperty("type", out var type) || !string.Equals(type.GetString(), "access", StringComparison.Ordinal))
        {
            throw new InvalidOperationException("Only access tokens are allowed");
        }

        if (!root.TryGetProperty("exp", out var expElement) || DateTimeOffset.FromUnixTimeSeconds(expElement.GetInt64()) <= DateTimeOffset.UtcNow)
        {
            throw new InvalidOperationException("Token expired");
        }

        var userIdRaw = root.TryGetProperty("uid", out var uidElement) ? uidElement.GetString() : root.GetProperty("sub").GetString();
        if (!Guid.TryParse(userIdRaw, out var userId))
        {
            throw new InvalidOperationException("Missing uid claim");
        }

        var email = root.GetProperty("sub").GetString() ?? string.Empty;
        var roles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        if (root.TryGetProperty("authorities", out var authorities) && authorities.ValueKind == JsonValueKind.Array)
        {
            foreach (var value in authorities.EnumerateArray())
            {
                var raw = value.GetString();
                if (string.IsNullOrWhiteSpace(raw))
                {
                    continue;
                }

                roles.Add(raw.StartsWith("ROLE_", StringComparison.OrdinalIgnoreCase) ? raw[5..] : raw);
            }
        }

        return new UserContext(userId, email, roles);
    }

    public static string Base64UrlEncode(byte[] value)
    {
        return Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    public static byte[] Base64UrlDecode(string value)
    {
        var padded = value.Replace('-', '+').Replace('_', '/');
        while (padded.Length % 4 != 0)
        {
            padded += "=";
        }

        return Convert.FromBase64String(padded);
    }

    public static byte[] HmacSha256(string value, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(value));
    }

    public static byte[] HmacSha512(string value, string secret)
    {
        using var hmac = new HMACSHA512(Encoding.UTF8.GetBytes(secret));
        return hmac.ComputeHash(Encoding.UTF8.GetBytes(value));
    }

    private static byte[] ComputeSignature(string value, string secret, string? algorithm)
    {
        return algorithm switch
        {
            "HS512" => HmacSha512(value, secret),
            "HS256" or null => HmacSha256(value, secret),
            _ => throw new InvalidOperationException($"Unsupported JWT algorithm: {algorithm}")
        };
    }
}
