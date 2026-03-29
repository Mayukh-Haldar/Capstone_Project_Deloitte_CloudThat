package com.eventzen.event.service;

import com.eventzen.event.dto.AgendaItemResponse;
import com.eventzen.event.dto.CreateAgendaItemRequest;
import com.eventzen.event.dto.CreateEventRequest;
import com.eventzen.event.dto.CreateSessionRequest;
import com.eventzen.event.dto.EventDetailResponse;
import com.eventzen.event.dto.EventEnableRequestResponse;
import com.eventzen.event.dto.EventSummaryResponse;
import com.eventzen.event.dto.PagedResponse;
import com.eventzen.event.dto.ReorderAgendaRequest;
import com.eventzen.event.dto.SessionResponse;
import com.eventzen.event.dto.TransitionEventStatusRequest;
import com.eventzen.event.dto.UpdateEventRequest;
import com.eventzen.event.dto.UpdateSessionRequest;
import com.eventzen.event.dto.VenueBookingRequest;
import com.eventzen.event.exception.EventServiceException;
import com.eventzen.event.model.Event;
import com.eventzen.event.model.EventApprovalStatus;
import com.eventzen.event.model.EventAgendaItem;
import com.eventzen.event.model.EventCategory;
import com.eventzen.event.model.EventEnableRequest;
import com.eventzen.event.model.EventEnableRequestStatus;
import com.eventzen.event.model.EventSession;
import com.eventzen.event.model.EventStatus;
import com.eventzen.event.model.RecurrenceRule;
import com.eventzen.event.repository.EventAgendaItemRepository;
import com.eventzen.event.repository.EventCategoryRepository;
import com.eventzen.event.repository.EventEnableRequestRepository;
import com.eventzen.event.repository.EventRepository;
import com.eventzen.event.repository.EventSessionRepository;
import com.eventzen.event.security.AuthenticatedUser;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
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
import java.util.Map;
import org.springframework.util.StringUtils;

@Service
public class EventService {

    private final EventRepository eventRepository;
    private final EventCategoryRepository categoryRepository;
    private final EventSessionRepository sessionRepository;
    private final EventAgendaItemRepository agendaRepository;
    private final EventEnableRequestRepository enableRequestRepository;
    private final EventMapper mapper;
    private final VenueVendorClient venueVendorClient;
    private final NotificationClient notificationClient;
    private final TicketingClient ticketingClient;

    public EventService(
            EventRepository eventRepository,
            EventCategoryRepository categoryRepository,
            EventSessionRepository sessionRepository,
            EventAgendaItemRepository agendaRepository,
            EventEnableRequestRepository enableRequestRepository,
            EventMapper mapper,
            VenueVendorClient venueVendorClient,
            NotificationClient notificationClient,
            TicketingClient ticketingClient
    ) {
        this.eventRepository = eventRepository;
        this.categoryRepository = categoryRepository;
        this.sessionRepository = sessionRepository;
        this.agendaRepository = agendaRepository;
        this.enableRequestRepository = enableRequestRepository;
        this.mapper = mapper;
        this.venueVendorClient = venueVendorClient;
        this.notificationClient = notificationClient;
        this.ticketingClient = ticketingClient;
    }

