namespace EventZen.Ticketing.Api.Options;

public sealed class CorsOptions
{
    public string[] AllowedOrigins { get; set; } = ["http://localhost:5173"];
}
