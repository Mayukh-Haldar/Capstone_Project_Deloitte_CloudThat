using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Options;
using EventZen.Ticketing.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace EventZen.Ticketing.Api.Controllers;

[Route("api/v1")]
public sealed class RegistrationsController : ApiControllerBase
{
    private readonly TicketingService _ticketingService;
    private readonly NotificationServiceOptions _notificationServiceOptions;

    public RegistrationsController(TicketingService ticketingService, IOptions<NotificationServiceOptions> notificationServiceOptions)
    {
        _ticketingService = ticketingService;
        _notificationServiceOptions = notificationServiceOptions.Value;
    }

    [HttpPost("registrations")]
    public Task<RegistrationResponse> Register([FromBody] RegisterAttendeeRequest request, CancellationToken cancellationToken)
    {
        var user = RequireUser();
        var idempotencyKey = Request.Headers["Idempotency-Key"].ToString();
        return _ticketingService.RegisterAsync(request, user, idempotencyKey, cancellationToken);
    }

    [HttpGet("registrations/me")]
    public Task<IReadOnlyList<RegistrationResponse>> MyRegistrations(CancellationToken cancellationToken) =>
        _ticketingService.ListMyRegistrationsAsync(RequireUser(), cancellationToken);

    [HttpGet("registrations/{registrationId:guid}/ticket-pass")]
    public async Task<IActionResult> DownloadTicketPass(Guid registrationId, CancellationToken cancellationToken)
    {
        var (content, fileName) = await _ticketingService.GenerateTicketPassPdfAsync(registrationId, RequireUser(), cancellationToken);
        return File(content, "application/pdf", fileName);
    }

    [HttpGet("events/{eventId:guid}/registrations")]
    public Task<IReadOnlyList<RegistrationResponse>> EventRegistrations(Guid eventId, CancellationToken cancellationToken)
    {
        var internalServiceKey = Request.Headers["x-internal-service-key"].ToString();
        var isInternalCaller =
            !string.IsNullOrWhiteSpace(internalServiceKey) &&
            string.Equals(internalServiceKey, _notificationServiceOptions.InternalServiceKey, StringComparison.Ordinal);

        if (!isInternalCaller)
        {
            RequireRoles("ADMIN", "ORGANIZER");
        }

        return _ticketingService.ListRegistrationsForEventAsync(eventId, cancellationToken);
    }

    [HttpDelete("registrations/{registrationId:guid}")]
    public async Task<IActionResult> Cancel(Guid registrationId, CancellationToken cancellationToken)
    {
        await _ticketingService.CancelRegistrationAsync(registrationId, RequireUser(), cancellationToken);
        return NoContent();
    }

    [HttpPost("internal/registrations/{registrationId:guid}/confirm-payment")]
    public Task<RegistrationResponse> ConfirmPayment(Guid registrationId, CancellationToken cancellationToken)
    {
        var internalServiceKey = Request.Headers["x-internal-service-key"].ToString();
        if (string.IsNullOrWhiteSpace(internalServiceKey) ||
            !string.Equals(internalServiceKey, _notificationServiceOptions.InternalServiceKey, StringComparison.Ordinal))
        {
            throw new Common.EventZenException(403, "AUTHORIZATION_ERROR", "AUTH-1003", "Invalid internal service key");
        }

        return _ticketingService.ConfirmRegistrationPaymentAsync(registrationId, cancellationToken);
    }

    [HttpPost("events/{eventId:guid}/waitlist")]
    public Task<WaitlistResponse> JoinWaitlist(Guid eventId, [FromBody] JoinWaitlistRequest request, CancellationToken cancellationToken) =>
        _ticketingService.JoinWaitlistAsync(eventId, request, RequireUser(), cancellationToken);
}
