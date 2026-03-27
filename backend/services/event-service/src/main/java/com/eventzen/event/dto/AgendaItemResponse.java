package com.eventzen.event.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AgendaItemResponse(
        UUID id,
        String agendaTitle,
        String type,
        Integer sortOrder,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        String description,
        String linkedSessionId
) {
}
