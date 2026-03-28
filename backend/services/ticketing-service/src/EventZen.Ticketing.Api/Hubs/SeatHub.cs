using Microsoft.AspNetCore.SignalR;

namespace EventZen.Ticketing.Api.Hubs;

/// <summary>
/// SignalR hub that streams real-time seat-status changes to connected clients.
/// Clients call <see cref="JoinSeatRoom"/> once they open the seat-map page so
/// that subsequent <c>SeatUpdate</c> messages are scoped to the right event /
/// ticket-type grid.
/// </summary>
public sealed class SeatHub : Hub
{
    /// <summary>
    /// Adds the caller to the group for the given event + ticket-type pair.
    /// This must be invoked by the client as soon as the connection is established.
    /// </summary>
    public Task JoinSeatRoom(string eventId, string ticketTypeId) =>
        Groups.AddToGroupAsync(Context.ConnectionId, GroupName(eventId, ticketTypeId));

    /// <summary>
    /// Removes the caller from the group (called on unmount / tab close).
    /// </summary>
    public Task LeaveSeatRoom(string eventId, string ticketTypeId) =>
        Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(eventId, ticketTypeId));

    /// <summary>Returns the consistent group name used for broadcasting.</summary>
    public static string GroupName(string eventId, string ticketTypeId) =>
        $"seat:{eventId}:{ticketTypeId}";
}
