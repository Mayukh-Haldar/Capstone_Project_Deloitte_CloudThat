namespace EventZen.Ticketing.Api.Options;

public sealed class JwtOptions
{
    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "eventzen-auth-service";
}
