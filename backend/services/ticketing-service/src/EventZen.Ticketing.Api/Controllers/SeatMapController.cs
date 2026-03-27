using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EventZen.Ticketing.Api.Controllers;

[Route("api/v1")]
public sealed class SeatMapController : ApiControllerBase
{
    private readonly TicketingService _ticketingService;

    public SeatMapController(TicketingService ticketingService)
    {
        _ticketingService = ticketingService;
    }

    /// <summary>
    /// Returns the hall seat map for a given ticket type.
    /// Pass eventId as a query parameter.
    /// The layout is generated from the ticket type's total capacity.
    /// Each seat shows its status: AVAILABLE, RESERVED (with expiry), or BOOKED.
    /// </summary>
    [HttpGet("ticket-types/{ticketTypeId:guid}/seat-map")]
    public Task<SeatMapResponse> GetSeatMap(
        Guid ticketTypeId,
        [FromQuery] Guid eventId,
        CancellationToken cancellationToken) =>
        _ticketingService.GetSeatMapAsync(eventId, ticketTypeId, cancellationToken);

    /// <summary>
    /// Reserves a specific seat for the authenticated user for 10 minutes.
    /// If the user already holds a reservation for a different seat in this ticket type,
    /// that old reservation is automatically released before the new one is created.
    /// </summary>
    [HttpPost("ticket-types/{ticketTypeId:guid}/seats/reserve")]
    public Task<SeatReservationResponse> ReserveSeat(
        Guid ticketTypeId,
        [FromQuery] Guid eventId,
        [FromBody] ReserveSeatRequest request,
        CancellationToken cancellationToken)
    {
        var user = RequireUser();
        return _ticketingService.ReserveSeatAsync(eventId, ticketTypeId, request, user, cancellationToken);
    }

    /// <summary>
    /// Cancels an active seat reservation owned by the authenticated user.
    /// The seat immediately becomes available for others to reserve.
    /// </summary>
    [HttpDelete("ticket-types/{ticketTypeId:guid}/seats/reserve/{reservationId:guid}")]
    public async Task<IActionResult> CancelReservation(
        Guid ticketTypeId,
        Guid reservationId,
        CancellationToken cancellationToken)
    {
        var user = RequireUser();
        await _ticketingService.CancelReservationAsync(ticketTypeId, reservationId, user, cancellationToken);
        return NoContent();
    }
}
