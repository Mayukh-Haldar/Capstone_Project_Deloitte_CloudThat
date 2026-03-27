package com.eventzen.event.service;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.eventzen.event.dto.CreateEventRequest;
import com.eventzen.event.dto.CreateSessionRequest;
import com.eventzen.event.dto.TransitionEventStatusRequest;
import com.eventzen.event.dto.VenueBookingRequest;
import com.eventzen.event.exception.EventServiceException;
import com.eventzen.event.model.Event;
import com.eventzen.event.model.EventCategory;
import com.eventzen.event.model.EventSession;
import com.eventzen.event.model.EventStatus;
import com.eventzen.event.model.RecurrenceRule;
import com.eventzen.event.repository.EventAgendaItemRepository;
import com.eventzen.event.repository.EventCategoryRepository;
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
    private EventMapper mapper;
    @Mock
    private VenueVendorClient venueVendorClient;

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
    void createEventCallsVenueBookingClientWhenVenueProvided() {
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

        verify(venueVendorClient).ensureVenueAvailability(any(), any(), any(), any(), any());
        verify(venueVendorClient).createBooking(any(), any(), any(), any(), any(), any());
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
}
