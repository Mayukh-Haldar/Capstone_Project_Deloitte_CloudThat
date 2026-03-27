using System.Net;
using System.Text;
using EventZen.Ticketing.Api.Common;
using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Domain;
using EventZen.Ticketing.Api.Infrastructure;
using EventZen.Ticketing.Api.Options;
using EventZen.Ticketing.Api.Security;
using EventZen.Ticketing.Api.Services;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Xunit;

namespace EventZen.Ticketing.Tests;

public sealed class TicketingServiceTests
{
    [Fact]
    public async Task RegisterAsync_CreatesRegistration_AndDecrementsInventory()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "VIP Pass",
            TierCode = "VIP",
            Price = 199,
            TotalQuantity = 5,
            AvailableQuantity = 5
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var user = new UserContext(Guid.NewGuid(), "person@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var response = await service.RegisterAsync(
            new RegisterAttendeeRequest(eventId, ticketType.Id, "Ava", "Patel", "person@eventzen.local", "9999999999"),
            user,
            "idem-1",
            CancellationToken.None);

        Assert.Equal("PENDING", response.Status);
        Assert.Equal("VIP Pass", response.TicketTypeName);
        var updatedType = await repository.GetTicketTypeAsync(ticketType.Id, CancellationToken.None);
        Assert.NotNull(updatedType);
        Assert.Equal(4, updatedType!.AvailableQuantity);
    }

    [Fact]
    public async Task RegisterAsync_RejectsDuplicateRegistration()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GENERAL",
            Price = 29,
            TotalQuantity = 2,
            AvailableQuantity = 2
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var user = new UserContext(Guid.NewGuid(), "repeat@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var request = new RegisterAttendeeRequest(eventId, ticketType.Id, "Mia", "Lee", "repeat@eventzen.local", null);

        await service.RegisterAsync(request, user, "idem-1", CancellationToken.None);

        var exception = await Assert.ThrowsAsync<EventZenException>(() => service.RegisterAsync(request, user, "idem-2", CancellationToken.None));
        Assert.Equal("TKT-3002", exception.Code);
        Assert.Equal(409, exception.StatusCode);
    }

    [Fact]
    public async Task CancelRegistration_PromotesWaitlistedAttendee()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GENERAL",
            Price = 29,
            TotalQuantity = 1,
            AvailableQuantity = 1
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var firstUser = new UserContext(Guid.NewGuid(), "first@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var secondUser = new UserContext(Guid.NewGuid(), "second@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var registration = await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "First", "User", "first@eventzen.local", null), firstUser, "r1", CancellationToken.None);
        await service.JoinWaitlistAsync(eventId, new JoinWaitlistRequest(ticketType.Id, "Second", "User", "second@eventzen.local", null), secondUser, CancellationToken.None);

        await service.CancelRegistrationAsync(registration.RegistrationId, firstUser, CancellationToken.None);

        var registrations = await repository.ListRegistrationsForUserAsync(secondUser.UserId, secondUser.Email, CancellationToken.None);
        Assert.Single(registrations);
        Assert.Equal("CONFIRMED", registrations[0].Status);
    }

    [Fact]
    public async Task CancelRegistration_SendsCancellationNotificationToAttendee()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GENERAL",
            Price = 29,
            TotalQuantity = 2,
            AvailableQuantity = 2
        }, CancellationToken.None);

        var notificationClient = new CaptureNotificationDispatchClient();
        var service = CreateService(repository, eventId, notificationClient);
        var user = new UserContext(Guid.NewGuid(), "cancel@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var registration = await service.RegisterAsync(
            new RegisterAttendeeRequest(eventId, ticketType.Id, "Cancel", "User", "cancel@eventzen.local", null),
            user,
            "cancel-1",
            CancellationToken.None);

        await service.CancelRegistrationAsync(registration.RegistrationId, user, CancellationToken.None);

        Assert.Equal(2, notificationClient.Events.Count);
        Assert.Equal("registration.pending_payment", notificationClient.Events[0]);
        Assert.Equal("registration.cancelled", notificationClient.Events[1]);
    }

    [Fact]
    public async Task ScanAsync_RejectsDuplicateCheckIn()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "VIP",
            TierCode = "VIP",
            Price = 99,
            TotalQuantity = 1,
            AvailableQuantity = 1
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var attendee = new UserContext(Guid.NewGuid(), "scan@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var staff = new UserContext(Guid.NewGuid(), "staff@eventzen.local", new HashSet<string>(["STAFF"], StringComparer.OrdinalIgnoreCase));
        var registration = await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "Scan", "User", "scan@eventzen.local", null), attendee, "scan-1", CancellationToken.None);

        await service.ScanAsync(new CheckInScanRequest(registration.Ticket.QrPayload, "MAIN"), staff, CancellationToken.None);
        var exception = await Assert.ThrowsAsync<EventZenException>(() => service.ScanAsync(new CheckInScanRequest(registration.Ticket.QrPayload, "MAIN"), staff, CancellationToken.None));

        Assert.Equal("TKT-3012", exception.Code);
    }

    private static TicketingService CreateService(
        InMemoryTicketingRepository repository,
        Guid eventId,
        INotificationDispatchClient? notificationDispatchClient = null)
    {
        var handler = new StubHttpMessageHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(
                $$"""
                {
                  "event": {
                    "id": "{{eventId}}",
                    "title": "Global Tech Summit",
                    "startTime": "2026-10-24T09:00:00Z",
                    "endTime": "2026-10-24T18:00:00Z",
                    "venueName": "Moscone Center",
                      "venueCity": "San Francisco",
                      "status": "REGISTRATION_OPEN"
                  }
                }
                """,
                Encoding.UTF8,
                "application/json")
        });
        var client = new EventCatalogClient(new HttpClient(handler), Options.Create(new EventServiceOptions { BaseUrl = "http://localhost:8082" }));
        return new TicketingService(
            repository,
            client,
            notificationDispatchClient ?? new NoOpNotificationDispatchClient(),
            new QrCodeService(),
            new TicketDeliveryAssetService(),
            new TicketPassStorageService(Options.Create(new StorageOptions { Enabled = false }), LoggerFactory.Create(_ => { }).CreateLogger<TicketPassStorageService>()),
            Options.Create(new JwtOptions { Secret = "change-me-change-me-change-me-change-me-1234567890", Issuer = "eventzen-auth-service" })
        );
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _factory;

        public StubHttpMessageHandler(Func<HttpRequestMessage, HttpResponseMessage> factory)
        {
            _factory = factory;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) =>
            Task.FromResult(_factory(request));
    }

    private sealed class NoOpNotificationDispatchClient : INotificationDispatchClient
    {
        public Task SendInAppNotificationAsync(
            string userId,
            string? email,
            string eventType,
            string title,
            string body,
            object? metadata,
            string? html,
            IReadOnlyList<NotificationEmailAttachment>? attachments,
            CancellationToken cancellationToken) =>
            Task.CompletedTask;
    }

    private sealed class CaptureNotificationDispatchClient : INotificationDispatchClient
    {
        public List<string> Events { get; } = [];

        public Task SendInAppNotificationAsync(
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
            Events.Add(eventType);
            return Task.CompletedTask;
        }
    }

    private sealed class InMemoryTicketingRepository : ITicketingRepository
    {
        private readonly Dictionary<Guid, AttendeeDocument> _attendees = [];
        private readonly Dictionary<Guid, TicketTypeDocument> _ticketTypes = [];
        private readonly Dictionary<Guid, RegistrationDocument> _registrations = [];
        private readonly Dictionary<Guid, TicketDocument> _tickets = [];
        private readonly Dictionary<Guid, CheckInLogDocument> _checkIns = [];
        private readonly Dictionary<Guid, WaitlistEntryDocument> _waitlist = [];
        private readonly Dictionary<Guid, SeatReservationDocument> _seatReservations = [];
        private readonly Dictionary<Guid, SeatBookingDocument> _seatBookings = [];

        public Task<AttendeeDocument?> FindAttendeeByUserIdAsync(Guid userId, CancellationToken cancellationToken) =>
            Task.FromResult(_attendees.Values.FirstOrDefault(item => item.UserId == userId));

        public Task<AttendeeDocument?> FindAttendeeByEmailAsync(string email, CancellationToken cancellationToken) =>
            Task.FromResult(_attendees.Values.FirstOrDefault(item => item.Email == email));

        public Task<AttendeeDocument> UpsertAttendeeAsync(AttendeeDocument attendee, CancellationToken cancellationToken)
        {
            _attendees[attendee.Id] = attendee;
            return Task.FromResult(attendee);
        }

        public Task<TicketTypeDocument> SaveTicketTypeAsync(TicketTypeDocument ticketType, CancellationToken cancellationToken)
        {
            _ticketTypes[ticketType.Id] = ticketType;
            return Task.FromResult(ticketType);
        }

        public Task<IReadOnlyList<TicketTypeDocument>> ListTicketTypesAsync(Guid eventId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<TicketTypeDocument>>(_ticketTypes.Values.Where(item => item.EventId == eventId).ToList());

        public Task<TicketTypeDocument?> GetTicketTypeAsync(Guid ticketTypeId, CancellationToken cancellationToken) =>
            Task.FromResult(_ticketTypes.GetValueOrDefault(ticketTypeId));

        public Task<RegistrationDocument?> FindRegistrationAsync(Guid eventId, Guid? attendeeUserId, string attendeeEmail, CancellationToken cancellationToken) =>
            Task.FromResult(_registrations.Values.FirstOrDefault(item => item.EventId == eventId && ((attendeeUserId.HasValue && item.AttendeeUserId == attendeeUserId) || item.AttendeeEmail == attendeeEmail)));

        public Task<RegistrationDocument?> FindRegistrationByIdAsync(Guid registrationId, CancellationToken cancellationToken) =>
            Task.FromResult(_registrations.GetValueOrDefault(registrationId));

        public Task<RegistrationDocument> SaveRegistrationAsync(RegistrationDocument registration, CancellationToken cancellationToken)
        {
            _registrations[registration.Id] = registration;
            return Task.FromResult(registration);
        }

        public Task<IReadOnlyList<RegistrationDocument>> ListRegistrationsForEventAsync(Guid eventId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<RegistrationDocument>>(_registrations.Values.Where(item => item.EventId == eventId).OrderByDescending(item => item.CreatedAt).ToList());

        public Task<IReadOnlyList<RegistrationDocument>> ListRegistrationsForUserAsync(Guid userId, string email, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<RegistrationDocument>>(_registrations.Values.Where(item => item.AttendeeUserId == userId || item.AttendeeEmail == email).OrderByDescending(item => item.CreatedAt).ToList());

        public Task<TicketDocument> SaveTicketAsync(TicketDocument ticket, CancellationToken cancellationToken)
        {
            _tickets[ticket.Id] = ticket;
            return Task.FromResult(ticket);
        }

        public Task<TicketDocument?> FindTicketByIdAsync(Guid ticketId, CancellationToken cancellationToken) =>
            Task.FromResult(_tickets.GetValueOrDefault(ticketId));

        public Task<TicketDocument?> FindTicketByPayloadAsync(string payload, CancellationToken cancellationToken) =>
            Task.FromResult(_tickets.Values.FirstOrDefault(item => item.QrPayload == payload));

        public Task<IReadOnlyList<TicketDocument>> ListTicketsForUserAsync(Guid userId, string email, CancellationToken cancellationToken)
        {
            var ticketIds = _registrations.Values.Where(item => item.AttendeeUserId == userId || item.AttendeeEmail == email).Select(item => item.TicketId).ToHashSet();
            return Task.FromResult<IReadOnlyList<TicketDocument>>(_tickets.Values.Where(item => ticketIds.Contains(item.Id)).OrderByDescending(item => item.CreatedAt).ToList());
        }

        public Task<CheckInLogDocument> SaveCheckInAsync(CheckInLogDocument checkIn, CancellationToken cancellationToken)
        {
            _checkIns[checkIn.Id] = checkIn;
            return Task.FromResult(checkIn);
        }

        public Task<bool> HasCheckInAsync(Guid registrationId, CancellationToken cancellationToken) =>
            Task.FromResult(_checkIns.Values.Any(item => item.RegistrationId == registrationId));

        public Task<IReadOnlyList<CheckInLogDocument>> ListCheckInsForEventAsync(Guid eventId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<CheckInLogDocument>>(_checkIns.Values.Where(item => item.EventId == eventId).OrderByDescending(item => item.CheckInTime).ToList());

        public Task<WaitlistEntryDocument> SaveWaitlistEntryAsync(WaitlistEntryDocument entry, CancellationToken cancellationToken)
        {
            _waitlist[entry.Id] = entry;
            return Task.FromResult(entry);
        }

        public Task<WaitlistEntryDocument?> FindActiveWaitlistEntryAsync(Guid eventId, Guid? attendeeUserId, string attendeeEmail, CancellationToken cancellationToken) =>
            Task.FromResult(_waitlist.Values.FirstOrDefault(item => item.EventId == eventId && item.Status == WaitlistStatus.Active &&
                                                                    ((attendeeUserId.HasValue && item.AttendeeUserId == attendeeUserId) || item.AttendeeEmail == attendeeEmail)));

        public Task<WaitlistEntryDocument?> GetNextWaitlistEntryAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken) =>
            Task.FromResult(_waitlist.Values.Where(item => item.EventId == eventId && item.TicketTypeId == ticketTypeId && item.Status == WaitlistStatus.Active)
                .OrderBy(item => item.CreatedAt)
                .FirstOrDefault());

        public Task<SeatReservationDocument?> FindActiveSeatReservationAsync(Guid eventId, Guid ticketTypeId, string seatRow, int seatColumn, CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow;
            return Task.FromResult(_seatReservations.Values.FirstOrDefault(r =>
                r.EventId == eventId && r.TicketTypeId == ticketTypeId &&
                r.SeatRow == seatRow && r.SeatColumn == seatColumn && r.ExpiresAt > now));
        }

        public Task<SeatReservationDocument?> FindActiveUserReservationAsync(Guid eventId, Guid ticketTypeId, Guid userId, CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow;
            return Task.FromResult(_seatReservations.Values.FirstOrDefault(r =>
                r.EventId == eventId && r.TicketTypeId == ticketTypeId &&
                r.UserId == userId && r.ExpiresAt > now));
        }

        public Task<SeatReservationDocument?> GetSeatReservationByIdAsync(Guid reservationId, CancellationToken cancellationToken) =>
            Task.FromResult(_seatReservations.GetValueOrDefault(reservationId));

        public Task<IReadOnlyList<SeatReservationDocument>> ListActiveSeatReservationsAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken)
        {
            var now = DateTimeOffset.UtcNow;
            return Task.FromResult<IReadOnlyList<SeatReservationDocument>>(
                _seatReservations.Values.Where(r => r.EventId == eventId && r.TicketTypeId == ticketTypeId && r.ExpiresAt > now).ToList());
        }

        public Task<SeatReservationDocument> SaveSeatReservationAsync(SeatReservationDocument reservation, CancellationToken cancellationToken)
        {
            _seatReservations[reservation.Id] = reservation;
            return Task.FromResult(reservation);
        }

        public Task DeleteSeatReservationAsync(Guid reservationId, CancellationToken cancellationToken)
        {
            _seatReservations.Remove(reservationId);
            return Task.CompletedTask;
        }

        public Task<SeatBookingDocument?> FindSeatBookingAsync(Guid eventId, Guid ticketTypeId, string seatRow, int seatColumn, CancellationToken cancellationToken) =>
            Task.FromResult(_seatBookings.Values.FirstOrDefault(b =>
                b.EventId == eventId && b.TicketTypeId == ticketTypeId &&
                b.SeatRow == seatRow && b.SeatColumn == seatColumn));

        public Task<SeatBookingDocument?> FindSeatBookingByRegistrationIdAsync(Guid registrationId, CancellationToken cancellationToken) =>
            Task.FromResult(_seatBookings.Values.FirstOrDefault(b => b.RegistrationId == registrationId));

        public Task<IReadOnlyList<SeatBookingDocument>> ListSeatBookingsAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken) =>
            Task.FromResult<IReadOnlyList<SeatBookingDocument>>(
                _seatBookings.Values.Where(b => b.EventId == eventId && b.TicketTypeId == ticketTypeId).ToList());

        public Task<SeatBookingDocument> SaveSeatBookingAsync(SeatBookingDocument booking, CancellationToken cancellationToken)
        {
            _seatBookings[booking.Id] = booking;
            return Task.FromResult(booking);
        }

        public Task DeleteSeatBookingAsync(Guid bookingId, CancellationToken cancellationToken)
        {
            _seatBookings.Remove(bookingId);
            return Task.CompletedTask;
        }
    }
}
