package com.eventzen.event.dto;

import java.util.List;

public record EventDetailResponse(
        EventSummaryResponse event,
        List<SessionResponse> sessions,
        List<AgendaItemResponse> agendaItems,
        int registrationUtilizationPercent
) {
}
