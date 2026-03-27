using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EventZen.Ticketing.Api.Controllers;

[Route("api/v1")]
public sealed class TicketsController : ApiControllerBase
{
    private readonly TicketingService _ticketingService;

    public TicketsController(TicketingService ticketingService)
    {
        _ticketingService = ticketingService;
    }

    [HttpGet("tickets/{ticketId:guid}")]
    public Task<TicketResponse> Get(Guid ticketId, CancellationToken cancellationToken) =>
        _ticketingService.GetTicketAsync(ticketId, RequireUser(), cancellationToken);

    [HttpGet("tickets/me")]
    public Task<IReadOnlyList<TicketResponse>> MyTickets(CancellationToken cancellationToken) =>
        _ticketingService.ListMyTicketsAsync(RequireUser(), cancellationToken);
}
