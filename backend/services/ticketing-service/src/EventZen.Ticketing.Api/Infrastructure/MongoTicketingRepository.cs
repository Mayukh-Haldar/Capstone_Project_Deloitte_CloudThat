using EventZen.Ticketing.Api.Domain;
using EventZen.Ticketing.Api.Options;
using Microsoft.Extensions.Options;
using MongoDB.Driver;

namespace EventZen.Ticketing.Api.Infrastructure;

public sealed class MongoTicketingRepository : ITicketingRepository
{
    private readonly IMongoCollection<AttendeeDocument> _attendees;
    private readonly IMongoCollection<TicketTypeDocument> _ticketTypes;
    private readonly IMongoCollection<RegistrationDocument> _registrations;
    private readonly IMongoCollection<TicketDocument> _tickets;
    private readonly IMongoCollection<CheckInLogDocument> _checkIns;
    private readonly IMongoCollection<WaitlistEntryDocument> _waitlist;
    private readonly IMongoCollection<SeatReservationDocument> _seatReservations;
    private readonly IMongoCollection<SeatBookingDocument> _seatBookings;

    public MongoTicketingRepository(IOptions<MongoOptions> options)
    {
        var client = new MongoClient(options.Value.ConnectionString);
        var database = client.GetDatabase(options.Value.DatabaseName);
        _attendees = database.GetCollection<AttendeeDocument>("attendees");
        _ticketTypes = database.GetCollection<TicketTypeDocument>("ticket_types");
        _registrations = database.GetCollection<RegistrationDocument>("registrations");
        _tickets = database.GetCollection<TicketDocument>("tickets");
        _checkIns = database.GetCollection<CheckInLogDocument>("checkin_logs");
        _waitlist = database.GetCollection<WaitlistEntryDocument>("waitlist_entries");
        _seatReservations = database.GetCollection<SeatReservationDocument>("seat_reservations");
        _seatBookings = database.GetCollection<SeatBookingDocument>("seat_bookings");
    }

    public async Task<AttendeeDocument?> FindAttendeeByUserIdAsync(Guid userId, CancellationToken cancellationToken) =>
        await _attendees.Find(item => item.UserId == userId).FirstOrDefaultAsync(cancellationToken);

    public async Task<AttendeeDocument?> FindAttendeeByEmailAsync(string email, CancellationToken cancellationToken) =>
        await _attendees.Find(item => item.Email == email).FirstOrDefaultAsync(cancellationToken);

    public async Task<AttendeeDocument> UpsertAttendeeAsync(AttendeeDocument attendee, CancellationToken cancellationToken)
    {
        await _attendees.ReplaceOneAsync(item => item.Id == attendee.Id, attendee, new ReplaceOptions { IsUpsert = true }, cancellationToken);
        return attendee;
    }

    public async Task<TicketTypeDocument> SaveTicketTypeAsync(TicketTypeDocument ticketType, CancellationToken cancellationToken)
    {
        await _ticketTypes.ReplaceOneAsync(item => item.Id == ticketType.Id, ticketType, new ReplaceOptions { IsUpsert = true }, cancellationToken);
        return ticketType;
    }

    public async Task<IReadOnlyList<TicketTypeDocument>> ListTicketTypesAsync(Guid eventId, CancellationToken cancellationToken) =>
        await _ticketTypes.Find(item => item.EventId == eventId).SortBy(item => item.Price).ToListAsync(cancellationToken);

    public async Task<TicketTypeDocument?> GetTicketTypeAsync(Guid ticketTypeId, CancellationToken cancellationToken) =>
        await _ticketTypes.Find(item => item.Id == ticketTypeId).FirstOrDefaultAsync(cancellationToken);

