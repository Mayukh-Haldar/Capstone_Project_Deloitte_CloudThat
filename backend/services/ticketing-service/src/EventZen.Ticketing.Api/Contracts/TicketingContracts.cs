namespace EventZen.Ticketing.Api.Contracts;

public sealed record CreateTicketTypeRequest(
    string TicketName,
    string TierCode,
    decimal Price,
    int TotalQuantity,
    int MaxPerOrder,
    string? Description,
    DateTimeOffset? SaleStartsAt,
    DateTimeOffset? SaleEndsAt
);

public sealed record UpdateTicketTypeRequest(
    string TicketName,
    string TierCode,
    decimal Price,
    int TotalQuantity,
    int MaxPerOrder,
    string? Description,
    DateTimeOffset? SaleStartsAt,
    DateTimeOffset? SaleEndsAt
);

public sealed record RegisterAttendeeRequest(
    Guid EventId,
    Guid TicketTypeId,
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    string? SeatRow = null,
    int? SeatColumn = null,
    Guid? SeatReservationId = null
);

public sealed record JoinWaitlistRequest(
    Guid TicketTypeId,
    string FirstName,
    string LastName,
    string Email,
    string? Phone
);

public sealed record CheckInScanRequest(
    string QrPayload,
    string Gate
);

public sealed record RegistrationResponse(
    Guid RegistrationId,
    Guid EventId,
    string EventTitle,
    DateTimeOffset EventStartTime,
    DateTimeOffset EventEndTime,
    string? VenueName,
    string? VenueCity,
    string TicketTypeName,
    string Status,
    DateTimeOffset CreatedAt,
    DateTimeOffset? CheckedInAt,
    TicketResponse Ticket,
    string? SeatRow = null,
    int? SeatColumn = null,
    string? SeatLabel = null,
    string? AttendeeUserId = null,
    string? AttendeeEmail = null
);

public sealed record TicketResponse(
    Guid TicketId,
    string TicketNumber,
    string Status,
    string QrPayload,
    string QrSignature,
    string QrCodeSvgDataUri,
    string? TicketPassUrl,
    string? SeatRow = null,
    int? SeatColumn = null,
    string? SeatLabel = null
);

public sealed record TicketTypeResponse(
    Guid TicketTypeId,
    Guid EventId,
    string TicketName,
    string TierCode,
    decimal Price,
    int TotalQuantity,
    int AvailableQuantity,
    int MaxPerOrder,
    string? Description,
    bool IsActive,
    DateTimeOffset? SaleStartsAt,
    DateTimeOffset? SaleEndsAt
);

public sealed record CheckInStatsResponse(
    Guid EventId,
    int TotalRegistrations,
    int CheckedInCount,
    int PendingCount,
    decimal CheckInRate,
    IReadOnlyList<RecentCheckInResponse> RecentCheckIns
);

public sealed record RecentCheckInResponse(
    Guid RegistrationId,
    Guid TicketId,
    string Gate,
    DateTimeOffset CheckInTime
);

public sealed record WaitlistResponse(
    Guid WaitlistEntryId,
    Guid EventId,
    Guid TicketTypeId,
    string Status,
    DateTimeOffset CreatedAt
);

public sealed record CsvImportResponse(
    int ImportedCount,
    IReadOnlyList<string> Errors
);

public sealed record SeatInfoDto(
    string Row,
    int Column,
    string Label,
    string Status,
    DateTimeOffset? ExpiresAt
);

public sealed record SeatRowDto(
    string Row,
    IReadOnlyList<SeatInfoDto> Seats
);

public sealed record SeatMapResponse(
    Guid EventId,
    Guid TicketTypeId,
    string TicketTypeName,
    int Capacity,
    int SeatsPerRow,
    int TotalRows,
    int AvailableCount,
    int ReservedCount,
    int BookedCount,
    IReadOnlyList<SeatRowDto> Rows
);

public sealed record ReserveSeatRequest(
    string SeatRow,
    int SeatColumn
);

public sealed record SeatReservationResponse(
    Guid ReservationId,
    Guid EventId,
    Guid TicketTypeId,
    string SeatRow,
    int SeatColumn,
    string SeatLabel,
    DateTimeOffset ExpiresAt,
    int SecondsRemaining
);
