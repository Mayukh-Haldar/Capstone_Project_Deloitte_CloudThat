using System.Text;
using System.Text.Json;
using EventZen.Ticketing.Api.Options;
using EventZen.Ticketing.Api.Security;
using Microsoft.Extensions.Options;
using Xunit;

namespace EventZen.Ticketing.Tests;

public sealed class JwtTokenServiceTests
{
    private const string TestSecret = "change-me-change-me-change-me-change-me-1234567890";
    private const string TestIssuer = "eventzen-auth-service";

    private static IOptions<JwtOptions> DefaultOptions() =>
        Options.Create(new JwtOptions { Secret = TestSecret, Issuer = TestIssuer });

    // ──────────────────────────────────────────────────────────────────────
    // TKT-JWT-001: HS512 token with ROLE_ prefix is parsed correctly
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public void ParseAccessToken_Reads_AuthServiceClaims()
    {
        var service = new JwtTokenService(DefaultOptions());
        var userId = Guid.NewGuid();
        var token = CreateToken(userId, "attendee@eventzen.local", TestSecret, TestIssuer, ["ROLE_ATTENDEE", "ROLE_ADMIN"], "HS512");

        var user = service.ParseAccessToken(token);

        Assert.Equal(userId, user.UserId);
        Assert.Equal("attendee@eventzen.local", user.Email);
        Assert.Contains("ATTENDEE", user.Roles);
        Assert.Contains("ADMIN", user.Roles);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-JWT-002: HS256 signed token is accepted
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public void ParseAccessToken_HS256_Works()
    {
        var service = new JwtTokenService(DefaultOptions());
        var userId = Guid.NewGuid();
        var token = CreateToken(userId, "hs256@eventzen.local", TestSecret, TestIssuer, ["ROLE_ORGANIZER"], "HS256");

        var user = service.ParseAccessToken(token);

        Assert.Equal(userId, user.UserId);
        Assert.Contains("ORGANIZER", user.Roles);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-JWT-003: Expired token is rejected
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public void ParseAccessToken_ExpiredToken_Throws()
    {
        var service = new JwtTokenService(DefaultOptions());
        var userId = Guid.NewGuid();
        var token = CreateToken(userId, "exp@eventzen.local", TestSecret, TestIssuer, ["ROLE_ATTENDEE"], "HS512", expiredMinutesAgo: 5);

        Assert.ThrowsAny<Exception>(() => service.ParseAccessToken(token));
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-JWT-004: Token with wrong issuer is rejected
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public void ParseAccessToken_WrongIssuer_Throws()
    {
        var service = new JwtTokenService(DefaultOptions());
        var token = CreateToken(Guid.NewGuid(), "bad@eventzen.local", TestSecret, "rogue-service", ["ROLE_ATTENDEE"], "HS512");

        Assert.ThrowsAny<Exception>(() => service.ParseAccessToken(token));
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-JWT-005: Token whose "type" claim is not "access" is rejected
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public void ParseAccessToken_WrongType_Throws()
    {
        var service = new JwtTokenService(DefaultOptions());
        var token = CreateToken(Guid.NewGuid(), "refresh@eventzen.local", TestSecret, TestIssuer, ["ROLE_ATTENDEE"], "HS512", tokenType: "refresh");

        Assert.ThrowsAny<Exception>(() => service.ParseAccessToken(token));
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-JWT-006: Token with wrong signing secret is rejected
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public void ParseAccessToken_InvalidSignature_Throws()
    {
        var service = new JwtTokenService(DefaultOptions());
        var token = CreateToken(Guid.NewGuid(), "bad-sig@eventzen.local", "wrong-secret-wrong-secret-wrong-secret-000", TestIssuer, ["ROLE_ATTENDEE"], "HS512");

        Assert.ThrowsAny<Exception>(() => service.ParseAccessToken(token));
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-JWT-007: Completely malformed token string is rejected
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public void ParseAccessToken_MalformedToken_Throws()
    {
        var service = new JwtTokenService(DefaultOptions());

        Assert.ThrowsAny<Exception>(() => service.ParseAccessToken("not.a.jwt"));
    }

    private static string CreateToken(
        Guid userId,
        string email,
        string secret,
        string issuer,
        string[] authorities,
        string algorithm,
        int? expiredMinutesAgo = null,
        string tokenType = "access")
    {
        var header = JwtTokenService.Base64UrlEncode(Encoding.UTF8.GetBytes($$"""{"alg":"{{algorithm}}","typ":"JWT"}"""));
        var exp = expiredMinutesAgo.HasValue
            ? DateTimeOffset.UtcNow.AddMinutes(-expiredMinutesAgo.Value).ToUnixTimeSeconds()
            : DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds();
        var payloadObject = new
        {
            sub = email,
            iss = issuer,
            type = tokenType,
            uid = userId,
            authorities,
            exp
        };
        var payload = JwtTokenService.Base64UrlEncode(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payloadObject)));
        var signatureBytes = algorithm == "HS512"
            ? JwtTokenService.HmacSha512($"{header}.{payload}", secret)
            : JwtTokenService.HmacSha256($"{header}.{payload}", secret);
        var signature = JwtTokenService.Base64UrlEncode(signatureBytes);
        return $"{header}.{payload}.{signature}";
    }
}
