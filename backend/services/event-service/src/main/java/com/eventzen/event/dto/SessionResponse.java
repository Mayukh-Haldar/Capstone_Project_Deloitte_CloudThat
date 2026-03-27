package com.eventzen.event.dto;

import java.time.OffsetDateTime;
import java.util.UUID;

public record SessionResponse(
        UUID id,
        String sessionTitle,
        String speakerName,
        String speakerId,
        String speakerPhotoUrl,
        String speakerBio,
        String speakerRole,
        String speakerCompany,
        String room,
        String sessionType,
        OffsetDateTime startTime,
        OffsetDateTime endTime,
        Integer capacity,
        String description
) {
}
