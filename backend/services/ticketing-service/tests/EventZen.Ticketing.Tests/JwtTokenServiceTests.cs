using System.Text;
using System.Text.Json;
using EventZen.Ticketing.Api.Options;
using EventZen.Ticketing.Api.Security;
using Microsoft.Extensions.Options;
using Xunit;

namespace EventZen.Ticketing.Tests;

public sealed class JwtTokenServiceTests
{
    [Fact]
    public void ParseAccessToken_Reads_AuthServiceClaims()
    {
        var options = Options.Create(new JwtOptions
        {
            Secret = "change-me-change-me-change-me-change-me-1234567890",
            Issuer = "eventzen-auth-service"
        });

        var service = new JwtTokenService(options);
        var userId = Guid.NewGuid();
        var token = CreateToken(userId, "attendee@eventzen.local", options.Value.Secret, options.Value.Issuer, ["ROLE_ATTENDEE", "ROLE_ADMIN"], "HS512");

        var user = service.ParseAccessToken(token);

        Assert.Equal(userId, user.UserId);
        Assert.Equal("attendee@eventzen.local", user.Email);
        Assert.Contains("ATTENDEE", user.Roles);
        Assert.Contains("ADMIN", user.Roles);
    }

    private static string CreateToken(Guid userId, string email, string secret, string issuer, string[] authorities, string algorithm)
    {
        var header = JwtTokenService.Base64UrlEncode(Encoding.UTF8.GetBytes($$"""{"alg":"{{algorithm}}","typ":"JWT"}"""));
        var payloadObject = new
        {
            sub = email,
            iss = issuer,
            type = "access",
            uid = userId,
            authorities,
            exp = DateTimeOffset.UtcNow.AddMinutes(30).ToUnixTimeSeconds()
        };
        var payload = JwtTokenService.Base64UrlEncode(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payloadObject)));
        var signatureBytes = algorithm == "HS512"
            ? JwtTokenService.HmacSha512($"{header}.{payload}", secret)
            : JwtTokenService.HmacSha256($"{header}.{payload}", secret);
        var signature = JwtTokenService.Base64UrlEncode(signatureBytes);
        return $"{header}.{payload}.{signature}";
    }
}
