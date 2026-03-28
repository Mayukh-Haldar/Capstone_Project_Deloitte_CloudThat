package com.eventzen.event.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.eventzen.event.dto.CreateEventRequest;
import com.eventzen.event.dto.CreateSessionRequest;
import com.eventzen.event.dto.TransitionEventStatusRequest;
import com.eventzen.event.dto.UpdateEventRequest;
import com.eventzen.event.dto.VenueBookingRequest;
import com.eventzen.event.exception.EventServiceException;
import com.eventzen.event.model.Event;
import com.eventzen.event.model.EventApprovalStatus;
import com.eventzen.event.model.EventCategory;
import com.eventzen.event.model.EventSession;
import com.eventzen.event.model.EventStatus;
import com.eventzen.event.model.RecurrenceRule;
import com.eventzen.event.repository.EventAgendaItemRepository;
import com.eventzen.event.repository.EventCategoryRepository;
import com.eventzen.event.repository.EventEnableRequestRepository;
import com.eventzen.event.repository.EventRepository;
import com.eventzen.event.repository.EventSessionRepository;
import com.eventzen.event.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

@ExtendWith(MockitoExtension.class)
class EventServiceTest {

    @Mock
    private EventRepository eventRepository;
    @Mock
    private EventCategoryRepository categoryRepository;
    @Mock
    private EventSessionRepository sessionRepository;
    @Mock
    private EventAgendaItemRepository agendaRepository;
    @Mock
    private EventEnableRequestRepository enableRequestRepository;
    @Mock
    private EventMapper mapper;
    @Mock
    private VenueVendorClient venueVendorClient;
    @Mock
    private NotificationClient notificationClient;
    @Mock
    private TicketingClient ticketingClient;

    @InjectMocks
    private EventService eventService;

    private EventCategory category;
    private AuthenticatedUser organizer;
    private AuthenticatedUser otherOrganizer;
    private AuthenticatedUser admin;

    @BeforeEach
    void setUp() {
        category = new EventCategory();
        category.setId(UUID.randomUUID());
        category.setName("TECH");
        organizer = new AuthenticatedUser(
                UUID.randomUUID(),
                "organizer@eventzen.local",
                Set.of("ORGANIZER"),
                List.of(new SimpleGrantedAuthority("ROLE_ORGANIZER"))
        );
        otherOrganizer = new AuthenticatedUser(
                UUID.randomUUID(),
                "other-organizer@eventzen.local",
                Set.of("ORGANIZER"),
                List.of(new SimpleGrantedAuthority("ROLE_ORGANIZER"))
        );
        admin = new AuthenticatedUser(
                UUID.randomUUID(),
                "admin@eventzen.local",
                Set.of("ADMIN"),
                List.of(new SimpleGrantedAuthority("ROLE_ADMIN"))
        );
    }

