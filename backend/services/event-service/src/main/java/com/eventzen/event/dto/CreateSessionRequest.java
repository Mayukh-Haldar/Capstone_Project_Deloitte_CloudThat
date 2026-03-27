package com.eventzen.event.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;

public record CreateSessionRequest(
        @NotBlank @Size(max = 160) String sessionTitle,
        @Size(max = 120) String speakerName,
        String speakerId,
        @Size(max = 2000000) String speakerPhotoUrl,
        @Size(max = 2000) String speakerBio,
        @Size(max = 120) String speakerRole,
        @Size(max = 120) String speakerCompany,
        @Size(max = 120) String room,
        @Size(max = 80) String sessionType,
        @NotNull @Future OffsetDateTime startTime,
        @NotNull @Future OffsetDateTime endTime,
        @Min(1) Integer capacity,
        @Size(max = 2000) String description
) {
}
