package com.eventzen.event.dto;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import java.util.UUID;

public record ReorderAgendaRequest(@NotEmpty List<UUID> agendaItemIds) {
}
