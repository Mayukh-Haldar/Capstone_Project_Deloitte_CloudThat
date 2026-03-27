namespace EventZen.Ticketing.Api.Options;

public sealed class StorageOptions
{
    public bool Enabled { get; set; }
    public string Endpoint { get; set; } = string.Empty;
    public string AccessKey { get; set; } = string.Empty;
    public string SecretKey { get; set; } = string.Empty;
    public string Bucket { get; set; } = "eventzen-media";
    public string PublicBaseUrl { get; set; } = string.Empty;
    public string TicketPassesPrefix { get; set; } = "ticket-passes";
}
