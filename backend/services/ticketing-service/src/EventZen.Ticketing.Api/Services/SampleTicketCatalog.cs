using EventZen.Ticketing.Api.Domain;

namespace EventZen.Ticketing.Api.Services;

public static class SampleTicketCatalog
{
    public static readonly IReadOnlyList<TicketTypeDocument> TicketTypes =
    [
        CreateTicketType(
            "81000000-0000-0000-0000-000000000001",
            "70000000-0000-0000-0000-000000000001",
            "General Pass",
            "GENERAL",
            3499m,
            500,
            500,
            6,
            "Main summit access, keynote hall seating, and networking floor access."
        ),
        CreateTicketType(
            "81000000-0000-0000-0000-000000000002",
            "70000000-0000-0000-0000-000000000001",
            "VIP Delegate",
            "VIP",
            7499m,
            120,
            120,
            4,
            "Priority check-in, speaker lounge access, and reserved keynote seating."
        ),
        CreateTicketType(
            "81000000-0000-0000-0000-000000000003",
            "70000000-0000-0000-0000-000000000002",
            "Expo Floor Pass",
            "GENERAL",
            1299m,
            900,
            900,
            8,
            "Full-day access to installations, creator booths, and open sessions."
        ),
        CreateTicketType(
            "81000000-0000-0000-0000-000000000004",
            "70000000-0000-0000-0000-000000000002",
            "Creator Circle",
            "VIP",
            2999m,
            180,
            180,
            4,
            "Includes mentor reviews, creator lounge access, and fast-lane entry."
        ),
        CreateTicketType(
            "81000000-0000-0000-0000-000000000005",
            "70000000-0000-0000-0000-000000000003",
            "Executive Seat",
            "GENERAL",
            4200m,
            260,
            260,
            3,
            "Forum access, finance roundtables, and curated breakfast networking."
        ),
        CreateTicketType(
            "81000000-0000-0000-0000-000000000006",
            "70000000-0000-0000-0000-000000000003",
            "Leadership Table",
            "VIP",
            8900m,
            48,
            48,
            2,
            "Reserved front section seating and closed-door peer roundtable invitation."
        ),
        CreateTicketType(
            "81000000-0000-0000-0000-000000000007",
            "70000000-0000-0000-0000-000000000004",
            "Community Entry",
            "GENERAL",
            299m,
            700,
            700,
            10,
            "Maker fair entry plus open stage and food court access."
        ),
        CreateTicketType(
            "81000000-0000-0000-0000-000000000008",
            "70000000-0000-0000-0000-000000000004",
            "Workshop Bundle",
            "SPONSOR",
            899m,
            120,
            120,
            4,
            "Community entry plus access to limited-capacity maker workshops."
        )
    ];

    public static IReadOnlyList<TicketTypeDocument> GetForEvent(Guid eventId) =>
        TicketTypes.Where(item => item.EventId == eventId).ToList();

    private static TicketTypeDocument CreateTicketType(
        string ticketTypeId,
        string eventId,
        string ticketName,
        string tierCode,
        decimal price,
        int totalQuantity,
        int availableQuantity,
        int maxPerOrder,
        string description) =>
        new()
        {
            Id = Guid.Parse(ticketTypeId),
            EventId = Guid.Parse(eventId),
            TicketName = ticketName,
            TierCode = tierCode,
            Price = price,
            TotalQuantity = totalQuantity,
            AvailableQuantity = availableQuantity,
            MaxPerOrder = maxPerOrder,
            Description = description,
            IsActive = true
        };
}
