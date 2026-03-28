using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EventZen.Ticketing.Api.Controllers;

[Route("api/v1")]
public sealed class TicketTypesController : ApiControllerBase
{
    private readonly TicketingService _ticketingService;

    public TicketTypesController(TicketingService ticketingService)
    {
        _ticketingService = ticketingService;
    }

    [HttpGet("ticket-types")]
    public Task<IReadOnlyList<TicketTypeResponse>> List([FromQuery] Guid eventId, CancellationToken cancellationToken) =>
        _ticketingService.ListTicketTypesAsync(eventId, cancellationToken);

    [HttpPost("events/{eventId:guid}/ticket-types")]
    public Task<TicketTypeResponse> Create(Guid eventId, [FromBody] CreateTicketTypeRequest request, CancellationToken cancellationToken)
    {
        RequireRoles("ADMIN", "ORGANIZER");
        return _ticketingService.CreateTicketTypeAsync(eventId, request, cancellationToken);
    }

    [HttpPut("events/{eventId:guid}/ticket-types/{ticketTypeId:guid}")]
    public Task<TicketTypeResponse> Update(Guid eventId, Guid ticketTypeId, [FromBody] UpdateTicketTypeRequest request, CancellationToken cancellationToken)
    {
        RequireRoles("ADMIN", "ORGANIZER");
        return _ticketingService.UpdateTicketTypeAsync(eventId, ticketTypeId, request, cancellationToken);
    }

    [HttpDelete("events/{eventId:guid}/ticket-types/{ticketTypeId:guid}")]
    public async Task<IActionResult> Delete(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken)
    {
        RequireRoles("ADMIN", "ORGANIZER");
        await _ticketingService.DeleteTicketTypeAsync(eventId, ticketTypeId, cancellationToken);
        return NoContent();
    }
}
