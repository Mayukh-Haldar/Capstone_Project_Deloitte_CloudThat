using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Options;
using EventZen.Ticketing.Api.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace EventZen.Ticketing.Api.Controllers;

[Route("api/v1")]
public sealed class RegistrationsController : ApiControllerBase
{
    private const string LegacyLocalInternalServiceKey = "eventzen-internal-key";

    private readonly TicketingService _ticketingService;
    private readonly NotificationServiceOptions _notificationServiceOptions;
    private readonly IWebHostEnvironment _environment;

    public RegistrationsController(
        TicketingService ticketingService,
        IOptions<NotificationServiceOptions> notificationServiceOptions,
        IWebHostEnvironment environment)
    {
        _ticketingService = ticketingService;
        _notificationServiceOptions = notificationServiceOptions.Value;
        _environment = environment;
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
        var isInternalCaller = IsValidInternalServiceKey(internalServiceKey);

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
        if (!IsValidInternalServiceKey(internalServiceKey))
        {
            throw new Common.EventZenException(403, "AUTHORIZATION_ERROR", "AUTH-1003", "Invalid internal service key");
        }

        return _ticketingService.ConfirmRegistrationPaymentAsync(registrationId, cancellationToken);
    }

    [HttpPost("events/{eventId:guid}/waitlist")]
    public Task<WaitlistResponse> JoinWaitlist(Guid eventId, [FromBody] JoinWaitlistRequest request, CancellationToken cancellationToken) =>
        _ticketingService.JoinWaitlistAsync(eventId, request, RequireUser(), cancellationToken);

    private bool IsValidInternalServiceKey(string internalServiceKey)
    {
        if (string.IsNullOrWhiteSpace(internalServiceKey))
        {
            return false;
        }

        if (string.Equals(internalServiceKey, _notificationServiceOptions.InternalServiceKey, StringComparison.Ordinal))
        {
            return true;
        }

        return CanUseLocalLegacyInternalServiceKey() &&
               string.Equals(internalServiceKey, LegacyLocalInternalServiceKey, StringComparison.Ordinal);
    }

    private bool CanUseLocalLegacyInternalServiceKey()
    {
        if (_environment.IsDevelopment())
        {
            return true;
        }

        var host = Request.Host.Host;
        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(host, "127.0.0.1", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(host, "::1", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        var remoteIp = HttpContext.Connection.RemoteIpAddress;
        return remoteIp is not null && System.Net.IPAddress.IsLoopback(remoteIp);
    }
}
