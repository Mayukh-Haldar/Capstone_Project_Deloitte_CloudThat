package com.eventzen.event.dto;

import com.eventzen.event.model.RecurrenceRule;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record UpdateEventRequest(
        UUID categoryId,
        @Size(max = 160) String title,
        @Size(max = 80) String eventType,
        @Size(max = 4000) String description,
        @Size(max = 2000000) String bannerImageUrl,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        @Min(1) Integer expectedAttendees,
        @Min(1) Integer capacity,
        @DecimalMin("0.0") BigDecimal estimatedBudget,
        RecurrenceRule recurrenceRule,
        List<@Size(max = 60) String> tags,
        @Valid VenueBookingRequest venueBooking,
        List<@Valid CreateAgendaItemRequest> agendaItems
) {
}
