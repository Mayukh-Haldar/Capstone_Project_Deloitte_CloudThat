package com.eventzen.event.service;

import com.eventzen.event.dto.AgendaItemResponse;
import com.eventzen.event.dto.CreateAgendaItemRequest;
import com.eventzen.event.dto.CreateEventRequest;
import com.eventzen.event.dto.CreateSessionRequest;
import com.eventzen.event.dto.EventDetailResponse;
import com.eventzen.event.dto.EventSummaryResponse;
import com.eventzen.event.dto.PagedResponse;
import com.eventzen.event.dto.ReorderAgendaRequest;
import com.eventzen.event.dto.SessionResponse;
import com.eventzen.event.dto.TransitionEventStatusRequest;
import com.eventzen.event.dto.UpdateEventRequest;
import com.eventzen.event.dto.UpdateSessionRequest;
import com.eventzen.event.exception.EventServiceException;
import com.eventzen.event.model.Event;
import com.eventzen.event.model.EventAgendaItem;
import com.eventzen.event.model.EventCategory;
import com.eventzen.event.model.EventSession;
import com.eventzen.event.model.EventStatus;
import com.eventzen.event.model.RecurrenceRule;
import com.eventzen.event.repository.EventAgendaItemRepository;
import com.eventzen.event.repository.EventCategoryRepository;
import com.eventzen.event.repository.EventRepository;
import com.eventzen.event.repository.EventSessionRepository;
import com.eventzen.event.security.AuthenticatedUser;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final EventCategoryRepository categoryRepository;
    private final EventSessionRepository sessionRepository;
    private final EventAgendaItemRepository agendaRepository;
    private final EventMapper mapper;
    private final VenueVendorClient venueVendorClient;

    public EventService(
            EventRepository eventRepository,
            EventCategoryRepository categoryRepository,
            EventSessionRepository sessionRepository,
            EventAgendaItemRepository agendaRepository,
            EventMapper mapper,
            VenueVendorClient venueVendorClient
    ) {
        this.eventRepository = eventRepository;
        this.categoryRepository = categoryRepository;
        this.sessionRepository = sessionRepository;
        this.agendaRepository = agendaRepository;
        this.mapper = mapper;
        this.venueVendorClient = venueVendorClient;
    }

    @Transactional
    public EventDetailResponse createEvent(CreateEventRequest request, AuthenticatedUser actor, String authorization) {
        validateEventWindow(request.startTime(), request.endTime());
        Event event = new Event();
        event.setId(UUID.randomUUID());
        event.setOrganizerId(resolveOrganizerId(request.organizerId(), actor));
        event.setCategory(findCategory(request.categoryId()));
        event.setTitle(request.title());
        event.setEventType(request.eventType());
        event.setDescription(request.description());
        event.setBannerImageUrl(request.bannerImageUrl());
        event.setStartTime(request.startTime());
        event.setEndTime(request.endTime());
        event.setExpectedAttendees(request.expectedAttendees());
        event.setCapacity(request.capacity());
        event.setEstimatedBudget(request.estimatedBudget());
        event.setRecurrenceRule(request.recurrenceRule() == null ? RecurrenceRule.NONE : request.recurrenceRule());
        event.setTags(normalizeTags(request.tags()));
        event.setStatus(EventStatus.DRAFT);
        event.setSessions(new ArrayList<>());
        event.setAgendaItems(new ArrayList<>());
        validateCapacity(event.getExpectedAttendees(), event.getCapacity());

        if (request.venueBooking() != null) {
            venueVendorClient.ensureVenueAvailability(authorization, actor, request.venueBooking(), request.startTime(), request.endTime());
            event.setVenueId(request.venueBooking().venueId());
            event.setVenueName(request.venueBooking().venueName());
            event.setVenueCity(request.venueBooking().venueCity());
        }

        Event saved = eventRepository.save(event);
        replaceAgenda(saved, request.agendaItems());
        if (request.venueBooking() != null) {
            saved.setVenueBookingId(venueVendorClient.createBooking(authorization, actor, saved.getId().toString(), request.venueBooking(), saved.getStartTime(), saved.getEndTime()));
        }
        return mapper.toDetail(eventRepository.save(saved));
    }

    public PagedResponse<EventSummaryResponse> listEvents(
            String q,
            String category,
            EventStatus status,
            String city,
            OffsetDateTime from,
            OffsetDateTime to,
            UUID organizerId,
            int page,
            int size
    ) {
        Specification<Event> specification = Specification.allOf(
                textSpec(q),
                categorySpec(category),
                statusSpec(status),
                citySpec(city),
                fromSpec(from),
                toSpec(to),
                organizerSpec(organizerId)
        );
        Page<Event> result = eventRepository.findAll(specification, PageRequest.of(page, size));
        return new PagedResponse<>(result.getContent().stream().map(mapper::toSummary).toList(), result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    public EventDetailResponse getEvent(UUID eventId) {
        return mapper.toDetail(findEvent(eventId));
    }

    @Transactional
    public EventDetailResponse updateEvent(UUID eventId, UpdateEventRequest request, AuthenticatedUser actor) {
        Event event = findEvent(eventId);
        ensureWritable(event, actor);
        OffsetDateTime start = request.startTime() == null ? event.getStartTime() : request.startTime();
        OffsetDateTime end = request.endTime() == null ? event.getEndTime() : request.endTime();
        validateEventWindow(start, end);
        validateCapacity(request.expectedAttendees() == null ? event.getExpectedAttendees() : request.expectedAttendees(),
                request.capacity() == null ? event.getCapacity() : request.capacity());

        if (request.categoryId() != null) {
            event.setCategory(findCategory(request.categoryId()));
        }
        if (request.title() != null) {
            event.setTitle(request.title());
        }
        if (request.eventType() != null) {
            event.setEventType(request.eventType());
        }
        if (request.description() != null) {
            event.setDescription(request.description());
        }
        if (request.bannerImageUrl() != null) {
            event.setBannerImageUrl(request.bannerImageUrl());
        }
        event.setStartTime(start);
        event.setEndTime(end);
        if (request.expectedAttendees() != null) {
            event.setExpectedAttendees(request.expectedAttendees());
        }
        if (request.capacity() != null) {
            event.setCapacity(request.capacity());
        }
        if (request.estimatedBudget() != null) {
            event.setEstimatedBudget(request.estimatedBudget());
        }
        if (request.recurrenceRule() != null) {
            event.setRecurrenceRule(request.recurrenceRule());
        }
        if (request.tags() != null) {
            event.setTags(normalizeTags(request.tags()));
        }
        if (request.agendaItems() != null) {
            replaceAgenda(event, request.agendaItems());
        }
        return mapper.toDetail(eventRepository.save(event));
    }

    @Transactional
    public EventDetailResponse transitionStatus(UUID eventId, TransitionEventStatusRequest request, AuthenticatedUser actor) {
        Event event = findEvent(eventId);
        ensureWritable(event, actor);
        if (!event.getStatus().canTransitionTo(request.status())) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Invalid event status transition from %s to %s".formatted(event.getStatus(), request.status()));
        }
        event.setStatus(request.status());
        return mapper.toDetail(eventRepository.save(event));
    }

    @Transactional
    public void archiveEvent(UUID eventId) {
        Event event = findEvent(eventId);
        event.setStatus(EventStatus.ARCHIVED);
        eventRepository.save(event);
    }

    @Transactional
    public SessionResponse addSession(UUID eventId, CreateSessionRequest request, AuthenticatedUser actor) {
        Event event = findEvent(eventId);
        ensureWritable(event, actor);
        validateNestedRange(event, request.startTime(), request.endTime(), "Session");
        boolean hasConflict = hasSessionConflict(eventId, request.startTime(), request.endTime(), null);
        if (hasConflict) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Session overlaps with an existing session");
        }

        EventSession session = new EventSession();
        session.setId(UUID.randomUUID());
        session.setEvent(event);
        session.setSessionTitle(request.sessionTitle());
        session.setSpeakerName(request.speakerName());
        session.setSpeakerId(request.speakerId());
        session.setSpeakerPhotoUrl(request.speakerPhotoUrl());
        session.setSpeakerBio(request.speakerBio());
        session.setSpeakerRole(request.speakerRole());
        session.setSpeakerCompany(request.speakerCompany());
        session.setRoom(request.room());
        session.setSessionType(request.sessionType());
        session.setStartTime(request.startTime());
        session.setEndTime(request.endTime());
        session.setCapacity(request.capacity());
        session.setDescription(request.description());
        return mapper.toSession(sessionRepository.save(session));
    }

    @Transactional
    public SessionResponse updateSession(UUID eventId, UUID sessionId, UpdateSessionRequest request, AuthenticatedUser actor) {
        Event event = findEvent(eventId);
        ensureWritable(event, actor);
        EventSession session = sessionRepository.findById(sessionId)
                .filter(candidate -> candidate.getEvent().getId().equals(eventId))
                .orElseThrow(() -> new EventServiceException(HttpStatus.NOT_FOUND, "EVENT-404", "Session not found"));

        validateNestedRange(event, request.startTime(), request.endTime(), "Session");
        boolean hasConflict = hasSessionConflict(eventId, request.startTime(), request.endTime(), sessionId);
        if (hasConflict) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Session overlaps with an existing session");
        }

        session.setSessionTitle(request.sessionTitle());
        session.setSpeakerName(request.speakerName());
        session.setSpeakerId(request.speakerId());
        session.setSpeakerPhotoUrl(request.speakerPhotoUrl());
        session.setSpeakerBio(request.speakerBio());
        session.setSpeakerRole(request.speakerRole());
        session.setSpeakerCompany(request.speakerCompany());
        session.setRoom(request.room());
        session.setSessionType(request.sessionType());
        session.setStartTime(request.startTime());
        session.setEndTime(request.endTime());
        session.setCapacity(request.capacity());
        session.setDescription(request.description());
        return mapper.toSession(sessionRepository.save(session));
    }

    @Transactional
    public void deleteSession(UUID eventId, UUID sessionId, AuthenticatedUser actor) {
        Event event = findEvent(eventId);
        ensureWritable(event, actor);
        EventSession session = sessionRepository.findById(sessionId)
                .filter(candidate -> candidate.getEvent().getId().equals(eventId))
                .orElseThrow(() -> new EventServiceException(HttpStatus.NOT_FOUND, "EVENT-404", "Session not found"));
        sessionRepository.delete(session);
    }

    public List<AgendaItemResponse> getAgenda(UUID eventId) {
        findEvent(eventId);
        return agendaRepository.findByEventIdOrderBySortOrderAsc(eventId).stream().map(mapper::toAgenda).toList();
    }

    @Transactional
    public List<AgendaItemResponse> reorderAgenda(UUID eventId, ReorderAgendaRequest request, AuthenticatedUser actor) {
        Event event = findEvent(eventId);
        ensureWritable(event, actor);
        List<EventAgendaItem> items = agendaRepository.findByEventIdOrderBySortOrderAsc(eventId);
        if (items.size() != request.agendaItemIds().size()) {
            throw new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", "Agenda reorder payload must contain all agenda items");
        }
        for (int index = 0; index < request.agendaItemIds().size(); index++) {
            UUID agendaId = request.agendaItemIds().get(index);
            EventAgendaItem item = items.stream().filter(candidate -> candidate.getId().equals(agendaId)).findFirst()
                    .orElseThrow(() -> new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", "Agenda item does not belong to event"));
            item.setSortOrder(index + 1);
        }
        return agendaRepository.saveAll(items).stream().sorted(java.util.Comparator.comparing(EventAgendaItem::getSortOrder)).map(mapper::toAgenda).toList();
    }

    public List<EventSummaryResponse> search(String query) {
        return eventRepository.findAll(textSpec(query)).stream().map(mapper::toSummary).toList();
    }

    private void replaceAgenda(Event event, List<CreateAgendaItemRequest> requests) {
        if (requests == null) {
            return;
        }
        event.getAgendaItems().clear();
        for (int index = 0; index < requests.size(); index++) {
            CreateAgendaItemRequest request = requests.get(index);
            validateNestedRange(event, request.startTime(), request.endTime(), "Agenda");
            EventAgendaItem item = new EventAgendaItem();
            item.setId(UUID.randomUUID());
            item.setEvent(event);
            item.setAgendaTitle(request.agendaTitle());
            item.setType(request.type());
            item.setSortOrder(index + 1);
            item.setStartTime(request.startTime());
            item.setEndTime(request.endTime());
            item.setDescription(request.description());
            item.setLinkedSessionId(request.linkedSessionId());
            event.getAgendaItems().add(item);
        }
    }

    private boolean hasSessionConflict(UUID eventId, java.time.OffsetDateTime startTime, java.time.OffsetDateTime endTime, UUID excludeSessionId) {
        return sessionRepository.findByEventIdOrderByStartTimeAsc(eventId).stream()
                .filter(existing -> excludeSessionId == null || !existing.getId().equals(excludeSessionId))
                .anyMatch(existing -> startTime.isBefore(existing.getEndTime()) && endTime.isAfter(existing.getStartTime()));
    }

    private void ensureWritable(Event event, AuthenticatedUser actor) {
        if (actor.hasRole("ADMIN")) {
            return;
        }
        if (!actor.hasRole("ORGANIZER") || !event.getOrganizerId().equals(actor.id())) {
            throw new EventServiceException(HttpStatus.FORBIDDEN, "AUTH-403", "Only the owning organizer or an admin can modify this event");
        }
    }

    private EventCategory findCategory(UUID categoryId) {
        return categoryRepository.findById(categoryId)
                .orElseThrow(() -> new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", "Unknown category"));
    }

    private Event findEvent(UUID eventId) {
        return eventRepository.findById(eventId)
                .orElseThrow(() -> new EventServiceException(HttpStatus.NOT_FOUND, "EVENT-404", "Event not found"));
    }

    private UUID resolveOrganizerId(UUID requestedOrganizerId, AuthenticatedUser actor) {
        return actor.hasRole("ADMIN") && requestedOrganizerId != null ? requestedOrganizerId : actor.id();
    }

    private Set<String> normalizeTags(List<String> tags) {
        return tags == null ? Set.of() : new LinkedHashSet<>(tags.stream().filter(StringUtils::hasText).map(String::trim).toList());
    }

    private void validateEventWindow(OffsetDateTime start, OffsetDateTime end) {
        if (start == null || end == null || !end.isAfter(start)) {
            throw new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", "End time must be later than start time");
        }
    }

    private void validateNestedRange(Event event, OffsetDateTime start, OffsetDateTime end, String label) {
        if (!end.isAfter(start)) {
            throw new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", label + " end time must be later than start time");
        }
        if (start.isBefore(event.getStartTime()) || end.isAfter(event.getEndTime())) {
            throw new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", label + " must stay within the event schedule");
        }
    }

    private void validateCapacity(Integer expectedAttendees, Integer capacity) {
        if (Objects.requireNonNullElse(expectedAttendees, 0) > Objects.requireNonNullElse(capacity, 0)) {
            throw new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", "Expected attendees cannot exceed capacity");
        }
    }

    private Specification<Event> textSpec(String q) {
        return (root, query, cb) -> !StringUtils.hasText(q) ? null : cb.or(
                cb.like(cb.lower(root.get("title")), "%" + q.toLowerCase() + "%"),
                cb.like(cb.lower(root.get("description")), "%" + q.toLowerCase() + "%"),
                cb.like(cb.lower(root.get("eventType")), "%" + q.toLowerCase() + "%")
        );
    }

    private Specification<Event> categorySpec(String category) {
        return (root, query, cb) -> {
            if (!StringUtils.hasText(category)) {
                return null;
            }

            var categoryJoin = root.join("category");
            UUID categoryId = tryParseUuid(category);
            if (categoryId != null) {
                return cb.equal(categoryJoin.get("id"), categoryId);
            }

            return cb.equal(cb.lower(categoryJoin.get("name")), category.toLowerCase());
        };
    }

    private UUID tryParseUuid(String value) {
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private Specification<Event> statusSpec(EventStatus status) {
        return (root, query, cb) -> status == null ? null : cb.equal(root.get("status"), status);
    }

    private Specification<Event> citySpec(String city) {
        return (root, query, cb) -> !StringUtils.hasText(city) ? null : cb.equal(cb.lower(root.get("venueCity")), city.toLowerCase());
    }

    private Specification<Event> fromSpec(OffsetDateTime from) {
        return (root, query, cb) -> from == null ? null : cb.greaterThanOrEqualTo(root.get("startTime"), from);
    }

    private Specification<Event> toSpec(OffsetDateTime to) {
        return (root, query, cb) -> to == null ? null : cb.lessThanOrEqualTo(root.get("endTime"), to);
    }

    private Specification<Event> organizerSpec(UUID organizerId) {
        return (root, query, cb) -> organizerId == null ? null : cb.equal(root.get("organizerId"), organizerId);
    }
}
