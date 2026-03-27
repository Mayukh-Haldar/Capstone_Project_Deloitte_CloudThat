using System.Text.Json;
using EventZen.Ticketing.Api.Common;
using EventZen.Ticketing.Api.Options;
using Microsoft.Extensions.Options;

namespace EventZen.Ticketing.Api.Services;

public sealed class EventCatalogClient
{
    private readonly HttpClient _httpClient;
    private readonly EventServiceOptions _options;
    private static readonly JsonSerializerOptions JsonOptions = new() { PropertyNameCaseInsensitive = true };

    public EventCatalogClient(HttpClient httpClient, IOptions<EventServiceOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task<EventSnapshot> GetEventAsync(Guid eventId, CancellationToken cancellationToken)
    {
        var response = await _httpClient.GetAsync($"{_options.BaseUrl.TrimEnd('/')}/api/v1/events/{eventId}", cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            throw new EventZenException(404, "NOT_FOUND", "TKT-3005", "Event not found in event-service");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        var payload = await JsonSerializer.DeserializeAsync<EventDetailEnvelope>(stream, JsonOptions, cancellationToken);
        if (payload?.Event is null)
        {
            throw new EventZenException(404, "NOT_FOUND", "TKT-3005", "Event payload was empty");
        }

        return new EventSnapshot(
            payload.Event.Id,
            payload.Event.Title,
            payload.Event.StartTime,
            payload.Event.EndTime,
            payload.Event.Status,
            payload.Event.VenueName,
            payload.Event.VenueCity
        );
    }

    private sealed record EventDetailEnvelope(EventPayload Event);
    private sealed record EventPayload(Guid Id, string Title, DateTimeOffset StartTime, DateTimeOffset EndTime, string Status, string? VenueName, string? VenueCity);
}

public sealed record EventSnapshot(
    Guid Id,
    string Title,
    DateTimeOffset StartTime,
    DateTimeOffset EndTime,
    string Status,
    string? VenueName,
    string? VenueCity
);
