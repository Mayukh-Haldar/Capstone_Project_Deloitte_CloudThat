package com.eventzen.event.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.OffsetDateTime;

public record CreateAgendaItemRequest(
        @NotBlank @Size(max = 160) String agendaTitle,
        @Size(max = 60) String type,
        @NotNull @Future OffsetDateTime startTime,
        @NotNull @Future OffsetDateTime endTime,
        @Size(max = 2000) String description,
        String linkedSessionId
) {
}
