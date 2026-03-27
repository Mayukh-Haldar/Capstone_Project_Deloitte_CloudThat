using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace EventZen.Ticketing.Api.Domain;

public static class RegistrationStatus
{
    public const string Pending = "PENDING";
    public const string Confirmed = "CONFIRMED";
    public const string Waitlisted = "WAITLISTED";
    public const string Canceled = "CANCELED";
    public const string CheckedIn = "CHECKED_IN";
}

public static class TicketStatus
{
    public const string Active = "ACTIVE";
    public const string Canceled = "CANCELED";
    public const string CheckedIn = "CHECKED_IN";
}

public static class WaitlistStatus
{
    public const string Active = "ACTIVE";
    public const string Promoted = "PROMOTED";
    public const string Canceled = "CANCELED";
}

public sealed class AttendeeDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [BsonRepresentation(BsonType.String)]
    public Guid? UserId { get; set; }

    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class TicketTypeDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [BsonRepresentation(BsonType.String)]
    public Guid EventId { get; set; }

    public string TicketName { get; set; } = string.Empty;
    public string TierCode { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int TotalQuantity { get; set; }
    public int AvailableQuantity { get; set; }
    public int MaxPerOrder { get; set; } = 1;
    public string? Description { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset? SaleStartsAt { get; set; }
    public DateTimeOffset? SaleEndsAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class RegistrationDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [BsonRepresentation(BsonType.String)]
    public Guid EventId { get; set; }

    public string EventTitle { get; set; } = string.Empty;
    public DateTimeOffset EventStartTime { get; set; }
    public DateTimeOffset EventEndTime { get; set; }
    public string? VenueName { get; set; }
    public string? VenueCity { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid AttendeeId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid? AttendeeUserId { get; set; }

    public string AttendeeEmail { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.String)]
    public Guid TicketTypeId { get; set; }

    public string TicketTypeName { get; set; } = string.Empty;

    [BsonRepresentation(BsonType.String)]
    public Guid TicketId { get; set; }

    public string Status { get; set; } = RegistrationStatus.Pending;
    public string? IdempotencyKey { get; set; }
    public string? SeatRow { get; set; }
    public int? SeatColumn { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CheckedInAt { get; set; }
    public DateTimeOffset? CancelledAt { get; set; }
}

public sealed class TicketDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [BsonRepresentation(BsonType.String)]
    public Guid RegistrationId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid EventId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid AttendeeId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid TicketTypeId { get; set; }

    public string TicketNumber { get; set; } = string.Empty;
    public string Status { get; set; } = TicketStatus.Active;
    public string QrPayload { get; set; } = string.Empty;
    public string QrSignature { get; set; } = string.Empty;
    public string QrCodeSvgDataUri { get; set; } = string.Empty;
    public string? TicketPassObjectKey { get; set; }
    public string? TicketPassUrl { get; set; }
    public string? SeatRow { get; set; }
    public int? SeatColumn { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class CheckInLogDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [BsonRepresentation(BsonType.String)]
    public Guid EventId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid RegistrationId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid TicketId { get; set; }

    public string Gate { get; set; } = "MAIN";
    public DateTimeOffset CheckInTime { get; set; } = DateTimeOffset.UtcNow;
    public string ScannedByUserId { get; set; } = string.Empty;
}

public sealed class WaitlistEntryDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [BsonRepresentation(BsonType.String)]
    public Guid EventId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid TicketTypeId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid AttendeeId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid? AttendeeUserId { get; set; }

    public string AttendeeEmail { get; set; } = string.Empty;
    public string Status { get; set; } = WaitlistStatus.Active;
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? PromotedAt { get; set; }
}

public static class SeatStatus
{
    public const string Available = "AVAILABLE";
    public const string Reserved = "RESERVED";
    public const string Booked = "BOOKED";
}

public sealed class SeatReservationDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [BsonRepresentation(BsonType.String)]
    public Guid EventId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid TicketTypeId { get; set; }

    public string SeatRow { get; set; } = string.Empty;
    public int SeatColumn { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid? UserId { get; set; }

    public DateTimeOffset ExpiresAt { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}

public sealed class SeatBookingDocument
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public Guid Id { get; set; } = Guid.NewGuid();

    [BsonRepresentation(BsonType.String)]
    public Guid EventId { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid TicketTypeId { get; set; }

    public string SeatRow { get; set; } = string.Empty;
    public int SeatColumn { get; set; }

    [BsonRepresentation(BsonType.String)]
    public Guid RegistrationId { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
}
