package com.eventzen.event.dto;

import com.eventzen.event.model.RecurrenceRule;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record CreateEventRequest(
        UUID organizerId,
        @NotNull UUID categoryId,
        @NotBlank @Size(max = 160) String title,
        @NotBlank @Size(max = 80) String eventType,
        @NotBlank @Size(max = 4000) String description,
        @Size(max = 2000000) String bannerImageUrl,
        @NotNull @Future OffsetDateTime startTime,
        @NotNull @Future OffsetDateTime endTime,
        @NotNull @Min(1) Integer expectedAttendees,
        @NotNull @Min(1) Integer capacity,
        @NotNull @DecimalMin("0.0") BigDecimal estimatedBudget,
        RecurrenceRule recurrenceRule,
        List<@Size(max = 60) String> tags,
        @Valid VenueBookingRequest venueBooking,
        List<@Valid CreateAgendaItemRequest> agendaItems
) {
}
