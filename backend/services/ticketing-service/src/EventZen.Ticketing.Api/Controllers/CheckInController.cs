using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace EventZen.Ticketing.Api.Controllers;

[Route("api/v1")]
public sealed class CheckInController : ApiControllerBase
{
    private readonly TicketingService _ticketingService;

    public CheckInController(TicketingService ticketingService)
    {
        _ticketingService = ticketingService;
    }

    [HttpPost("checkin/scan")]
    public Task<RegistrationResponse> Scan([FromBody] CheckInScanRequest request, CancellationToken cancellationToken)
    {
        var user = RequireRoles("ADMIN", "ORGANIZER", "STAFF");
        return _ticketingService.ScanAsync(request, user, cancellationToken);
    }

    [HttpGet("events/{eventId:guid}/checkin/stats")]
    public Task<CheckInStatsResponse> Stats(Guid eventId, CancellationToken cancellationToken)
    {
        RequireRoles("ADMIN", "ORGANIZER");
        return _ticketingService.GetCheckInStatsAsync(eventId, cancellationToken);
    }
}
