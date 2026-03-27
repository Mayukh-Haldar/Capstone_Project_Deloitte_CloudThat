package com.eventzen.event.service;

import com.eventzen.event.dto.AgendaItemResponse;
import com.eventzen.event.dto.CategoryResponse;
import com.eventzen.event.dto.EventDetailResponse;
import com.eventzen.event.dto.EventSummaryResponse;
import com.eventzen.event.dto.SessionResponse;
import com.eventzen.event.model.Event;
import com.eventzen.event.model.EventAgendaItem;
import com.eventzen.event.model.EventCategory;
import com.eventzen.event.model.EventSession;
import java.util.LinkedHashSet;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class EventMapper {

    public CategoryResponse toCategoryResponse(EventCategory category) {
        return new CategoryResponse(category.getId(), category.getName(), category.getDescription());
    }

    public EventSummaryResponse toSummary(Event event) {
        return new EventSummaryResponse(
                event.getId(),
                event.getOrganizerId(),
                event.getCategory().getId(),
                event.getCategory().getName(),
                event.getTitle(),
                event.getEventType(),
                event.getDescription(),
                event.getBannerImageUrl(),
                event.getStartTime(),
                event.getEndTime(),
                event.getExpectedAttendees(),
                event.getCapacity(),
                event.getEstimatedBudget(),
                event.getStatus(),
                event.getRecurrenceRule(),
                event.getVenueId(),
                event.getVenueName(),
                event.getVenueCity(),
                event.getVenueBookingId(),
                new LinkedHashSet<>(event.getTags()),
                event.getCreatedAt(),
                event.getUpdatedAt()
        );
    }

    public EventDetailResponse toDetail(Event event) {
        List<SessionResponse> sessions = event.getSessions() == null ? List.of() : event.getSessions().stream().map(this::toSession).toList();
        List<AgendaItemResponse> agenda = event.getAgendaItems() == null ? List.of() : event.getAgendaItems().stream().map(this::toAgenda).toList();
        int utilization = event.getCapacity() == 0 ? 0 : Math.min(100, (int) Math.round((event.getExpectedAttendees() * 100.0) / event.getCapacity()));
        return new EventDetailResponse(toSummary(event), sessions, agenda, utilization);
    }

    public SessionResponse toSession(EventSession session) {
        return new SessionResponse(
                session.getId(),
                session.getSessionTitle(),
                session.getSpeakerName(),
                session.getSpeakerId(),
                session.getSpeakerPhotoUrl(),
                session.getSpeakerBio(),
                session.getSpeakerRole(),
                session.getSpeakerCompany(),
                session.getRoom(),
                session.getSessionType(),
                session.getStartTime(),
                session.getEndTime(),
                session.getCapacity(),
                session.getDescription()
        );
    }

    public AgendaItemResponse toAgenda(EventAgendaItem item) {
        return new AgendaItemResponse(
                item.getId(),
                item.getAgendaTitle(),
                item.getType(),
                item.getSortOrder(),
                item.getStartTime(),
                item.getEndTime(),
                item.getDescription(),
                item.getLinkedSessionId()
        );
    }
}
