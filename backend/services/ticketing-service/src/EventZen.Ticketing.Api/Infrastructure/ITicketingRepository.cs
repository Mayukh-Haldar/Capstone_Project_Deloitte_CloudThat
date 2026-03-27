using EventZen.Ticketing.Api.Domain;

namespace EventZen.Ticketing.Api.Infrastructure;

public interface ITicketingRepository
{
    Task<AttendeeDocument?> FindAttendeeByUserIdAsync(Guid userId, CancellationToken cancellationToken);
    Task<AttendeeDocument?> FindAttendeeByEmailAsync(string email, CancellationToken cancellationToken);
    Task<AttendeeDocument> UpsertAttendeeAsync(AttendeeDocument attendee, CancellationToken cancellationToken);
    Task<TicketTypeDocument> SaveTicketTypeAsync(TicketTypeDocument ticketType, CancellationToken cancellationToken);
    Task<IReadOnlyList<TicketTypeDocument>> ListTicketTypesAsync(Guid eventId, CancellationToken cancellationToken);
    Task<TicketTypeDocument?> GetTicketTypeAsync(Guid ticketTypeId, CancellationToken cancellationToken);
    Task<RegistrationDocument?> FindRegistrationAsync(Guid eventId, Guid? attendeeUserId, string attendeeEmail, CancellationToken cancellationToken);
    Task<RegistrationDocument?> FindRegistrationByIdAsync(Guid registrationId, CancellationToken cancellationToken);
    Task<RegistrationDocument> SaveRegistrationAsync(RegistrationDocument registration, CancellationToken cancellationToken);
    Task<IReadOnlyList<RegistrationDocument>> ListRegistrationsForEventAsync(Guid eventId, CancellationToken cancellationToken);
    Task<IReadOnlyList<RegistrationDocument>> ListRegistrationsForUserAsync(Guid userId, string email, CancellationToken cancellationToken);
    Task<TicketDocument> SaveTicketAsync(TicketDocument ticket, CancellationToken cancellationToken);
    Task<TicketDocument?> FindTicketByIdAsync(Guid ticketId, CancellationToken cancellationToken);
    Task<TicketDocument?> FindTicketByPayloadAsync(string payload, CancellationToken cancellationToken);
    Task<IReadOnlyList<TicketDocument>> ListTicketsForUserAsync(Guid userId, string email, CancellationToken cancellationToken);
    Task<CheckInLogDocument> SaveCheckInAsync(CheckInLogDocument checkIn, CancellationToken cancellationToken);
    Task<bool> HasCheckInAsync(Guid registrationId, CancellationToken cancellationToken);
    Task<IReadOnlyList<CheckInLogDocument>> ListCheckInsForEventAsync(Guid eventId, CancellationToken cancellationToken);
    Task<WaitlistEntryDocument> SaveWaitlistEntryAsync(WaitlistEntryDocument entry, CancellationToken cancellationToken);
    Task<WaitlistEntryDocument?> FindActiveWaitlistEntryAsync(Guid eventId, Guid? attendeeUserId, string attendeeEmail, CancellationToken cancellationToken);
    Task<WaitlistEntryDocument?> GetNextWaitlistEntryAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken);

    // Seat reservations
    Task<SeatReservationDocument?> FindActiveSeatReservationAsync(Guid eventId, Guid ticketTypeId, string seatRow, int seatColumn, CancellationToken cancellationToken);
    Task<SeatReservationDocument?> FindActiveUserReservationAsync(Guid eventId, Guid ticketTypeId, Guid userId, CancellationToken cancellationToken);
    Task<SeatReservationDocument?> GetSeatReservationByIdAsync(Guid reservationId, CancellationToken cancellationToken);
    Task<IReadOnlyList<SeatReservationDocument>> ListActiveSeatReservationsAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken);
    Task<SeatReservationDocument> SaveSeatReservationAsync(SeatReservationDocument reservation, CancellationToken cancellationToken);
    Task DeleteSeatReservationAsync(Guid reservationId, CancellationToken cancellationToken);

    // Seat bookings (permanent)
    Task<SeatBookingDocument?> FindSeatBookingAsync(Guid eventId, Guid ticketTypeId, string seatRow, int seatColumn, CancellationToken cancellationToken);
    Task<SeatBookingDocument?> FindSeatBookingByRegistrationIdAsync(Guid registrationId, CancellationToken cancellationToken);
    Task<IReadOnlyList<SeatBookingDocument>> ListSeatBookingsAsync(Guid eventId, Guid ticketTypeId, CancellationToken cancellationToken);
    Task<SeatBookingDocument> SaveSeatBookingAsync(SeatBookingDocument booking, CancellationToken cancellationToken);
    Task DeleteSeatBookingAsync(Guid bookingId, CancellationToken cancellationToken);
}