    @Transactional
    public EventDetailResponse createEvent(CreateEventRequest request, AuthenticatedUser actor, String authorization) {
        validateEventWindow(request.startTime(), request.endTime());
        Event event = new Event();
        boolean adminCreated = actor.hasRole("ADMIN");
        event.setId(UUID.randomUUID());
        event.setOrganizerId(resolveOrganizerId(request.organizerId(), actor));
        event.setOrganizerEmail(actor.email());
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
        event.setProposedBudget(request.estimatedBudget());
        event.setApprovedBudget(adminCreated ? request.estimatedBudget() : null);
        event.setApprovalStatus(adminCreated ? EventApprovalStatus.APPROVED : EventApprovalStatus.PENDING);
        event.setApprovalNote(null);
        event.setRecurrenceRule(request.recurrenceRule() == null ? RecurrenceRule.NONE : request.recurrenceRule());
        event.setTags(normalizeTags(request.tags()));
        event.setStatus(adminCreated ? EventStatus.DRAFT : EventStatus.PENDING_APPROVAL);
        event.setSessions(new ArrayList<>());
        event.setAgendaItems(new ArrayList<>());
        validateCapacity(event.getExpectedAttendees(), event.getCapacity());

        if (adminCreated && request.venueBooking() != null) {
            venueVendorClient.ensureVenueAvailability(authorization, actor, request.venueBooking(), request.startTime(), request.endTime());
        }
        if (request.venueBooking() != null) {
            event.setVenueId(request.venueBooking().venueId());
            event.setVenueName(request.venueBooking().venueName());
            event.setVenueCity(request.venueBooking().venueCity());
        }

        Event saved = eventRepository.save(event);
        replaceAgenda(saved, request.agendaItems());
        if (adminCreated && request.venueBooking() != null) {
            VenueVendorClient.BookingResult bookingResult = venueVendorClient.createBooking(
                    authorization,
                    actor,
                    saved.getId().toString(),
                    saved.getOrganizerId(),
                    saved.getOrganizerEmail(),
                    request.venueBooking(),
                    saved.getStartTime(),
                    saved.getEndTime()
            );
            saved.setVenueBookingId(bookingResult.bookingId());
            notifyVenuePaymentPending(saved, bookingResult);
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

    public EventBookingOwnerResponse getBookingOwner(UUID eventId) {
        Event event = findEvent(eventId);
        return new EventBookingOwnerResponse(
                event.getId(),
                event.getTitle(),
                event.getStatus().name(),
                event.getOrganizerId() == null ? null : event.getOrganizerId().toString(),
                event.getOrganizerEmail()
        );
    }

    @Transactional
    public EventDetailResponse updateEvent(UUID eventId, UpdateEventRequest request, AuthenticatedUser actor, String authorization) {
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
            if (!actor.hasRole("ADMIN") && event.getStatus() == EventStatus.PENDING_APPROVAL) {
                event.setProposedBudget(request.estimatedBudget());
            } else {
                event.setApprovedBudget(request.estimatedBudget());
            }
        }
        if (request.recurrenceRule() != null) {
            event.setRecurrenceRule(request.recurrenceRule());
        }
        if (request.tags() != null) {
            event.setTags(normalizeTags(request.tags()));
        }
        if (request.venueBooking() != null) {
            boolean sameVenue = Objects.equals(event.getVenueId(), request.venueBooking().venueId())
                    && Objects.equals(event.getVenueName(), request.venueBooking().venueName())
                    && Objects.equals(event.getVenueCity(), request.venueBooking().venueCity());
            if (StringUtils.hasText(event.getVenueBookingId()) && !sameVenue) {
                throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409",
                        "Cancel the current venue booking before assigning a different venue");
            }
            event.setVenueId(request.venueBooking().venueId());
            event.setVenueName(request.venueBooking().venueName());
            event.setVenueCity(request.venueBooking().venueCity());

            if (!StringUtils.hasText(event.getVenueBookingId()) && event.getStatus() != EventStatus.PENDING_APPROVAL) {
                venueVendorClient.ensureVenueAvailability(authorization, actor, request.venueBooking(), start, end);
                VenueVendorClient.BookingResult bookingResult = venueVendorClient.createBooking(
                        authorization,
                        actor,
                        event.getId().toString(),
                        event.getOrganizerId(),
                        event.getOrganizerEmail(),
                        request.venueBooking(),
                        start,
                        end
                );
                event.setVenueBookingId(bookingResult.bookingId());
                notifyVenuePaymentPending(event, bookingResult);
            }
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
        if (event.getStatus() == EventStatus.PENDING_APPROVAL) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409",
                    "Pending approval requests must be reviewed before lifecycle changes are allowed");
        }
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
    public EventDetailResponse disableEvent(UUID eventId, AuthenticatedUser actor, String authorization) {
        Event event = findEvent(eventId);
        ensureWritable(event, actor);
        if (event.getStatus().isDisabled()) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Event is already disabled");
        }
        event.setPreviousStatus(event.getStatus());
        boolean byAdmin = actor.hasRole("ADMIN");
        event.setStatus(byAdmin ? EventStatus.DISABLED_BY_ADMIN : EventStatus.DISABLED_BY_VENDOR);
        Event saved = eventRepository.save(event);

