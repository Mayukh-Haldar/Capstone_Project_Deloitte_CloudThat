namespace EventZen.Ticketing.Api.Options;

public sealed class MongoOptions
{
    public string ConnectionString { get; set; } = "mongodb://localhost:27017";
    public string DatabaseName { get; set; } = "eventzen_ticketing";
}