    @Test
    void createEventRejectsExpectedAttendeesAboveCapacity() {
        CreateEventRequest request = new CreateEventRequest(
                null,
                category.getId(),
                "AI Summit",
                "CONFERENCE",
                "desc",
                null,
                OffsetDateTime.now().plusDays(3),
                OffsetDateTime.now().plusDays(3).plusHours(5),
                300,
                200,
                BigDecimal.valueOf(1000),
                RecurrenceRule.NONE,
                List.of("ai"),
                null,
                List.of()
        );

        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));

        assertThatThrownBy(() -> eventService.createEvent(request, organizer, "Bearer token"))
                .isInstanceOf(EventServiceException.class)
                .hasMessageContaining("Expected attendees cannot exceed capacity");

        verify(eventRepository, never()).save(any());
    }

    @Test
    void adminCreateEventCallsVenueBookingClientWhenVenueProvided() {
        CreateEventRequest request = new CreateEventRequest(
                organizer.id(),
                category.getId(),
                "AI Summit",
                "CONFERENCE",
                "desc",
                null,
                OffsetDateTime.now().plusDays(3),
                OffsetDateTime.now().plusDays(3).plusHours(5),
                300,
                350,
                BigDecimal.valueOf(1000),
                RecurrenceRule.NONE,
                List.of("ai"),
                new VenueBookingRequest("venue-1", "Moscone", "San Francisco", List.of()),
                List.of()
        );

        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);
        when(venueVendorClient.createBooking(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new VenueVendorClient.BookingResult("booking-1", "PAID", BigDecimal.ZERO, "INR"));

        eventService.createEvent(request, admin, "Bearer token");

        verify(venueVendorClient).ensureVenueAvailability(any(), any(), any(), any(), any());
        verify(venueVendorClient).createBooking(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void organizerCreateEventDefersVenueBookingUntilApproval() {
        CreateEventRequest request = new CreateEventRequest(
                null,
                category.getId(),
                "AI Summit",
                "CONFERENCE",
                "desc",
                null,
                OffsetDateTime.now().plusDays(3),
                OffsetDateTime.now().plusDays(3).plusHours(5),
                300,
                350,
                BigDecimal.valueOf(1000),
                RecurrenceRule.NONE,
                List.of("ai"),
                new VenueBookingRequest("venue-1", "Moscone", "San Francisco", List.of()),
                List.of()
        );

        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.createEvent(request, organizer, "Bearer token");

        verify(venueVendorClient, never()).ensureVenueAvailability(any(), any(), any(), any(), any());
        verify(venueVendorClient, never()).createBooking(any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    void organizerCreatedEventsStartPendingApproval() {
        CreateEventRequest request = new CreateEventRequest(
                null,
                category.getId(),
                "AI Summit",
                "CONFERENCE",
                "desc",
                null,
                OffsetDateTime.now().plusDays(3),
                OffsetDateTime.now().plusDays(3).plusHours(5),
                300,
                350,
                BigDecimal.valueOf(1000),
                RecurrenceRule.NONE,
                List.of("ai"),
                null,
                List.of()
        );

        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.createEvent(request, organizer, "Bearer token");

        verify(eventRepository, atLeastOnce()).save(argThat(saved ->
                saved.getStatus() == EventStatus.PENDING_APPROVAL
                        && saved.getApprovalStatus() == EventApprovalStatus.PENDING
                        && BigDecimal.valueOf(1000).compareTo(saved.getProposedBudget()) == 0
                        && saved.getApprovedBudget() == null));
    }

    @Test
    void adminCreatedEventsStartApprovedDraft() {
        CreateEventRequest request = new CreateEventRequest(
                organizer.id(),
                category.getId(),
                "AI Summit",
                "CONFERENCE",
                "desc",
                null,
                OffsetDateTime.now().plusDays(3),
                OffsetDateTime.now().plusDays(3).plusHours(5),
                300,
                350,
                BigDecimal.valueOf(1000),
                RecurrenceRule.NONE,
                List.of("ai"),
                null,
                List.of()
        );

        when(categoryRepository.findById(category.getId())).thenReturn(Optional.of(category));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.createEvent(request, admin, "Bearer token");

        verify(eventRepository, atLeastOnce()).save(argThat(saved ->
                saved.getStatus() == EventStatus.DRAFT
                        && saved.getApprovalStatus() == EventApprovalStatus.APPROVED
                        && BigDecimal.valueOf(1000).compareTo(saved.getApprovedBudget()) == 0));
    }

    @Test
    void updatingDraftEventWithReassignedVenueCreatesBookingAndNotifiesPaymentPending() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.DRAFT);
        event.setApprovalStatus(EventApprovalStatus.CHANGES_REQUESTED);
        event.setVenueBookingId(null);
        event.setVenueId(null);
        event.setVenueName(null);
        event.setVenueCity(null);

        UpdateEventRequest request = new UpdateEventRequest(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new VenueBookingRequest("venue-9", "Lotus Knowledge Arena", "Hyderabad", List.of()),
                null
        );

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);
        when(venueVendorClient.createBooking(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new VenueVendorClient.BookingResult("booking-99", "PENDING", BigDecimal.valueOf(112000), "INR"));

        eventService.updateEvent(eventId, request, organizer, "Bearer token");

        verify(venueVendorClient).ensureVenueAvailability(any(), any(), any(), any(), any());
        verify(venueVendorClient).createBooking(any(), any(), any(), any(), any(), any(), any(), any());
        verify(eventRepository).save(argThat(saved ->
                "booking-99".equals(saved.getVenueBookingId())
                        && "venue-9".equals(saved.getVenueId())
                        && "Lotus Knowledge Arena".equals(saved.getVenueName())));
        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.updated"),
                argThat(recipients -> recipients.size() == 1 && organizer.id().toString().equals(recipients.get(0).userId())),
                argThat(title -> title.contains("Venue payment pending")),
                argThat(body -> body.contains("112000") && body.contains("payment")),
                argThat(metadata -> "venue_payment_pending".equals(metadata.get("action")) && "booking-99".equals(metadata.get("venueBookingId"))));
    }

    @Test
    void updatingPendingApprovalEventWithVenueDoesNotCreateBookingUntilApproval() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.PENDING_APPROVAL);
        event.setApprovalStatus(EventApprovalStatus.CHANGES_REQUESTED);
        event.setVenueBookingId(null);
        event.setVenueId(null);
        event.setVenueName(null);
        event.setVenueCity(null);

        UpdateEventRequest request = new UpdateEventRequest(
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                new VenueBookingRequest("venue-9", "Lotus Knowledge Arena", "Hyderabad", List.of()),
                null
        );

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.updateEvent(eventId, request, organizer, "Bearer token");

        verify(venueVendorClient, never()).ensureVenueAvailability(any(), any(), any(), any(), any());
        verify(venueVendorClient, never()).createBooking(any(), any(), any(), any(), any(), any(), any(), any());
        verify(eventRepository).save(argThat(saved ->
                saved.getVenueBookingId() == null
                        && "venue-9".equals(saved.getVenueId())
                        && "Lotus Knowledge Arena".equals(saved.getVenueName())));
    }

    @Test
    void addSessionRejectsOverlappingSessions() {
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setOrganizerId(organizer.id());
        event.setCategory(category);
        event.setTitle("AI Summit");
        event.setEventType("CONFERENCE");
        event.setDescription("desc");
        event.setStartTime(OffsetDateTime.now().plusDays(2));
        event.setEndTime(OffsetDateTime.now().plusDays(2).plusHours(8));
        event.setExpectedAttendees(100);
        event.setCapacity(120);
        event.setEstimatedBudget(BigDecimal.TEN);
        event.setStatus(EventStatus.DRAFT);
        event.setRecurrenceRule(RecurrenceRule.NONE);
        event.setSessions(new ArrayList<>());
        event.setAgendaItems(new ArrayList<>());

        EventSession existing = new EventSession();
        existing.setId(UUID.randomUUID());
        existing.setEvent(event);
        existing.setStartTime(event.getStartTime().plusHours(1));
        existing.setEndTime(event.getStartTime().plusHours(3));

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(sessionRepository.findByEventIdOrderByStartTimeAsc(eventId)).thenReturn(List.of(existing));

        CreateSessionRequest request = new CreateSessionRequest(
                "Keynote",
                "Jane",
                null,
                null,
                null,
                null,
                null,
                "Hall A",
                "KEYNOTE",
                event.getStartTime().plusHours(2),
                event.getStartTime().plusHours(4),
                50,
                null
        );

        assertThatThrownBy(() -> eventService.addSession(eventId, request, organizer))
                .isInstanceOf(EventServiceException.class)
                .hasMessageContaining("overlaps");
    }

    @Test
    void transitionStatusAllowsClosingRegistrationsBackToPublished() {
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setOrganizerId(organizer.id());
        event.setStatus(EventStatus.REGISTRATION_OPEN);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.transitionStatus(eventId, new TransitionEventStatusRequest(EventStatus.PUBLISHED), organizer);

        verify(eventRepository).save(argThat(saved -> saved.getStatus() == EventStatus.PUBLISHED));
    }

    @Test
    void transitionStatusAllowsClosingRegistrationsToDedicatedClosedState() {
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setOrganizerId(organizer.id());
        event.setStatus(EventStatus.REGISTRATION_OPEN);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.transitionStatus(eventId, new TransitionEventStatusRequest(EventStatus.REGISTRATION_CLOSED), organizer);

        verify(eventRepository).save(argThat(saved -> saved.getStatus() == EventStatus.REGISTRATION_CLOSED));
    }

    @Test
    void transitionStatusAllowsReopeningClosedRegistrations() {
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setOrganizerId(organizer.id());
        event.setStatus(EventStatus.REGISTRATION_CLOSED);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.transitionStatus(eventId, new TransitionEventStatusRequest(EventStatus.REGISTRATION_OPEN), organizer);

        verify(eventRepository).save(argThat(saved -> saved.getStatus() == EventStatus.REGISTRATION_OPEN));
    }

    @Test
    void transitionStatusAllowsMovingPublishedEventBackToDraft() {
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setOrganizerId(organizer.id());
        event.setStatus(EventStatus.PUBLISHED);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.transitionStatus(eventId, new TransitionEventStatusRequest(EventStatus.DRAFT), organizer);

        verify(eventRepository).save(argThat(saved -> saved.getStatus() == EventStatus.DRAFT));
    }

    @Test
    void transitionStatusAllowsMovingArchivedEventBackToDraft() {
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setOrganizerId(organizer.id());
        event.setStatus(EventStatus.ARCHIVED);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.transitionStatus(eventId, new TransitionEventStatusRequest(EventStatus.DRAFT), organizer);

        verify(eventRepository).save(argThat(saved -> saved.getStatus() == EventStatus.DRAFT));
    }

    @Test
    void transitionStatusAllowsMovingCompletedEventBackToRegistrationOpen() {
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setOrganizerId(organizer.id());
        event.setStatus(EventStatus.COMPLETED);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.transitionStatus(eventId, new TransitionEventStatusRequest(EventStatus.REGISTRATION_OPEN), organizer);

        verify(eventRepository).save(argThat(saved -> saved.getStatus() == EventStatus.REGISTRATION_OPEN));
    }

    @Test
    void transitionStatusRejectsNonOwningOrganizer() {
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setOrganizerId(organizer.id());
        event.setStatus(EventStatus.DRAFT);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));

        assertThatThrownBy(() -> eventService.transitionStatus(
                eventId,
                new TransitionEventStatusRequest(EventStatus.PUBLISHED),
                otherOrganizer
        ))
                .isInstanceOf(EventServiceException.class)
                .hasMessageContaining("Only the owning organizer or an admin can modify this event");

        verify(eventRepository, never()).save(any());
    }

    @Test
    void transitionStatusAllowsAdminToManageAnotherOrganizersEvent() {
        UUID eventId = UUID.randomUUID();
        Event event = new Event();
        event.setId(eventId);
        event.setOrganizerId(organizer.id());
        event.setStatus(EventStatus.DRAFT);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.transitionStatus(eventId, new TransitionEventStatusRequest(EventStatus.PUBLISHED), admin);

        verify(eventRepository).save(argThat(saved -> saved.getStatus() == EventStatus.PUBLISHED));
    }

    @Test
    void adminDisableNotifiesVendorAndTicketHoldersWithAdminEmail() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.PUBLISHED);
        var buyers = List.of(
                new NotificationClient.Recipient("buyer-1", "buyer1@eventzen.local"),
                new NotificationClient.Recipient("buyer-2", "buyer2@eventzen.local")
        );

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ticketingClient.getAttendees(eventId, admin, "Bearer admin-token")).thenReturn(buyers);
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.disableEvent(eventId, admin, "Bearer admin-token");

        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.cancelled"),
                argThat(recipients -> recipients.size() == 1
                        && organizer.id().toString().equals(recipients.get(0).userId())
                        && organizer.email().equals(recipients.get(0).email())),
                argThat(title -> title.contains("disabled by an admin")),
                argThat(body -> body.contains(admin.email()) && body.contains("send a request to your admin")),
                argThat(metadata -> admin.email().equals(metadata.get("adminEmail")) && "disabled_by_admin".equals(metadata.get("action"))));

        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.cancelled"),
                argThat(recipients -> recipients.size() == 2
                        && recipients.stream().anyMatch(r -> "buyer-1".equals(r.userId()))
                        && recipients.stream().anyMatch(r -> "buyer-2".equals(r.userId()))),
                argThat(title -> title.contains("disabled by the admin")),
                argThat(body -> body.contains(admin.email())),
                argThat(metadata -> admin.email().equals(metadata.get("adminEmail")) && "disabled_by_admin".equals(metadata.get("action"))));
    }

    @Test
    void vendorDisableNotifiesOnlyTicketHoldersWithVendorEmail() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.PUBLISHED);
        var buyers = List.of(new NotificationClient.Recipient("buyer-1", "buyer1@eventzen.local"));

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ticketingClient.getAttendees(eventId, organizer, "Bearer organizer-token")).thenReturn(buyers);
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.disableEvent(eventId, organizer, "Bearer organizer-token");

        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.cancelled"),
                argThat(recipients -> recipients.size() == 1 && "buyer-1".equals(recipients.get(0).userId())),
                argThat(title -> title.contains("disabled by the organizer")),
                argThat(body -> body.contains(organizer.email())),
                argThat(metadata -> organizer.email().equals(metadata.get("vendorEmail")) && "disabled_by_vendor".equals(metadata.get("action"))));
    }

    @Test
    void adminEnableNotifiesVendorAndTicketHoldersWithAdminEmail() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.DISABLED_BY_ADMIN);
        event.setPreviousStatus(EventStatus.PUBLISHED);
        var buyers = List.of(new NotificationClient.Recipient("buyer-1", "buyer1@eventzen.local"));

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(ticketingClient.getAttendees(eventId, admin, "Bearer admin-token")).thenReturn(buyers);
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.enableEvent(eventId, admin, "Bearer admin-token");

        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.updated"),
                argThat(recipients -> recipients.size() == 1
                        && organizer.id().toString().equals(recipients.get(0).userId())),
                argThat(title -> title.contains("re-enabled by an admin")),
                any(),
                argThat(metadata -> admin.email().equals(metadata.get("adminEmail")) && "enabled_by_admin".equals(metadata.get("action"))));

        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.updated"),
                argThat(recipients -> recipients.size() == 1 && "buyer-1".equals(recipients.get(0).userId())),
                argThat(title -> title.contains("back on")),
                argThat(body -> body.contains(admin.email())),
                argThat(metadata -> admin.email().equals(metadata.get("adminEmail")) && "enabled_by_admin".equals(metadata.get("action"))));
    }

    @Test
    void adminApproveEventRequestAdjustsBudgetAndNotifiesVendor() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.PENDING_APPROVAL);
        event.setApprovalStatus(EventApprovalStatus.PENDING);
        event.setProposedBudget(BigDecimal.valueOf(1000));
        event.setApprovedBudget(null);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.approveEventRequest(eventId, admin, "Bearer token", BigDecimal.valueOf(1500), "Budget updated");

        verify(eventRepository).save(argThat(saved ->
                saved.getStatus() == EventStatus.DRAFT
                        && saved.getApprovalStatus() == EventApprovalStatus.APPROVED
                        && BigDecimal.valueOf(1500).compareTo(saved.getApprovedBudget()) == 0
                        && BigDecimal.valueOf(1500).compareTo(saved.getEstimatedBudget()) == 0));
        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.updated"),
                argThat(recipients -> recipients.size() == 1 && organizer.id().toString().equals(recipients.get(0).userId())),
                argThat(title -> title.contains("has been approved")),
                argThat(body -> body.contains("1500") || body.contains("1.5E+3") || body.contains("Budget updated")),
                argThat(metadata -> "APPROVED".equals(metadata.get("approvalStatus"))));
    }

    @Test
    void approvingPendingEventWithVenueCreatesBooking() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.PENDING_APPROVAL);
        event.setApprovalStatus(EventApprovalStatus.PENDING);
        event.setProposedBudget(BigDecimal.valueOf(1000));
        event.setApprovedBudget(null);
        event.setVenueId("venue-1");
        event.setVenueName("Moscone");
        event.setVenueCity("San Francisco");
        event.setVenueBookingId(null);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);
        when(venueVendorClient.createBooking(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new VenueVendorClient.BookingResult("booking-1", "PAID", BigDecimal.ZERO, "INR"));

        eventService.approveEventRequest(eventId, admin, "Bearer token", BigDecimal.valueOf(1500), "Looks good");

        verify(venueVendorClient).ensureVenueAvailability(any(), any(), any(), any(), any());
        verify(venueVendorClient).createBooking(any(), any(), any(), any(), any(), any(), any(), any());
        verify(eventRepository).save(argThat(saved -> "booking-1".equals(saved.getVenueBookingId())));
    }

    @Test
    void approvingPendingEventWithVenueAndPendingPaymentNotifiesVendor() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.PENDING_APPROVAL);
        event.setApprovalStatus(EventApprovalStatus.PENDING);
        event.setProposedBudget(BigDecimal.valueOf(1000));
        event.setApprovedBudget(null);
        event.setVenueId("venue-1");
        event.setVenueName("Moscone");
        event.setVenueCity("San Francisco");
        event.setVenueBookingId(null);

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);
        when(venueVendorClient.createBooking(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new VenueVendorClient.BookingResult("booking-1", "PENDING", BigDecimal.valueOf(112000), "INR"));

        eventService.approveEventRequest(eventId, admin, "Bearer token", BigDecimal.valueOf(1500), "Looks good");

        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.updated"),
                argThat(recipients -> recipients.size() == 1 && organizer.id().toString().equals(recipients.get(0).userId())),
                argThat(title -> title.contains("Venue payment pending")),
                argThat(body -> body.contains("112000") && body.contains("payment")),
                argThat(metadata -> "venue_payment_pending".equals(metadata.get("action")) && "booking-1".equals(metadata.get("venueBookingId"))));
    }

    @Test
    void adminRequestChangesNotifiesVendor() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.PENDING_APPROVAL);
        event.setApprovalStatus(EventApprovalStatus.PENDING);
        event.setProposedBudget(BigDecimal.valueOf(1000));

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.requestEventRevision(eventId, admin, "Please tighten the budget");

        verify(eventRepository).save(argThat(saved ->
                saved.getApprovalStatus() == EventApprovalStatus.CHANGES_REQUESTED
                        && "Please tighten the budget".equals(saved.getApprovalNote())));
        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.updated"),
                argThat(recipients -> recipients.size() == 1 && organizer.id().toString().equals(recipients.get(0).userId())),
                argThat(title -> title.contains("Changes were requested")),
                argThat(body -> body.contains("Please tighten the budget")),
                argThat(metadata -> "CHANGES_REQUESTED".equals(metadata.get("approvalStatus"))));
    }

    @Test
    void adminRejectEventRequestNotifiesVendor() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.PENDING_APPROVAL);
        event.setApprovalStatus(EventApprovalStatus.PENDING);
        event.setProposedBudget(BigDecimal.valueOf(1000));

        when(eventRepository.findById(eventId)).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(mapper.toDetail(any(Event.class))).thenReturn(null);

        eventService.rejectEventRequest(eventId, admin, "Scope mismatch");

        verify(eventRepository).save(argThat(saved ->
                saved.getApprovalStatus() == EventApprovalStatus.REJECTED
                        && "Scope mismatch".equals(saved.getApprovalNote())));
        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.cancelled"),
                argThat(recipients -> recipients.size() == 1 && organizer.id().toString().equals(recipients.get(0).userId())),
                argThat(title -> title.contains("has been rejected")),
                argThat(body -> body.contains("Scope mismatch")),
                argThat(metadata -> "REJECTED".equals(metadata.get("approvalStatus"))));
    }

    @Test
    void cancellingVenueBookingMovesActiveEventBackToDraftAndNotifiesOrganizer() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.REGISTRATION_OPEN);
        event.setVenueBookingId("booking-1");
        event.setVenueId("venue-1");
        event.setVenueName("Moscone");
        event.setVenueCity("San Francisco");

        when(eventRepository.findByVenueBookingId("booking-1")).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));

        eventService.handleVenueBookingCancelled("booking-1", "Vendor cancelled the booking");

        verify(eventRepository).save(argThat(saved ->
                saved.getStatus() == EventStatus.DRAFT
                        && saved.getApprovalStatus() == EventApprovalStatus.CHANGES_REQUESTED
                        && saved.getVenueBookingId() == null
                        && saved.getVenueId() == null
                        && saved.getVenueName() == null
                        && saved.getVenueCity() == null
                        && saved.getApprovalNote() != null
                        && saved.getApprovalNote().contains("Reassign a venue")));
        verify(notificationClient).sendNotification(
                org.mockito.ArgumentMatchers.eq("event.updated"),
                argThat(recipients -> recipients.size() == 1 && organizer.id().toString().equals(recipients.get(0).userId())),
                argThat(title -> title.contains("Venue booking cancelled")),
                argThat(body -> body.contains("reassign") || body.contains("Reassign")),
                argThat(metadata -> "venue_booking_cancelled".equals(metadata.get("action"))
                        && "DRAFT".equals(metadata.get("eventStatus"))
                        && "CHANGES_REQUESTED".equals(metadata.get("approvalStatus"))));
    }

    @Test
    void cancellingVenueBookingMarksPendingApprovalEventForChangesRequested() {
        UUID eventId = UUID.randomUUID();
        Event event = buildEvent(eventId, EventStatus.PENDING_APPROVAL);
        event.setApprovalStatus(EventApprovalStatus.PENDING);
        event.setVenueBookingId("booking-2");
        event.setVenueId("venue-2");
        event.setVenueName("Riverside");
        event.setVenueCity("Chennai");

        when(eventRepository.findByVenueBookingId("booking-2")).thenReturn(Optional.of(event));
        when(eventRepository.save(any(Event.class))).thenAnswer(invocation -> invocation.getArgument(0));

        eventService.handleVenueBookingCancelled("booking-2", "Venue no longer available");

        verify(eventRepository).save(argThat(saved ->
                saved.getStatus() == EventStatus.PENDING_APPROVAL
                        && saved.getApprovalStatus() == EventApprovalStatus.CHANGES_REQUESTED
                        && saved.getVenueBookingId() == null
                        && saved.getVenueId() == null
                        && saved.getVenueName() == null
                        && saved.getVenueCity() == null));
    }

    private Event buildEvent(UUID eventId, EventStatus status) {
        Event event = new Event();
        event.setId(eventId);
        event.setOrganizerId(organizer.id());
        event.setOrganizerEmail(organizer.email());
        event.setCategory(category);
        event.setTitle("AI Summit");
        event.setEventType("CONFERENCE");
        event.setDescription("desc");
        event.setStartTime(OffsetDateTime.now().plusDays(2));
        event.setEndTime(OffsetDateTime.now().plusDays(2).plusHours(8));
        event.setExpectedAttendees(100);
        event.setCapacity(120);
        event.setEstimatedBudget(BigDecimal.TEN);
        event.setProposedBudget(BigDecimal.TEN);
        event.setApprovedBudget(BigDecimal.TEN);
        event.setApprovalStatus(EventApprovalStatus.APPROVED);
        event.setStatus(status);
        event.setRecurrenceRule(RecurrenceRule.NONE);
        event.setSessions(new ArrayList<>());
        event.setAgendaItems(new ArrayList<>());
        return event;
    }
}
