using System.Net;
using System.Text;
using EventZen.Ticketing.Api.Common;
using EventZen.Ticketing.Api.Contracts;
using EventZen.Ticketing.Api.Domain;
using EventZen.Ticketing.Api.Hubs;
using EventZen.Ticketing.Api.Infrastructure;
using EventZen.Ticketing.Api.Options;
using EventZen.Ticketing.Api.Security;
using EventZen.Ticketing.Api.Services;
using Microsoft.AspNetCore.SignalR;
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

    [Fact]
    public async Task UpdateTicketTypeAsync_RecalculatesAvailableInventory()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "VIP Pass",
            TierCode = "VIP",
            Price = 199,
            TotalQuantity = 10,
            AvailableQuantity = 6
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);

        var updated = await service.UpdateTicketTypeAsync(
            eventId,
            ticketType.Id,
            new UpdateTicketTypeRequest("VIP Plus", "vip", 249, 12, 2, "Updated tier", null, null),
            CancellationToken.None);

        Assert.Equal("VIP Plus", updated.TicketName);
        Assert.Equal(12, updated.TotalQuantity);
        Assert.Equal(8, updated.AvailableQuantity);
    }

    [Fact]
    public async Task UpdateTicketTypeAsync_RejectsReducingBelowBookedCount()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GENERAL",
            Price = 29,
            TotalQuantity = 10,
            AvailableQuantity = 6
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);

        var exception = await Assert.ThrowsAsync<EventZenException>(() => service.UpdateTicketTypeAsync(
            eventId,
            ticketType.Id,
            new UpdateTicketTypeRequest("General", "GENERAL", 29, 3, 1, null, null, null),
            CancellationToken.None));

        Assert.Equal("TKT-3024", exception.Code);
    }

    [Fact]
    public async Task DeleteTicketTypeAsync_SoftDeletesUnusedTier()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GENERAL",
            Price = 29,
            TotalQuantity = 10,
            AvailableQuantity = 10,
            IsActive = true
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        await service.DeleteTicketTypeAsync(eventId, ticketType.Id, CancellationToken.None);

        var deleted = await repository.GetTicketTypeAsync(ticketType.Id, CancellationToken.None);
        Assert.NotNull(deleted);
        Assert.False(deleted!.IsActive);
    }

    [Fact]
    public async Task DeleteTicketTypeAsync_RejectsBookedTier()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GENERAL",
            Price = 29,
            TotalQuantity = 10,
            AvailableQuantity = 9,
            IsActive = true
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);

        var exception = await Assert.ThrowsAsync<EventZenException>(() => service.DeleteTicketTypeAsync(eventId, ticketType.Id, CancellationToken.None));
        Assert.Equal("TKT-3025", exception.Code);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-010: Register – sold-out ticket type
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task RegisterAsync_SoldOut_ThrowsTkt3001()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "Sold Out Tier",
            TierCode = "SO",
            Price = 50,
            TotalQuantity = 1,
            AvailableQuantity = 0
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var user = new UserContext(Guid.NewGuid(), "user@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var ex = await Assert.ThrowsAsync<EventZenException>(() =>
            service.RegisterAsync(
                new RegisterAttendeeRequest(eventId, ticketType.Id, "Raj", "Kumar", "user@eventzen.local", null),
                user, "idem-sold-out", CancellationToken.None));

        Assert.Equal("TKT-3001", ex.Code);
        Assert.Equal(409, ex.StatusCode);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-011: Register – free tier auto-confirms
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task RegisterAsync_FreeTier_CreatesConfirmedRegistration()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "Free Pass",
            TierCode = "FREE",
            Price = 0,
            TotalQuantity = 100,
            AvailableQuantity = 100
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var user = new UserContext(Guid.NewGuid(), "freeuser@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var response = await service.RegisterAsync(
            new RegisterAttendeeRequest(eventId, ticketType.Id, "Priya", "Sharma", "freeuser@eventzen.local", null),
            user, "idem-free", CancellationToken.None);

        Assert.Equal("CONFIRMED", response.Status);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-012: Register – idempotency key deduplicates identical calls
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task RegisterAsync_IdempotentKey_ReturnsSameRegistration()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GEN",
            Price = 10,
            TotalQuantity = 5,
            AvailableQuantity = 5
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var user = new UserContext(Guid.NewGuid(), "idem@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var request = new RegisterAttendeeRequest(eventId, ticketType.Id, "Idem", "User", "idem@eventzen.local", null);

        var first = await service.RegisterAsync(request, user, "same-key", CancellationToken.None);

        // A second call with the SAME idempotency key is idempotent – returns the existing registration
        var second = await service.RegisterAsync(request, user, "same-key", CancellationToken.None);

        Assert.Equal(first.RegistrationId, second.RegistrationId);
        Assert.NotEqual(Guid.Empty, first.RegistrationId);

        // Inventory should only have been decremented once
        var updatedType = await repository.GetTicketTypeAsync(ticketType.Id, CancellationToken.None);
        Assert.Equal(4, updatedType!.AvailableQuantity);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-013: Confirm payment transitions Pending → Confirmed
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task ConfirmRegistrationPaymentAsync_TransitionsPendingToConfirmed()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "VIP",
            TierCode = "VIP",
            Price = 199,
            TotalQuantity = 10,
            AvailableQuantity = 10
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var user = new UserContext(Guid.NewGuid(), "vip@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var pending = await service.RegisterAsync(
            new RegisterAttendeeRequest(eventId, ticketType.Id, "VIP", "Attendee", "vip@eventzen.local", null),
            user, "idem-vip", CancellationToken.None);

        Assert.Equal("PENDING", pending.Status);

        var confirmed = await service.ConfirmRegistrationPaymentAsync(pending.RegistrationId, CancellationToken.None);

        Assert.Equal("CONFIRMED", confirmed.Status);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-014: Confirm payment is idempotent for already-confirmed
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task ConfirmRegistrationPaymentAsync_IsIdempotentForAlreadyConfirmed()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "Standard",
            TierCode = "STD",
            Price = 0,
            TotalQuantity = 5,
            AvailableQuantity = 5
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var user = new UserContext(Guid.NewGuid(), "std@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var reg = await service.RegisterAsync(
            new RegisterAttendeeRequest(eventId, ticketType.Id, "Std", "User", "std@eventzen.local", null),
            user, "idem-std", CancellationToken.None);

        Assert.Equal("CONFIRMED", reg.Status);

        // Confirming an already-confirmed registration returns it unchanged
        var again = await service.ConfirmRegistrationPaymentAsync(reg.RegistrationId, CancellationToken.None);
        Assert.Equal("CONFIRMED", again.Status);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-015: Join waitlist creates an active entry
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task JoinWaitlistAsync_CreatesWaitlistEntry()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GEN",
            Price = 29,
            TotalQuantity = 1,
            AvailableQuantity = 0
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var user = new UserContext(Guid.NewGuid(), "wait@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var response = await service.JoinWaitlistAsync(
            eventId,
            new JoinWaitlistRequest(ticketType.Id, "Wait", "User", "wait@eventzen.local", null),
            user, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, response.WaitlistEntryId);
        Assert.Equal("ACTIVE", response.Status);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-016: Joining waitlist twice for the same event is idempotent
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task JoinWaitlistAsync_IsIdempotentForSameUser()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GEN",
            Price = 29,
            TotalQuantity = 1,
            AvailableQuantity = 0
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var user = new UserContext(Guid.NewGuid(), "wait2@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var waitlistReq = new JoinWaitlistRequest(ticketType.Id, "Wait", "Again", "wait2@eventzen.local", null);

        var first = await service.JoinWaitlistAsync(eventId, waitlistReq, user, CancellationToken.None);
        var second = await service.JoinWaitlistAsync(eventId, waitlistReq, user, CancellationToken.None);

        // Same waitlist entry id should be returned on the second call
        Assert.Equal(first.WaitlistEntryId, second.WaitlistEntryId);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-017: List my registrations returns only caller's entries
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task ListMyRegistrationsAsync_ReturnsOnlyCallerRegistrations()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GEN",
            Price = 10,
            TotalQuantity = 10,
            AvailableQuantity = 10
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var alice = new UserContext(Guid.NewGuid(), "alice@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var bob = new UserContext(Guid.NewGuid(), "bob@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "Alice", "A", "alice@eventzen.local", null), alice, "idem-alice", CancellationToken.None);
        await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "Bob", "B", "bob@eventzen.local", null), bob, "idem-bob", CancellationToken.None);

        var aliceList = await service.ListMyRegistrationsAsync(alice, CancellationToken.None);
        var bobList = await service.ListMyRegistrationsAsync(bob, CancellationToken.None);

        Assert.Single(aliceList);
        Assert.Single(bobList);
        Assert.Equal("alice@eventzen.local", aliceList[0].AttendeeEmail);
        Assert.Equal("bob@eventzen.local", bobList[0].AttendeeEmail);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-018: List ticket types returns only active types for event
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task ListTicketTypesAsync_ReturnsActiveTypes()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();

        await repository.SaveTicketTypeAsync(new TicketTypeDocument { EventId = eventId, TicketName = "VIP", TierCode = "VIP", Price = 200, TotalQuantity = 5, AvailableQuantity = 5, IsActive = true }, CancellationToken.None);
        await repository.SaveTicketTypeAsync(new TicketTypeDocument { EventId = eventId, TicketName = "General", TierCode = "GEN", Price = 50, TotalQuantity = 50, AvailableQuantity = 50, IsActive = true }, CancellationToken.None);
        await repository.SaveTicketTypeAsync(new TicketTypeDocument { EventId = eventId, TicketName = "Deleted", TierCode = "DEL", Price = 10, TotalQuantity = 10, AvailableQuantity = 10, IsActive = false }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var list = await service.ListTicketTypesAsync(eventId, CancellationToken.None);

        Assert.Equal(2, list.Count);
        Assert.All(list, t => Assert.True(t.IsActive));
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-019: Create ticket type – rejects zero quantity
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task CreateTicketTypeAsync_RejectsZeroQuantity_ThrowsTkt3006()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var service = CreateService(repository, eventId);

        var ex = await Assert.ThrowsAsync<EventZenException>(() =>
            service.CreateTicketTypeAsync(
                eventId,
                new CreateTicketTypeRequest("General", "GEN", 29, 0, 1, null, null, null),
                CancellationToken.None));

        Assert.Equal("TKT-3006", ex.Code);
        Assert.Equal(400, ex.StatusCode);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-020: GetCheckInStats returns accurate checked-in count
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task GetCheckInStatsAsync_ReturnsCorrectCounts()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "VIP",
            TierCode = "VIP",
            Price = 99,
            TotalQuantity = 5,
            AvailableQuantity = 5
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var staffUser = new UserContext(Guid.NewGuid(), "staff@eventzen.local", new HashSet<string>(["STAFF"], StringComparer.OrdinalIgnoreCase));

        // Register two attendees and check in one
        var u1 = new UserContext(Guid.NewGuid(), "u1@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var u2 = new UserContext(Guid.NewGuid(), "u2@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var reg1 = await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "U", "One", "u1@eventzen.local", null), u1, "s1", CancellationToken.None);
        await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "U", "Two", "u2@eventzen.local", null), u2, "s2", CancellationToken.None);

        await service.ScanAsync(new CheckInScanRequest(reg1.Ticket.QrPayload, "GATE-A"), staffUser, CancellationToken.None);

        var stats = await service.GetCheckInStatsAsync(eventId, CancellationToken.None);

        Assert.Equal(1, stats.CheckedInCount);
        Assert.Equal(2, stats.TotalRegistrations);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-021: Scan check-in updates registration status to CHECKED_IN
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task ScanAsync_ChecksInAttendee_StatusBecomesCheckedIn()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GEN",
            Price = 0,
            TotalQuantity = 5,
            AvailableQuantity = 5
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var attendee = new UserContext(Guid.NewGuid(), "attend@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var staff = new UserContext(Guid.NewGuid(), "staff2@eventzen.local", new HashSet<string>(["STAFF"], StringComparer.OrdinalIgnoreCase));

        var reg = await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "A", "Ttend", "attend@eventzen.local", null), attendee, "scan-ci", CancellationToken.None);
        var result = await service.ScanAsync(new CheckInScanRequest(reg.Ticket.QrPayload, "MAIN-GATE"), staff, CancellationToken.None);

        Assert.Equal("CHECKED_IN", result.Status);
        Assert.NotNull(result.CheckedInAt);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-022: CancelRegistration – inventory restored on cancellation
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task CancelRegistrationAsync_RestoresInventory()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GEN",
            Price = 30,
            TotalQuantity = 3,
            AvailableQuantity = 3
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var user = new UserContext(Guid.NewGuid(), "restore@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var reg = await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "R", "User", "restore@eventzen.local", null), user, "idem-restore", CancellationToken.None);

        var afterRegister = await repository.GetTicketTypeAsync(ticketType.Id, CancellationToken.None);
        Assert.Equal(2, afterRegister!.AvailableQuantity);

        await service.CancelRegistrationAsync(reg.RegistrationId, user, CancellationToken.None);

        var afterCancel = await repository.GetTicketTypeAsync(ticketType.Id, CancellationToken.None);
        Assert.Equal(3, afterCancel!.AvailableQuantity);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-023: ListRegistrationsForEventAsync returns all event registrations
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task ListRegistrationsForEventAsync_ReturnsAllEventRegistrations()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GEN",
            Price = 0,
            TotalQuantity = 10,
            AvailableQuantity = 10
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var u1 = new UserContext(Guid.NewGuid(), "ev1@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var u2 = new UserContext(Guid.NewGuid(), "ev2@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var u3 = new UserContext(Guid.NewGuid(), "ev3@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "E", "One", "ev1@eventzen.local", null), u1, "e1", CancellationToken.None);
        await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "E", "Two", "ev2@eventzen.local", null), u2, "e2", CancellationToken.None);
        await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "E", "Three", "ev3@eventzen.local", null), u3, "e3", CancellationToken.None);

        var list = await service.ListRegistrationsForEventAsync(eventId, CancellationToken.None);

        Assert.Equal(3, list.Count);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-024: Cancel registration – wrong owner is rejected (AUTH-1003)
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task CancelRegistrationAsync_WrongOwner_ThrowsAuth1003()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "General",
            TierCode = "GEN",
            Price = 10,
            TotalQuantity = 5,
            AvailableQuantity = 5
        }, CancellationToken.None);

        var service = CreateService(repository, eventId);
        var owner = new UserContext(Guid.NewGuid(), "owner@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));
        var imposter = new UserContext(Guid.NewGuid(), "imposter@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        var reg = await service.RegisterAsync(new RegisterAttendeeRequest(eventId, ticketType.Id, "O", "Wner", "owner@eventzen.local", null), owner, "idem-own", CancellationToken.None);

        var ex = await Assert.ThrowsAsync<EventZenException>(() =>
            service.CancelRegistrationAsync(reg.RegistrationId, imposter, CancellationToken.None));

        Assert.Equal("AUTH-1003", ex.Code);
        Assert.Equal(403, ex.StatusCode);
    }

    // ──────────────────────────────────────────────────────────────────────
    // TKT-US-025: Notification fires "registration.confirmed" after free booking
    // ──────────────────────────────────────────────────────────────────────
    [Fact]
    public async Task RegisterAsync_FreeTier_FiresConfirmedNotification()
    {
        var repository = new InMemoryTicketingRepository();
        var eventId = Guid.NewGuid();
        var ticketType = await repository.SaveTicketTypeAsync(new TicketTypeDocument
        {
            EventId = eventId,
            TicketName = "Free Entry",
            TierCode = "FREE",
            Price = 0,
            TotalQuantity = 50,
            AvailableQuantity = 50
        }, CancellationToken.None);

        var notificationClient = new CaptureNotificationDispatchClient();
        var service = CreateService(repository, eventId, notificationClient);
        var user = new UserContext(Guid.NewGuid(), "notify@eventzen.local", new HashSet<string>(["ATTENDEE"], StringComparer.OrdinalIgnoreCase));

        await service.RegisterAsync(
            new RegisterAttendeeRequest(eventId, ticketType.Id, "Notify", "Me", "notify@eventzen.local", null),
            user, "idem-notify-free", CancellationToken.None);

        Assert.Contains("registration.confirmed", notificationClient.Events);
        Assert.DoesNotContain("registration.pending_payment", notificationClient.Events);
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
            Options.Create(new JwtOptions { Secret = "change-me-change-me-change-me-change-me-1234567890", Issuer = "eventzen-auth-service" }),
            new NoOpSeatHubContext()
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

    private sealed class NoOpSeatHubContext : IHubContext<SeatHub>
    {
        public IHubClients Clients { get; } = new NoOpHubClients();

        public IGroupManager Groups { get; } = new NoOpGroupManager();
    }

    private sealed class NoOpHubClients : IHubClients
    {
        private static readonly IClientProxy Proxy = new NoOpClientProxy();

        public IClientProxy All => Proxy;

        public IClientProxy AllExcept(IReadOnlyList<string> excludedConnectionIds) => Proxy;

        public IClientProxy Client(string connectionId) => Proxy;

        public IClientProxy Clients(IReadOnlyList<string> connectionIds) => Proxy;

        public IClientProxy Group(string groupName) => Proxy;

        public IClientProxy GroupExcept(string groupName, IReadOnlyList<string> excludedConnectionIds) => Proxy;

        public IClientProxy Groups(IReadOnlyList<string> groupNames) => Proxy;

        public IClientProxy User(string userId) => Proxy;

        public IClientProxy Users(IReadOnlyList<string> userIds) => Proxy;
    }

    private sealed class NoOpClientProxy : IClientProxy
    {
        public Task SendCoreAsync(string method, object?[] args, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }

    private sealed class NoOpGroupManager : IGroupManager
    {
        public Task AddToGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;

        public Task RemoveFromGroupAsync(string connectionId, string groupName, CancellationToken cancellationToken = default) =>
            Task.CompletedTask;
    }
}
