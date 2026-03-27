namespace EventZen.Ticketing.Api.Services;

public sealed record NotificationEmailAttachment(
    string Filename,
    string ContentBase64,
    string ContentType = "application/octet-stream",
    string Disposition = "attachment");

public interface INotificationDispatchClient
{
    Task SendInAppNotificationAsync(
        string userId,
        string? email,
        string eventType,
        string title,
        string body,
        object? metadata,
        string? html,
        IReadOnlyList<NotificationEmailAttachment>? attachments,
        CancellationToken cancellationToken);
}
