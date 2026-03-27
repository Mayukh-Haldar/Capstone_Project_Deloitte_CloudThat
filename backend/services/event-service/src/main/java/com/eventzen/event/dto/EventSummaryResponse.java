package com.eventzen.event.dto;

import com.eventzen.event.model.EventStatus;
import com.eventzen.event.model.RecurrenceRule;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.Set;
import java.util.UUID;

public record EventSummaryResponse(
        UUID id,
        UUID organizerId,
        UUID categoryId,
        String categoryName,
        String title,
        String eventType,
        String description,
        String bannerImageUrl,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        Integer expectedAttendees,
        Integer capacity,
        BigDecimal estimatedBudget,
        EventStatus status,
        RecurrenceRule recurrenceRule,
        String venueId,
        String venueName,
        String venueCity,
        String venueBookingId,
        Set<String> tags,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt
) {
}
