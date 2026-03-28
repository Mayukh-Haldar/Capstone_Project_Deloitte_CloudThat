package com.eventzen.event.dto;

import com.eventzen.event.model.EventEnableRequestStatus;
import java.time.OffsetDateTime;
import java.util.UUID;

public record EventEnableRequestResponse(
        UUID requestId,
        UUID eventId,
        String eventTitle,
        UUID vendorId,
        String vendorEmail,
        OffsetDateTime requestedAt,
        EventEnableRequestStatus status,
        String vendorNote,
        String adminNote
) {
}
