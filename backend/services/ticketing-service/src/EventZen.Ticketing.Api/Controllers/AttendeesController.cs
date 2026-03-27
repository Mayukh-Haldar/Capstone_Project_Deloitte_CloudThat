using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EventZen.Ticketing.Api.Controllers;

[Route("api/v1")]
public sealed class AttendeesController : ApiControllerBase
{
    private readonly TicketingService _ticketingService;

    public AttendeesController(TicketingService ticketingService)
    {
        _ticketingService = ticketingService;
    }

    [HttpPost("attendees/import")]
    [RequestSizeLimit(10_000_000)]
    public Task<CsvImportResponse> Import([FromForm] IFormFile file, CancellationToken cancellationToken)
    {
        RequireRoles("ADMIN");
        return _ticketingService.ImportAttendeesAsync(file, cancellationToken);
    }

    [HttpGet("health")]
    public object Health() => new { status = "UP", service = "ticketing-service" };
}
