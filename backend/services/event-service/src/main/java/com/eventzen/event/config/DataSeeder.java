package com.eventzen.event.config;

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
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class DataSeeder {

    private static final UUID TECH_CATEGORY_ID = UUID.fromString("50000000-0000-0000-0000-000000000001");
    private static final UUID BUSINESS_CATEGORY_ID = UUID.fromString("50000000-0000-0000-0000-000000000002");
    private static final UUID ARTS_CATEGORY_ID = UUID.fromString("50000000-0000-0000-0000-000000000003");
    private static final UUID COMMUNITY_CATEGORY_ID = UUID.fromString("50000000-0000-0000-0000-000000000004");
    private static final UUID PULSECRAFT_VENDOR_ACCOUNT_ID = UUID.fromString("92000000-0000-0000-0000-000000000001");
    private static final UUID NORTHSTAR_VENDOR_ACCOUNT_ID = UUID.fromString("92000000-0000-0000-0000-000000000002");
    private static final UUID CANVAS_VENDOR_ACCOUNT_ID = UUID.fromString("92000000-0000-0000-0000-000000000003");
    private static final UUID SHIELDLINE_VENDOR_ACCOUNT_ID = UUID.fromString("92000000-0000-0000-0000-000000000004");

    @Bean
    ApplicationRunner seedEventCatalog(
            EventCategoryRepository categoryRepository,
            EventRepository eventRepository,
            EventSessionRepository sessionRepository,
            EventAgendaItemRepository agendaRepository
    ) {
        return args -> {
            seedCategory(categoryRepository, TECH_CATEGORY_ID, "TECH", "Technology conferences and product launches");
            seedCategory(categoryRepository, BUSINESS_CATEGORY_ID, "BUSINESS", "Business summits and leadership events");
            seedCategory(categoryRepository, ARTS_CATEGORY_ID, "ARTS", "Creative showcases and cultural events");
            seedCategory(categoryRepository, COMMUNITY_CATEGORY_ID, "COMMUNITY", "Meetups and community events");
            seedSampleEvents(categoryRepository, eventRepository, sessionRepository, agendaRepository);
        };
    }

    private void seedCategory(EventCategoryRepository categoryRepository, UUID id, String name, String description) {
        boolean exists = categoryRepository.findAll().stream()
                .map(EventCategory::getName)
                .anyMatch(existing -> existing.equalsIgnoreCase(name));
        if (exists) {
            return;
        }

        EventCategory category = new EventCategory();
        category.setId(id);
        category.setName(name);
        category.setDescription(description);
        categoryRepository.save(category);
    }

    private void seedSampleEvents(
            EventCategoryRepository categoryRepository,
            EventRepository eventRepository,
            EventSessionRepository sessionRepository,
            EventAgendaItemRepository agendaRepository
    ) {
        Map<String, EventCategory> categoriesByName = categoryRepository.findAll().stream()
                .collect(java.util.stream.Collectors.toMap(category -> category.getName().toUpperCase(), category -> category));

        List<EventSeed> seeds = List.of(
                new EventSeed(
                        UUID.fromString("70000000-0000-0000-0000-000000000001"),
                        PULSECRAFT_VENDOR_ACCOUNT_ID,
                        "TECH",
                        "AI Leadership Summit 2026",
                        "Conference",
                        "A flagship summit for AI product leaders, platform teams, and enterprise architects focused on applied GenAI delivery.",
                        "90000000-0000-0000-0000-000000000001",
                        "Skyline Convention Center",
                        "Bengaluru",
                        "93000000-0000-0000-0000-000000000001",
                        OffsetDateTime.of(2026, 4, 22, 9, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                        OffsetDateTime.of(2026, 4, 22, 19, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                        780,
                        900,
                        new BigDecimal("1850000.00"),
                        EventStatus.REGISTRATION_OPEN,
                        Set.of("ai", "leadership", "genai", "enterprise"),
                        List.of(
                                new SessionSeed("Opening Keynote: Agentic Systems", "Dr. Meera Sethi", "Aurora Ballroom", "KEYNOTE",
                                        OffsetDateTime.of(2026, 4, 22, 9, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 4, 22, 10, 15, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        900,
                                        "A practical view of agent orchestration in regulated enterprise environments."),
                                new SessionSeed("Platform Track: Trust, Eval, Guardrails", "Arjun Dev", "Launchpad Hall", "BREAKOUT",
                                        OffsetDateTime.of(2026, 4, 22, 11, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 4, 22, 11, 45, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        500,
                                        "Operational lessons from production-grade LLM systems.")
                        ),
                        List.of(
                                new AgendaSeed("Registration & coffee", "CHECKIN",
                                        OffsetDateTime.of(2026, 4, 22, 9, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 4, 22, 9, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        "Fast-track registration with sponsor showcases."),
                                new AgendaSeed("Leadership panels", "PANEL",
                                        OffsetDateTime.of(2026, 4, 22, 12, 15, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 4, 22, 13, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        "CTOs and heads of product on AI roadmaps and governance.")
                        )
                ),
                new EventSeed(
                        UUID.fromString("70000000-0000-0000-0000-000000000002"),
                        NORTHSTAR_VENDOR_ACCOUNT_ID,
                        "ARTS",
                        "Design Futures Expo",
                        "Expo",
                        "An immersive design and digital experience expo with brand activations, portfolio reviews, and creator showcases.",
                        "90000000-0000-0000-0000-000000000002",
                        "Harbor Expo Pavilion",
                        "Mumbai",
                        "93000000-0000-0000-0000-000000000002",
                        OffsetDateTime.of(2026, 5, 14, 8, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                        OffsetDateTime.of(2026, 5, 14, 21, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                        1500,
                        2200,
                        new BigDecimal("2400000.00"),
                        EventStatus.PUBLISHED,
                        Set.of("design", "expo", "creative-tech", "brand"),
                        List.of(
                                new SessionSeed("Spatial Storytelling Lab", "Naina Kapoor", "Ocean Hall", "WORKSHOP",
                                        OffsetDateTime.of(2026, 5, 14, 10, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 5, 14, 11, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        180,
                                        "How installation design can turn sponsor zones into memorable experiences.")
                        ),
                        List.of(
                                new AgendaSeed("Expo doors open", "OPEN",
                                        OffsetDateTime.of(2026, 5, 14, 8, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 5, 14, 9, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        "Floor activation, artist kiosks, and press walkthrough."),
                                new AgendaSeed("Portfolio review sprints", "REVIEW",
                                        OffsetDateTime.of(2026, 5, 14, 15, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 5, 14, 17, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        "Curated mentor tables for emerging creative talent.")
                        )
                ),
                new EventSeed(
                        UUID.fromString("70000000-0000-0000-0000-000000000003"),
                        CANVAS_VENDOR_ACCOUNT_ID,
                        "BUSINESS",
                        "FinOps Executive Forum",
                        "Forum",
                        "A one-day finance and operations forum for modern CFO offices covering forecasting, AI controls, and board-ready reporting.",
                        "90000000-0000-0000-0000-000000000003",
                        "Lotus Knowledge Arena",
                        "Hyderabad",
                        "93000000-0000-0000-0000-000000000003",
                        OffsetDateTime.of(2026, 6, 19, 9, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                        OffsetDateTime.of(2026, 6, 19, 18, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                        420,
                        700,
                        new BigDecimal("980000.00"),
                        EventStatus.REGISTRATION_OPEN,
                        Set.of("finance", "operations", "cfo", "analytics"),
                        List.of(
                                new SessionSeed("Board-ready KPI Narratives", "Rohit Menon", "Saffron Auditorium", "TALK",
                                        OffsetDateTime.of(2026, 6, 19, 10, 15, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 6, 19, 11, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        350,
                                        "Telling the operating story behind the numbers.")
                        ),
                        List.of(
                                new AgendaSeed("Executive breakfast", "NETWORKING",
                                        OffsetDateTime.of(2026, 6, 19, 9, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 6, 19, 10, 15, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        "Small-group networking with finance and ops leaders."),
                                new AgendaSeed("Peer roundtables", "ROUNDTABLE",
                                        OffsetDateTime.of(2026, 6, 19, 14, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 6, 19, 15, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        "Facilitated discussions on forecasting and spend visibility.")
                        )
                ),
                new EventSeed(
                        UUID.fromString("70000000-0000-0000-0000-000000000004"),
                        SHIELDLINE_VENDOR_ACCOUNT_ID,
                        "COMMUNITY",
                        "Riverfront Makers Fair",
                        "Festival",
                        "A community-first outdoor fair featuring indie makers, workshops, performances, and local food collectives.",
                        "90000000-0000-0000-0000-000000000004",
                        "Riverside Culture Yard",
                        "Chennai",
                        null,
                        OffsetDateTime.of(2026, 7, 11, 15, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                        OffsetDateTime.of(2026, 7, 11, 22, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                        600,
                        950,
                        new BigDecimal("540000.00"),
                        EventStatus.PUBLISHED,
                        Set.of("community", "makers", "festival", "local"),
                        List.of(),
                        List.of(
                                new AgendaSeed("Community market opens", "OPEN",
                                        OffsetDateTime.of(2026, 7, 11, 15, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 7, 11, 16, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        "Local maker stalls, music, and neighborhood pop-ups."),
                                new AgendaSeed("Sunset performance block", "PERFORMANCE",
                                        OffsetDateTime.of(2026, 7, 11, 18, 30, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        OffsetDateTime.of(2026, 7, 11, 20, 0, 0, 0, ZoneOffset.ofHoursMinutes(5, 30)),
                                        "Open-air performances at the River Deck stage.")
                        )
                )
        );

        for (EventSeed seed : seeds) {
            EventCategory category = categoriesByName.get(seed.categoryName().toUpperCase());
            if (category == null) {
                continue;
            }

            if (eventRepository.existsById(seed.id())) {
                sessionRepository.deleteAll(sessionRepository.findByEventIdOrderByStartTimeAsc(seed.id()));
                agendaRepository.deleteAll(agendaRepository.findByEventIdOrderBySortOrderAsc(seed.id()));
            }

            Event event = new Event();
            event.setId(seed.id());
            event.setOrganizerId(seed.organizerId());
            event.setCategory(category);
            event.setTitle(seed.title());
            event.setEventType(seed.eventType());
            event.setDescription(seed.description());
            event.setStartTime(seed.startTime());
            event.setEndTime(seed.endTime());
            event.setExpectedAttendees(seed.expectedAttendees());
            event.setCapacity(seed.capacity());
            event.setEstimatedBudget(seed.estimatedBudget());
            event.setStatus(seed.status());
            event.setRecurrenceRule(RecurrenceRule.NONE);
            event.setVenueId(seed.venueId());
            event.setVenueName(seed.venueName());
            event.setVenueCity(seed.venueCity());
            event.setVenueBookingId(seed.venueBookingId());
            event.setTags(seed.tags());
            event.setSessions(new ArrayList<>());
            event.setAgendaItems(new ArrayList<>());

            for (SessionSeed sessionSeed : seed.sessions()) {
                EventSession session = new EventSession();
                session.setId(UUID.randomUUID());
                session.setEvent(event);
                session.setSessionTitle(sessionSeed.title());
                session.setSpeakerName(sessionSeed.speakerName());
                session.setRoom(sessionSeed.room());
                session.setSessionType(sessionSeed.sessionType());
                session.setStartTime(sessionSeed.startTime());
                session.setEndTime(sessionSeed.endTime());
                session.setCapacity(sessionSeed.capacity());
                session.setDescription(sessionSeed.description());
                event.getSessions().add(session);
            }

            for (int index = 0; index < seed.agenda().size(); index++) {
                AgendaSeed agendaSeed = seed.agenda().get(index);
                EventAgendaItem agendaItem = new EventAgendaItem();
                agendaItem.setId(UUID.randomUUID());
                agendaItem.setEvent(event);
                agendaItem.setAgendaTitle(agendaSeed.title());
                agendaItem.setType(agendaSeed.type());
                agendaItem.setSortOrder(index + 1);
                agendaItem.setStartTime(agendaSeed.startTime());
                agendaItem.setEndTime(agendaSeed.endTime());
                agendaItem.setDescription(agendaSeed.description());
                event.getAgendaItems().add(agendaItem);
            }

            eventRepository.save(event);
        }
    }

    private record EventSeed(
            UUID id,
            UUID organizerId,
            String categoryName,
            String title,
            String eventType,
            String description,
            String venueId,
            String venueName,
            String venueCity,
            String venueBookingId,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            Integer expectedAttendees,
            Integer capacity,
            BigDecimal estimatedBudget,
            EventStatus status,
            Set<String> tags,
            List<SessionSeed> sessions,
            List<AgendaSeed> agenda
    ) {
    }

    private record SessionSeed(
            String title,
            String speakerName,
            String room,
            String sessionType,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            Integer capacity,
            String description
    ) {
    }

    private record AgendaSeed(
            String title,
            String type,
            OffsetDateTime startTime,
            OffsetDateTime endTime,
            String description
    ) {
    }
}