    public async Task<RegistrationDocument?> FindRegistrationAsync(Guid eventId, Guid? attendeeUserId, string attendeeEmail, CancellationToken cancellationToken)
    {
        var normalizedEmail = attendeeEmail.Trim().ToLowerInvariant();
        var filter = attendeeUserId.HasValue
            ? Builders<RegistrationDocument>.Filter.And(
                Builders<RegistrationDocument>.Filter.Eq(item => item.EventId, eventId),
                Builders<RegistrationDocument>.Filter.Or(
                    Builders<RegistrationDocument>.Filter.Eq(item => item.AttendeeUserId, attendeeUserId),
                    Builders<RegistrationDocument>.Filter.And(
                        Builders<RegistrationDocument>.Filter.Eq(item => item.AttendeeUserId, null),
                        Builders<RegistrationDocument>.Filter.Eq(item => item.AttendeeEmail, normalizedEmail)
                    )
                )
            )
            : Builders<RegistrationDocument>.Filter.And(
                Builders<RegistrationDocument>.Filter.Eq(item => item.EventId, eventId),
                Builders<RegistrationDocument>.Filter.Eq(item => item.AttendeeEmail, normalizedEmail)
            );

        return await _registrations.Find(filter).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<RegistrationDocument?> FindRegistrationByIdAsync(Guid registrationId, CancellationToken cancellationToken) =>
        await _registrations.Find(item => item.Id == registrationId).FirstOrDefaultAsync(cancellationToken);

    public async Task<RegistrationDocument> SaveRegistrationAsync(RegistrationDocument registration, CancellationToken cancellationToken)
    {
        await _registrations.ReplaceOneAsync(item => item.Id == registration.Id, registration, new ReplaceOptions { IsUpsert = true }, cancellationToken);
        return registration;
    }

    public async Task<IReadOnlyList<RegistrationDocument>> ListRegistrationsForEventAsync(Guid eventId, CancellationToken cancellationToken) =>
        await _registrations.Find(item => item.EventId == eventId).SortByDescending(item => item.CreatedAt).ToListAsync(cancellationToken);

    public async Task<IReadOnlyList<RegistrationDocument>> ListRegistrationsForUserAsync(Guid userId, string email, CancellationToken cancellationToken)
    {
        var normalizedEmail = email.Trim().ToLowerInvariant();
        var filter = Builders<RegistrationDocument>.Filter.Or(
            Builders<RegistrationDocument>.Filter.Eq(item => item.AttendeeUserId, userId),
            Builders<RegistrationDocument>.Filter.And(
                Builders<RegistrationDocument>.Filter.Eq(item => item.AttendeeUserId, null),
                Builders<RegistrationDocument>.Filter.Eq(item => item.AttendeeEmail, normalizedEmail)
            )
        );

        return await _registrations
            .Find(filter)
            .SortByDescending(item => item.CreatedAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<TicketDocument> SaveTicketAsync(TicketDocument ticket, CancellationToken cancellationToken)
    {
        await _tickets.ReplaceOneAsync(item => item.Id == ticket.Id, ticket, new ReplaceOptions { IsUpsert = true }, cancellationToken);
        return ticket;
    }

    public async Task<TicketDocument?> FindTicketByIdAsync(Guid ticketId, CancellationToken cancellationToken) =>
        await _tickets.Find(item => item.Id == ticketId).FirstOrDefaultAsync(cancellationToken);

    public async Task<TicketDocument?> FindTicketByPayloadAsync(string payload, CancellationToken cancellationToken) =>
        await _tickets.Find(item => item.QrPayload == payload).FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<TicketDocument>> ListTicketsForUserAsync(Guid userId, string email, CancellationToken cancellationToken)
    {
        var registrations = await ListRegistrationsForUserAsync(userId, email, cancellationToken);
        var ticketIds = registrations.Select(item => item.TicketId).ToList();
        return ticketIds.Count == 0
            ? []
            : await _tickets.Find(item => ticketIds.Contains(item.Id)).SortByDescending(item => item.CreatedAt).ToListAsync(cancellationToken);
    }

    public async Task<CheckInLogDocument> SaveCheckInAsync(CheckInLogDocument checkIn, CancellationToken cancellationToken)
    {
        await _checkIns.InsertOneAsync(checkIn, cancellationToken: cancellationToken);
        return checkIn;
    }

    public Task<bool> HasCheckInAsync(Guid registrationId, CancellationToken cancellationToken) =>
        _checkIns.Find(item => item.RegistrationId == registrationId).AnyAsync(cancellationToken);

    public async Task<IReadOnlyList<CheckInLogDocument>> ListCheckInsForEventAsync(Guid eventId, CancellationToken cancellationToken) =>
        await _checkIns.Find(item => item.EventId == eventId).SortByDescending(item => item.CheckInTime).ToListAsync(cancellationToken);

    public async Task<WaitlistEntryDocument> SaveWaitlistEntryAsync(WaitlistEntryDocument entry, CancellationToken cancellationToken)
    {
        await _waitlist.ReplaceOneAsync(item => item.Id == entry.Id, entry, new ReplaceOptions { IsUpsert = true }, cancellationToken);
        return entry;
    }

    public async Task<WaitlistEntryDocument?> FindActiveWaitlistEntryAsync(Guid eventId, Guid? attendeeUserId, string attendeeEmail, CancellationToken cancellationToken) =>
        await _waitlist.Find(item => item.EventId == eventId && item.Status == WaitlistStatus.Active &&
                                     ((attendeeUserId.HasValue && item.AttendeeUserId == attendeeUserId) || item.AttendeeEmail == attendeeEmail))
            .FirstOrDefaultAsync(cancellationToken);

    public async Task<WaitlistEntryDocument?> GetNextWaitlistEntryAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken) =>
        await _waitlist.Find(item => item.EventId == eventId && item.TicketTypeId == ticketTypeId && item.Status == WaitlistStatus.Active)
            .SortBy(item => item.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

    // Seat reservations
    public async Task<SeatReservationDocument?> FindActiveSeatReservationAsync(Guid eventId, Guid ticketTypeId, string seatRow, int seatColumn, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        return await _seatReservations.Find(item =>
            item.EventId == eventId &&
            item.TicketTypeId == ticketTypeId &&
            item.SeatRow == seatRow &&
            item.SeatColumn == seatColumn &&
            item.ExpiresAt > now
        ).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<SeatReservationDocument?> FindActiveUserReservationAsync(Guid eventId, Guid ticketTypeId, Guid userId, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        return await _seatReservations.Find(item =>
            item.EventId == eventId &&
            item.TicketTypeId == ticketTypeId &&
            item.UserId == userId &&
            item.ExpiresAt > now
        ).FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<SeatReservationDocument?> GetSeatReservationByIdAsync(Guid reservationId, CancellationToken cancellationToken) =>
        await _seatReservations.Find(item => item.Id == reservationId).FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<SeatReservationDocument>> ListActiveSeatReservationsAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        return await _seatReservations.Find(item =>
            item.EventId == eventId &&
            item.TicketTypeId == ticketTypeId &&
            item.ExpiresAt > now
        ).ToListAsync(cancellationToken);
    }

    public async Task<SeatReservationDocument> SaveSeatReservationAsync(SeatReservationDocument reservation, CancellationToken cancellationToken)
    {
        await _seatReservations.ReplaceOneAsync(item => item.Id == reservation.Id, reservation, new ReplaceOptions { IsUpsert = true }, cancellationToken);
        return reservation;
    }

    public async Task DeleteSeatReservationAsync(Guid reservationId, CancellationToken cancellationToken) =>
        await _seatReservations.DeleteOneAsync(item => item.Id == reservationId, cancellationToken);

    // Seat bookings
    public async Task<SeatBookingDocument?> FindSeatBookingAsync(Guid eventId, Guid ticketTypeId, string seatRow, int seatColumn, CancellationToken cancellationToken) =>
        await _seatBookings.Find(item =>
            item.EventId == eventId &&
            item.TicketTypeId == ticketTypeId &&
            item.SeatRow == seatRow &&
            item.SeatColumn == seatColumn
        ).FirstOrDefaultAsync(cancellationToken);

    public async Task<SeatBookingDocument?> FindSeatBookingByRegistrationIdAsync(Guid registrationId, CancellationToken cancellationToken) =>
        await _seatBookings.Find(item => item.RegistrationId == registrationId).FirstOrDefaultAsync(cancellationToken);

    public async Task<IReadOnlyList<SeatBookingDocument>> ListSeatBookingsAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken) =>
        await _seatBookings.Find(item => item.EventId == eventId && item.TicketTypeId == ticketTypeId).ToListAsync(cancellationToken);

    public async Task<SeatBookingDocument> SaveSeatBookingAsync(SeatBookingDocument booking, CancellationToken cancellationToken)
    {
        await _seatBookings.ReplaceOneAsync(item => item.Id == booking.Id, booking, new ReplaceOptions { IsUpsert = true }, cancellationToken);
        return booking;
    }

    public async Task DeleteSeatBookingAsync(Guid bookingId, CancellationToken cancellationToken) =>
        await _seatBookings.DeleteOneAsync(item => item.Id == bookingId, cancellationToken);
}
