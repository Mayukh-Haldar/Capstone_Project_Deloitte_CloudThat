using System.Net.Http.Json;
using EventZen.Ticketing.Api.Options;
using Microsoft.Extensions.Options;

namespace EventZen.Ticketing.Api.Services;

public sealed class NotificationDispatchClient : INotificationDispatchClient
{
    private readonly HttpClient _httpClient;
    private readonly NotificationServiceOptions _options;
    private readonly ILogger<NotificationDispatchClient> _logger;

    public NotificationDispatchClient(
        HttpClient httpClient,
        IOptions<NotificationServiceOptions> options,
        ILogger<NotificationDispatchClient> logger)
    {
        _httpClient = httpClient;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendInAppNotificationAsync(
        string userId,
        string? email,
        string eventType,
        string title,
        string body,
        object? metadata,
        string? html,
        IReadOnlyList<NotificationEmailAttachment>? attachments,
        CancellationToken cancellationToken)
    {
        try
        {
            var payload = new
            {
                eventType,
                recipients = new[]
                {
                    new
                    {
                        userId,
                        email
                    }
                },
                title,
                body,
                html,
                attachments,
                metadata
            };

            using var request = new HttpRequestMessage(
                HttpMethod.Post,
                $"{_options.BaseUrl.TrimEnd('/')}/api/v1/notifications/send");
            request.Content = JsonContent.Create(payload);
            request.Headers.Add("x-internal-service-key", _options.InternalServiceKey);

            using var response = await _httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Notification dispatch failed with status code {StatusCode}", response.StatusCode);
            }
        }
        catch (Exception exception)
        {
            _logger.LogWarning(exception, "Notification dispatch failed");
        }
    }
}
