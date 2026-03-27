package com.eventzen.event.dto;

import com.eventzen.event.model.EventStatus;
import jakarta.validation.constraints.NotNull;

public record TransitionEventStatusRequest(@NotNull EventStatus status) {
}
