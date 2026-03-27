namespace EventZen.Ticketing.Api.Options;

public sealed class NotificationServiceOptions
{
    public string BaseUrl { get; set; } = "http://localhost:8086";
    public string InternalServiceKey { get; set; } = "eventzen-internal-key";
}