        var customers = uniqueRecipients(ticketingClient.getAttendees(eventId, actor, authorization));
        if (byAdmin) {
            notifyAdminDisabledEvent(saved, actor.email(), customers);
        } else {
            notifyVendorDisabledEvent(saved, actor.email(), customers);
        }
        return mapper.toDetail(saved);
    }

    @Transactional
    public EventDetailResponse enableEvent(UUID eventId, AuthenticatedUser actor, String authorization) {
        Event event = findEvent(eventId);
        if (!event.getStatus().isDisabled()) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Event is not currently disabled");
        }
        // Vendors can only re-enable events disabled by themselves
        if (!actor.hasRole("ADMIN") && event.getStatus() == EventStatus.DISABLED_BY_ADMIN) {
            throw new EventServiceException(HttpStatus.FORBIDDEN, "AUTH-403",
                    "This event was disabled by an admin. You must submit a re-enable request.");
        }
        // Vendor must own the event
        if (!actor.hasRole("ADMIN") && !event.getOrganizerId().equals(actor.id())) {
            throw new EventServiceException(HttpStatus.FORBIDDEN, "AUTH-403",
                    "Only the owning organizer or an admin can re-enable this event");
        }
        EventStatus restore = event.getPreviousStatus() != null ? event.getPreviousStatus() : EventStatus.DRAFT;
        event.setStatus(restore);
        event.setPreviousStatus(null);
        Event saved = eventRepository.save(event);

        if (actor.hasRole("ADMIN")) {
            notifyAdminEnabledEvent(saved, actor.email(), uniqueRecipients(ticketingClient.getAttendees(eventId, actor, authorization)));
        }
        return mapper.toDetail(saved);
    }

    @Transactional
    public EventEnableRequestResponse requestEnableEvent(UUID eventId, AuthenticatedUser actor, String vendorNote) {
        Event event = findEvent(eventId);
        if (!event.getOrganizerId().equals(actor.id())) {
            throw new EventServiceException(HttpStatus.FORBIDDEN, "AUTH-403",
                    "Only the owning organizer can request re-enable");
        }
        if (event.getStatus() != EventStatus.DISABLED_BY_ADMIN) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409",
                    "Re-enable requests are only applicable for admin-disabled events");
        }
        if (enableRequestRepository.existsByEventIdAndVendorIdAndStatus(eventId, actor.id(), EventEnableRequestStatus.PENDING)) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409",
                    "A pending re-enable request already exists for this event");
        }
        EventEnableRequest req = new EventEnableRequest();
        req.setId(UUID.randomUUID());
        req.setEventId(eventId);
        req.setEventTitle(event.getTitle());
        req.setVendorId(actor.id());
        req.setVendorEmail(actor.email());
        req.setRequestedAt(java.time.OffsetDateTime.now());
        req.setStatus(EventEnableRequestStatus.PENDING);
        if (vendorNote != null && !vendorNote.isBlank()) {
            req.setVendorNote(vendorNote.strip());
        }
        EventEnableRequest saved = enableRequestRepository.save(req);
        return toEnableRequestResponse(saved);
    }

    public List<EventEnableRequestResponse> listPendingEnableRequests() {
        return enableRequestRepository.findByStatusOrderByRequestedAtDesc(EventEnableRequestStatus.PENDING)
                .stream().map(this::toEnableRequestResponse).toList();
    }

    @Transactional
    public EventDetailResponse approveEnableRequest(UUID requestId, AuthenticatedUser actor,
                                                    String authorization, String adminNote) {
        EventEnableRequest req = findEnableRequest(requestId);
        if (req.getStatus() != EventEnableRequestStatus.PENDING) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Request is no longer pending");
        }
        req.setStatus(EventEnableRequestStatus.APPROVED);
        if (adminNote != null && !adminNote.isBlank()) {
            req.setAdminNote(adminNote.strip());
        }
        enableRequestRepository.save(req);
        Event event = findEvent(req.getEventId());
        EventStatus restore = event.getPreviousStatus() != null ? event.getPreviousStatus() : EventStatus.DRAFT;
        event.setStatus(restore);
        event.setPreviousStatus(null);
        Event saved = eventRepository.save(event);

        notifyAdminEnabledEvent(saved, actor.email(), uniqueRecipients(ticketingClient.getAttendees(req.getEventId(), actor, authorization)));
        return mapper.toDetail(saved);
    }

    @Transactional
    public void rejectEnableRequest(UUID requestId, AuthenticatedUser actor, String adminNote) {
        EventEnableRequest req = findEnableRequest(requestId);
        if (req.getStatus() != EventEnableRequestStatus.PENDING) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Request is no longer pending");
        }
        req.setStatus(EventEnableRequestStatus.REJECTED);
        if (adminNote != null && !adminNote.isBlank()) {
            req.setAdminNote(adminNote.strip());
        }
        enableRequestRepository.save(req);

        // Notify the vendor that the request was rejected
        String noteClause = (req.getAdminNote() != null) ? " Admin note: " + req.getAdminNote() : "";
        notificationClient.sendNotification(
                "event.updated",
                List.of(new NotificationClient.Recipient(req.getVendorId().toString(), req.getVendorEmail())),
                "Your re-enable request for \"" + req.getEventTitle() + "\" has been rejected",
                "Your request to re-enable \"" + req.getEventTitle() + "\" has been reviewed and rejected by the admin. "
                        + "Please contact the admin for further details." + noteClause,
                Map.of("eventId", req.getEventId().toString(), "eventName", req.getEventTitle(), "requestId", requestId.toString()));
    }

    @Transactional
    public EventDetailResponse approveEventRequest(UUID eventId, AuthenticatedUser actor, String authorization, BigDecimal approvedBudget, String adminNote) {
        Event event = findEvent(eventId);
        if (event.getStatus() != EventStatus.PENDING_APPROVAL) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Only pending event requests can be approved");
        }
        BigDecimal finalBudget = approvedBudget != null ? approvedBudget : event.getProposedBudget();
        if (finalBudget == null) {
            throw new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", "Approved budget is required");
        }
        event.setApprovedBudget(finalBudget);
        event.setEstimatedBudget(finalBudget);
        event.setApprovalStatus(EventApprovalStatus.APPROVED);
        event.setApprovalNote(StringUtils.hasText(adminNote) ? adminNote.strip() : null);
        event.setStatus(EventStatus.DRAFT);
        if (StringUtils.hasText(event.getVenueId()) && !StringUtils.hasText(event.getVenueBookingId())) {
            VenueBookingRequest venueBooking = new VenueBookingRequest(event.getVenueId(), event.getVenueName(), event.getVenueCity(), List.of());
            venueVendorClient.ensureVenueAvailability(authorization, actor, venueBooking, event.getStartTime(), event.getEndTime());
            VenueVendorClient.BookingResult bookingResult = venueVendorClient.createBooking(
                    authorization,
                    actor,
                    event.getId().toString(),
                    event.getOrganizerId(),
                    event.getOrganizerEmail(),
                    venueBooking,
                    event.getStartTime(),
                    event.getEndTime()
            );
            event.setVenueBookingId(bookingResult.bookingId());
            notifyVenuePaymentPending(event, bookingResult);
        }
        Event saved = eventRepository.save(event);

        notifyEventRequestReviewed(
                saved,
                "event.updated",
                "Your event request for \"" + saved.getTitle() + "\" has been approved",
                "Your event request for \"" + saved.getTitle() + "\" has been approved by the EventZen admin team. "
                        + "The approved budget is " + finalBudget + ". "
                        + (StringUtils.hasText(saved.getApprovalNote()) ? "Admin note: " + saved.getApprovalNote() : "You can continue managing the event in Event Operations."),
                Map.of(
                        "eventId", saved.getId().toString(),
                        "eventName", saved.getTitle(),
                        "approvalStatus", saved.getApprovalStatus().name(),
                        "approvedBudget", finalBudget.toPlainString()));
        return mapper.toDetail(saved);
    }

    @Transactional
    public EventDetailResponse requestEventRevision(UUID eventId, AuthenticatedUser actor, String adminNote) {
        Event event = findEvent(eventId);
        if (event.getStatus() != EventStatus.PENDING_APPROVAL) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Only pending event requests can be reviewed");
        }
        if (!StringUtils.hasText(adminNote)) {
            throw new EventServiceException(HttpStatus.BAD_REQUEST, "EVENT-400", "Revision note is required");
        }
        event.setApprovalStatus(EventApprovalStatus.CHANGES_REQUESTED);
        event.setApprovalNote(adminNote.strip());
        Event saved = eventRepository.save(event);

        notifyEventRequestReviewed(
                saved,
                "event.updated",
                "Changes were requested for \"" + saved.getTitle() + "\"",
                "Your event request for \"" + saved.getTitle() + "\" needs changes before it can be approved. "
                        + "Admin note: " + saved.getApprovalNote(),
                Map.of(
                        "eventId", saved.getId().toString(),
                        "eventName", saved.getTitle(),
                        "approvalStatus", saved.getApprovalStatus().name()));
        return mapper.toDetail(saved);
    }

    @Transactional
    public EventDetailResponse rejectEventRequest(UUID eventId, AuthenticatedUser actor, String adminNote) {
        Event event = findEvent(eventId);
        if (event.getStatus() != EventStatus.PENDING_APPROVAL) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Only pending event requests can be rejected");
        }
        event.setApprovalStatus(EventApprovalStatus.REJECTED);
        event.setApprovalNote(StringUtils.hasText(adminNote) ? adminNote.strip() : null);
        Event saved = eventRepository.save(event);

        String message = "Your event request for \"" + saved.getTitle() + "\" has been rejected by the EventZen admin team."
                + (StringUtils.hasText(saved.getApprovalNote()) ? " Admin note: " + saved.getApprovalNote() : "");
        notifyEventRequestReviewed(
                saved,
                "event.cancelled",
                "Your event request for \"" + saved.getTitle() + "\" has been rejected",
                message,
                Map.of(
                        "eventId", saved.getId().toString(),
                        "eventName", saved.getTitle(),
                        "approvalStatus", saved.getApprovalStatus().name()));
        return mapper.toDetail(saved);
    }

    @Transactional
    public EventDetailResponse resubmitEventRequest(UUID eventId, AuthenticatedUser actor) {
        Event event = findEvent(eventId);
        ensureWritable(event, actor);
        if (event.getStatus() != EventStatus.PENDING_APPROVAL) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Only pending event requests can be resubmitted");
        }
        if (event.getApprovalStatus() != EventApprovalStatus.CHANGES_REQUESTED) {
            throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "This event request is not waiting for revision");
        }
        event.setApprovalStatus(EventApprovalStatus.PENDING);
        event.setApprovalNote(null);
        return mapper.toDetail(eventRepository.save(event));
    }

    @Transactional
    public void handleVenueBookingCancelled(String venueBookingId, String reason) {
        if (!StringUtils.hasText(venueBookingId)) {
            return;
        }

        Event event = eventRepository.findByVenueBookingId(venueBookingId).orElse(null);
        if (event == null) {
            return;
        }

        event.setVenueBookingId(null);
        event.setVenueId(null);
        event.setVenueName(null);
        event.setVenueCity(null);

        String note = "Venue booking was cancelled. Reassign a venue before publishing or reopening this event."
                + (StringUtils.hasText(reason) ? " Cancellation reason: " + reason.trim() : "");

        if (event.getStatus() == EventStatus.PENDING_APPROVAL) {
            event.setApprovalStatus(EventApprovalStatus.CHANGES_REQUESTED);
            event.setApprovalNote(note);
        } else if (event.getStatus().isDisabled()) {
            event.setPreviousStatus(EventStatus.DRAFT);
            event.setApprovalStatus(EventApprovalStatus.CHANGES_REQUESTED);
            event.setApprovalNote(note);
        } else if (event.getStatus() != EventStatus.COMPLETED && event.getStatus() != EventStatus.ARCHIVED) {
            event.setStatus(EventStatus.DRAFT);
            event.setPreviousStatus(null);
            event.setApprovalStatus(EventApprovalStatus.CHANGES_REQUESTED);
            event.setApprovalNote(note);
        }

        Event saved = eventRepository.save(event);
        notificationClient.sendNotification(
                "event.updated",
                List.of(new NotificationClient.Recipient(saved.getOrganizerId().toString(), saved.getOrganizerEmail())),
                "Venue booking cancelled for \"" + saved.getTitle() + "\"",
                "The linked venue booking has been cancelled. Please reassign and confirm a venue before publishing or reopening the event.",
                Map.of(
                        "eventId", saved.getId().toString(),
                        "eventName", saved.getTitle(),
                        "venueBookingId", venueBookingId,
                        "eventStatus", saved.getStatus().name(),
                        "approvalStatus", saved.getApprovalStatus().name(),
                        "action", "venue_booking_cancelled",
                        "reason", StringUtils.hasText(reason) ? reason.trim() : ""));
    }

    private EventEnableRequest findEnableRequest(UUID requestId) {
        return enableRequestRepository.findById(requestId)
                .orElseThrow(() -> new EventServiceException(HttpStatus.NOT_FOUND, "EVENT-404", "Enable request not found"));
    }

    private EventEnableRequestResponse toEnableRequestResponse(EventEnableRequest req) {
        return new EventEnableRequestResponse(req.getId(), req.getEventId(), req.getEventTitle(),
                req.getVendorId(), req.getVendorEmail(), req.getRequestedAt(), req.getStatus(),
                req.getVendorNote(), req.getAdminNote());
    }

    private void notifyAdminDisabledEvent(Event event, String adminEmail, List<NotificationClient.Recipient> customers) {
        notificationClient.sendNotification(
                "event.cancelled",
                List.of(new NotificationClient.Recipient(event.getOrganizerId().toString(), event.getOrganizerEmail())),
                "Your event \"" + event.getTitle() + "\" has been disabled by an admin",
                "Your event has been disabled by the EventZen admin team. "
                        + "Please send a request to your admin for enabling the event again. "
                        + "For further queries, contact the admin at: " + adminEmail + ".",
                Map.of(
                        "eventId", event.getId().toString(),
                        "eventName", event.getTitle(),
                        "adminEmail", adminEmail,
                        "action", "disabled_by_admin"));

        if (!customers.isEmpty()) {
            notificationClient.sendNotification(
                    "event.cancelled",
                    customers,
                    "\"" + event.getTitle() + "\" has been disabled by the admin",
                    "The event \"" + event.getTitle() + "\" has been disabled by the EventZen admin team. "
                            + "For further information or support, please contact the admin at: " + adminEmail + ".",
                    Map.of(
                            "eventId", event.getId().toString(),
                            "eventName", event.getTitle(),
                            "adminEmail", adminEmail,
                            "action", "disabled_by_admin"));
        }
    }

    private void notifyVendorDisabledEvent(Event event, String vendorEmail, List<NotificationClient.Recipient> customers) {
        if (customers.isEmpty()) {
            return;
        }

        notificationClient.sendNotification(
                "event.cancelled",
                customers,
                "\"" + event.getTitle() + "\" has been disabled by the organizer",
                "The event \"" + event.getTitle() + "\" has been disabled by the organizer. "
                        + "For further information or support, please contact the organizer at: " + vendorEmail + ".",
                Map.of(
                        "eventId", event.getId().toString(),
                        "eventName", event.getTitle(),
                        "vendorEmail", vendorEmail,
                        "action", "disabled_by_vendor"));
    }

    private void notifyAdminEnabledEvent(Event event, String adminEmail, List<NotificationClient.Recipient> customers) {
        notificationClient.sendNotification(
                "event.updated",
                List.of(new NotificationClient.Recipient(event.getOrganizerId().toString(), event.getOrganizerEmail())),
                "Your event \"" + event.getTitle() + "\" has been re-enabled by an admin",
                "Your event \"" + event.getTitle() + "\" has been re-enabled by the EventZen admin team. "
                        + "Attendees can view and book tickets again.",
                Map.of(
                        "eventId", event.getId().toString(),
                        "eventName", event.getTitle(),
                        "adminEmail", adminEmail,
                        "action", "enabled_by_admin"));

        if (!customers.isEmpty()) {
            notificationClient.sendNotification(
                    "event.updated",
                    customers,
                    "\"" + event.getTitle() + "\" is back on",
                    "The event \"" + event.getTitle() + "\" has been re-enabled by the EventZen admin team. "
                            + "For further information, please contact the admin at: " + adminEmail + ".",
                    Map.of(
                            "eventId", event.getId().toString(),
                            "eventName", event.getTitle(),
                            "adminEmail", adminEmail,
                            "action", "enabled_by_admin"));
        }
    }

    private void notifyEventRequestReviewed(Event event, String eventType, String title, String body, Map<String, Object> metadata) {
        notificationClient.sendNotification(
                eventType,
                List.of(new NotificationClient.Recipient(event.getOrganizerId().toString(), event.getOrganizerEmail())),
                title,
                body,
                metadata);
    }

    private void notifyVenuePaymentPending(Event event, VenueVendorClient.BookingResult bookingResult) {
        if (event == null || bookingResult == null || !bookingResult.isPaymentPending() || event.getOrganizerId() == null) {
            return;
        }

        String amountText = bookingResult.paymentAmount() == null
                ? "the pending venue amount"
                : bookingResult.paymentAmount().toPlainString() + " " + (StringUtils.hasText(bookingResult.paymentCurrency()) ? bookingResult.paymentCurrency() : "INR");

        notificationClient.sendNotification(
                "event.updated",
                List.of(new NotificationClient.Recipient(event.getOrganizerId().toString(), event.getOrganizerEmail())),
                "Venue payment pending for \"" + event.getTitle() + "\"",
                "A venue booking has been created for \"" + event.getTitle() + "\", but payment is still pending. "
                        + "Please complete the venue payment to confirm the reservation. Amount due: " + amountText + ".",
                Map.of(
                        "eventId", event.getId().toString(),
                        "eventName", event.getTitle(),
                        "venueBookingId", bookingResult.bookingId(),
                        "paymentStatus", bookingResult.paymentStatus() == null ? "PENDING" : bookingResult.paymentStatus(),
                        "paymentAmount", bookingResult.paymentAmount() == null ? "" : bookingResult.paymentAmount().toPlainString(),
                        "paymentCurrency", StringUtils.hasText(bookingResult.paymentCurrency()) ? bookingResult.paymentCurrency() : "INR",
                        "action", "venue_payment_pending"));
    }

    private List<NotificationClient.Recipient> uniqueRecipients(List<NotificationClient.Recipient> recipients) {
        if (recipients == null || recipients.isEmpty()) {
            return List.of();
        }

        var unique = new LinkedHashMap<String, NotificationClient.Recipient>();
        for (NotificationClient.Recipient recipient : recipients) {
            if (recipient == null || !StringUtils.hasText(recipient.userId())) {
                continue;
            }
            unique.putIfAbsent(recipient.userId(), recipient);
        }
        return List.copyOf(unique.values());
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

    public record EventBookingOwnerResponse(UUID eventId, String title, String status, String organizerId, String organizerEmail) {
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
