package com.eventzen.event.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.eventzen.event.model.EventCategory;
import com.eventzen.event.repository.EventCategoryRepository;
import com.eventzen.event.service.NotificationClient;
import com.eventzen.event.service.TicketingClient;
import com.eventzen.event.service.VenueVendorClient;
import com.jayway.jsonpath.JsonPath;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/**
 * HTTP controller-layer integration tests for the Event Service.
 * Tests are ordered to simulate a realistic event lifecycle:
 *   create → read/update → sessions → approval → disable/enable → delete
 *
 * Uses H2 in-memory DB (test profile), real JWT parsing, and mocked external clients.
 * Test IDs: EVENT-CT-001 to EVENT-CT-043
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
class EventControllerTest {

    private static final String TEST_JWT_SECRET = "change-me-change-me-change-me-change-me-1234567890";
    private static final UUID ORGANIZER_ID  = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static final UUID ADMIN_ID      = UUID.fromString("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static final UUID OTHER_ORG_ID  = UUID.fromString("cccccccc-cccc-cccc-cccc-cccccccccccc");

    // Shared state set by earlier tests, consumed by later tests
    private static String eventAId;
    private static String eventBId;
    private static String sessionId;
    private static String agendaItemId1;
    private static String agendaItemId2;
    private static String enableReqId;
    private static String enableReqId2;

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private VenueVendorClient venueVendorClient;

    @MockitoBean
    private NotificationClient notificationClient;

    @MockitoBean
    private TicketingClient ticketingClient;

    @Autowired
    private EventCategoryRepository categoryRepository;

    private UUID categoryId;
    private String organizerToken;
    private String adminToken;
    private String otherOrgToken;

    @BeforeEach
    void setUp() {
        categoryId     = categoryRepository.findAll().stream().findFirst()
                                           .map(EventCategory::getId).orElseThrow();
        organizerToken = buildJwt(ORGANIZER_ID, "organizer@test.local", "ORGANIZER");
        adminToken     = buildJwt(ADMIN_ID,     "admin@test.local",     "ADMIN");
        otherOrgToken  = buildJwt(OTHER_ORG_ID, "other@test.local",     "ORGANIZER");

        // Stub methods that return values (void methods are doNothing() by default on mocks)
        when(venueVendorClient.createBooking(any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new VenueVendorClient.BookingResult("booking-test", "PAID", BigDecimal.ZERO, "INR"));
        when(ticketingClient.getAttendees(any(), any(), any())).thenReturn(List.of());
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    private String buildJwt(UUID userId, String email, String role) {
        return Jwts.builder()
                .subject(email)
                .issuer("eventzen-auth-service")
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusSeconds(3600)))
                .claim("type", "access")
                .claim("uid", userId.toString())
                .claim("authorities", List.of("ROLE_" + role))
                .signWith(Keys.hmacShaKeyFor(TEST_JWT_SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    private String baseEventPayload(String title, String catId) {
        return """
                {
                  "categoryId": "%s",
                  "title": "%s",
                  "eventType": "CONFERENCE",
                  "description": "A comprehensive test event for CI/CD pipeline validation",
                  "startTime": "2030-11-01T09:00:00Z",
                  "endTime":   "2030-11-01T18:00:00Z",
                  "expectedAttendees": 100,
                  "capacity": 300,
                  "estimatedBudget": 75000,
                  "recurrenceRule": "NONE",
                  "tags": ["testing", "ci"],
                  "agendaItems": [
                    {
                      "agendaTitle": "Opening Keynote",
                      "type": "KEYNOTE",
                      "startTime": "2030-11-01T09:00:00Z",
                      "endTime":   "2030-11-01T10:00:00Z"
                    },
                    {
                      "agendaTitle": "Workshop: Cloud Basics",
                      "type": "WORKSHOP",
                      "startTime": "2030-11-01T10:30:00Z",
                      "endTime":   "2030-11-01T12:30:00Z"
                    }
                  ]
                }
                """.formatted(catId, title);
    }

    // =========================================================================
    // EVENT-CT-001  Category
    // =========================================================================

    @Test
    @Order(1)
    @DisplayName("EVENT-CT-001 GET /categories public → 200 with id and name fields")
    void EVENT_CT_001_ListCategories_Public_Returns200() throws Exception {
        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").exists())
                .andExpect(jsonPath("$[0].name").exists());
    }

    // =========================================================================
    // EVENT-CT-010..015  Create Event
    // =========================================================================

    @Test
    @Order(10)
    @DisplayName("EVENT-CT-010 POST /events without token → 401")
    void EVENT_CT_010_CreateEvent_Unauthenticated_Returns401() throws Exception {
        mockMvc.perform(post("/api/v1/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(baseEventPayload("Unauth Event", categoryId.toString())))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(11)
    @DisplayName("EVENT-CT-011 POST /events missing required title → 400 with $.details")
    void EVENT_CT_011_CreateEvent_MissingTitle_Returns400() throws Exception {
        String payload = """
                {
                  "categoryId": "%s",
                  "eventType": "CONFERENCE",
                  "description": "desc",
                  "startTime": "2030-11-01T09:00:00Z",
                  "endTime": "2030-11-01T18:00:00Z",
                  "expectedAttendees": 100,
                  "capacity": 300,
                  "estimatedBudget": 75000
                }
                """.formatted(categoryId);
        mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("EVENT-400"))
                .andExpect(jsonPath("$.details[0].field").exists());
    }

    @Test
    @Order(12)
    @DisplayName("EVENT-CT-012 POST /events expectedAttendees > capacity → 4xx")
    void EVENT_CT_012_CreateEvent_AttendeesExceedCapacity_Returns4xx() throws Exception {
        String payload = """
                {
                  "categoryId": "%s",
                  "title": "Overflow Event",
                  "eventType": "CONFERENCE",
                  "description": "desc",
                  "startTime": "2030-11-01T09:00:00Z",
                  "endTime": "2030-11-01T18:00:00Z",
                  "expectedAttendees": 999,
                  "capacity": 100,
                  "estimatedBudget": 10000
                }
                """.formatted(categoryId);
        mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @Order(13)
    @DisplayName("EVENT-CT-013 POST /events as ORGANIZER → 201 PENDING_APPROVAL (saves eventAId)")
    void EVENT_CT_013_CreateEventA_AsOrganizer_Returns201() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(baseEventPayload("EventZen Test Event A", categoryId.toString())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.event.status").value("PENDING_APPROVAL"))
                .andExpect(jsonPath("$.event.approvalStatus").value("PENDING"))
                .andExpect(jsonPath("$.agendaItems").isArray())
                .andReturn();

        String body = result.getResponse().getContentAsString();
        eventAId = JsonPath.read(body, "$.event.id");
        List<String> ids = JsonPath.read(body, "$.agendaItems[*].id");
        if (ids.size() >= 2) {
            agendaItemId1 = ids.get(0);
            agendaItemId2 = ids.get(1);
        }
    }

    @Test
    @Order(14)
    @DisplayName("EVENT-CT-014 POST /events as ORGANIZER (event B for changes flow) → 201 (saves eventBId)")
    void EVENT_CT_014_CreateEventB_AsOrganizer_Returns201() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(baseEventPayload("EventZen Test Event B", categoryId.toString())))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.event.status").value("PENDING_APPROVAL"))
                .andReturn();
        eventBId = JsonPath.read(result.getResponse().getContentAsString(), "$.event.id");
    }

    @Test
    @Order(15)
    @DisplayName("EVENT-CT-015 POST /events as ADMIN → 201 DRAFT immediately with APPROVED status")
    void EVENT_CT_015_CreateEvent_AsAdmin_Returns201_Draft() throws Exception {
        String payload = """
                {
                  "organizerId": "%s",
                  "categoryId": "%s",
                  "title": "Admin Direct Event",
                  "eventType": "SUMMIT",
                  "description": "Admin-curated event bypassing approval",
                  "startTime": "2030-12-01T09:00:00Z",
                  "endTime": "2030-12-01T18:00:00Z",
                  "expectedAttendees": 200,
                  "capacity": 500,
                  "estimatedBudget": 100000
                }
                """.formatted(ORGANIZER_ID, categoryId);
        mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.event.status").value("DRAFT"))
                .andExpect(jsonPath("$.event.approvalStatus").value("APPROVED"));
    }

    // =========================================================================
    // EVENT-CT-020..024  Read Events
    // =========================================================================

    @Test
    @Order(20)
    @DisplayName("EVENT-CT-020 GET /events/{id} public → 200 with event data")
    void EVENT_CT_020_GetEvent_Public_Returns200() throws Exception {
        mockMvc.perform(get("/api/v1/events/{id}", eventAId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.id").value(eventAId))
                .andExpect(jsonPath("$.event.title").value("EventZen Test Event A"));
    }

    @Test
    @Order(21)
    @DisplayName("EVENT-CT-021 GET /events/{id} non-existent → 404")
    void EVENT_CT_021_GetEvent_NotFound_Returns404() throws Exception {
        mockMvc.perform(get("/api/v1/events/{id}", UUID.randomUUID()))
                .andExpect(status().isNotFound());
    }

    @Test
    @Order(22)
    @DisplayName("EVENT-CT-022 GET /events public list → 200 paged response")
    void EVENT_CT_022_ListEvents_Returns200PagedResponse() throws Exception {
        mockMvc.perform(get("/api/v1/events"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").isNumber())
                .andExpect(jsonPath("$.page").value(0));
    }

    @Test
    @Order(23)
    @DisplayName("EVENT-CT-023 GET /events with query/status filters → 200")
    void EVENT_CT_023_ListEvents_WithFilters_Returns200() throws Exception {
        mockMvc.perform(get("/api/v1/events")
                        .param("q", "EventZen")
                        .param("status", "PENDING_APPROVAL")
                        .param("page", "0")
                        .param("size", "5"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray());
    }

    @Test
    @Order(24)
    @DisplayName("EVENT-CT-024 GET /events/{id}/agenda public → 200 array")
    void EVENT_CT_024_GetAgenda_Public_Returns200() throws Exception {
        mockMvc.perform(get("/api/v1/events/{id}/agenda", eventAId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    // =========================================================================
    // EVENT-CT-030..032  Update Event
    // =========================================================================

    @Test
    @Order(30)
    @DisplayName("EVENT-CT-030 PUT /events/{id} as owner organizer → 200 updated title")
    void EVENT_CT_030_UpdateEvent_AsOwner_Returns200() throws Exception {
        mockMvc.perform(put("/api/v1/events/{id}", eventAId)
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"title\": \"EventZen Test Event A (Updated)\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.title").value("EventZen Test Event A (Updated)"));
    }

    @Test
    @Order(31)
    @DisplayName("EVENT-CT-031 PUT /events/{id} as different organizer → 4xx (ownership check)")
    void EVENT_CT_031_UpdateEvent_AsOtherOrganizer_ReturnsForbidden() throws Exception {
        mockMvc.perform(put("/api/v1/events/{id}", eventAId)
                        .header("Authorization", "Bearer " + otherOrgToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"title\": \"Hijacked Title\" }"))
                .andExpect(status().is4xxClientError());
    }

    @Test
    @Order(32)
    @DisplayName("EVENT-CT-032 PUT /events/{id} without token → 401")
    void EVENT_CT_032_UpdateEvent_Unauthenticated_Returns401() throws Exception {
        mockMvc.perform(put("/api/v1/events/{id}", eventAId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"title\": \"No token\" }"))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // EVENT-CT-040..044  Sessions & Agenda
    // =========================================================================

    @Test
    @Order(40)
    @DisplayName("EVENT-CT-040 POST /events/{id}/sessions without token → 401")
    void EVENT_CT_040_CreateSession_Unauthenticated_Returns401() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/sessions", eventAId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sessionTitle": "Session 1",
                                  "startTime": "2030-11-01T13:00:00Z",
                                  "endTime":   "2030-11-01T14:00:00Z"
                                }
                                """))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(41)
    @DisplayName("EVENT-CT-041 POST /events/{id}/sessions as organizer → 201 (saves sessionId)")
    void EVENT_CT_041_CreateSession_AsOrganizer_Returns201() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/events/{id}/sessions", eventAId)
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sessionTitle": "Keynote Presentation",
                                  "speakerName": "Dr. Jane Smith",
                                  "room": "Hall A",
                                  "sessionType": "KEYNOTE",
                                  "startTime": "2030-11-01T13:00:00Z",
                                  "endTime":   "2030-11-01T14:00:00Z",
                                  "capacity": 150
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.sessionTitle").value("Keynote Presentation"))
                .andReturn();
        sessionId = JsonPath.read(result.getResponse().getContentAsString(), "$.id");
    }

    @Test
    @Order(42)
    @DisplayName("EVENT-CT-042 PUT /events/{id}/sessions/{sId} as organizer → 200 updated")
    void EVENT_CT_042_UpdateSession_AsOrganizer_Returns200() throws Exception {
        mockMvc.perform(put("/api/v1/events/{id}/sessions/{sessionId}", eventAId, sessionId)
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "sessionTitle": "Keynote Presentation (Revised)",
                                  "speakerName": "Dr. Jane Smith",
                                  "room": "Hall B",
                                  "startTime": "2030-11-01T13:00:00Z",
                                  "endTime":   "2030-11-01T14:30:00Z"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionTitle").value("Keynote Presentation (Revised)"));
    }

    @Test
    @Order(44)
    @DisplayName("EVENT-CT-044 PUT /events/{id}/agenda/reorder as organizer → 200 reordered array")
    void EVENT_CT_044_ReorderAgenda_AsOrganizer_Returns200() throws Exception {
        if (agendaItemId1 == null || agendaItemId2 == null) return;
        String payload = "{ \"agendaItemIds\": [\"%s\", \"%s\"] }"
                .formatted(agendaItemId2, agendaItemId1);
        mockMvc.perform(put("/api/v1/events/{id}/agenda/reorder", eventAId)
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    // =========================================================================
    // EVENT-CT-050..053  Approval Workflow — Event A (approve path)
    // =========================================================================

    @Test
    @Order(50)
    @DisplayName("EVENT-CT-050 POST /events/{id}/approval/approve as organizer → 403")
    void EVENT_CT_050_ApproveEvent_AsOrganizer_ReturnsForbidden() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/approval/approve", eventAId)
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(51)
    @DisplayName("EVENT-CT-051 POST /events/{id}/approval/approve as admin → 200 DRAFT + APPROVED")
    void EVENT_CT_051_ApproveEvent_AsAdmin_Returns200() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/approval/approve", eventAId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"approvedBudget\": 75000, \"note\": \"Looks great, approved!\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.approvalStatus").value("APPROVED"))
                .andExpect(jsonPath("$.event.status").value("DRAFT"));
    }

    @Test
    @Order(52)
    @DisplayName("EVENT-CT-052 PATCH /events/{id}/status DRAFT→PUBLISHED as admin → 200")
    void EVENT_CT_052_TransitionStatus_ToPublished_Returns200() throws Exception {
        mockMvc.perform(patch("/api/v1/events/{id}/status", eventAId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"status\": \"PUBLISHED\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.status").value("PUBLISHED"));
    }

    @Test
    @Order(53)
    @DisplayName("EVENT-CT-053 PATCH /events/{id}/status with null status → 400 validation error")
    void EVENT_CT_053_TransitionStatus_NullStatus_Returns400() throws Exception {
        mockMvc.perform(patch("/api/v1/events/{id}/status", eventAId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    // =========================================================================
    // EVENT-CT-054..056  Approval Workflow — Event B (request-changes → resubmit → reject)
    // =========================================================================

    @Test
    @Order(54)
    @DisplayName("EVENT-CT-054 POST /events/{id}/approval/request-changes as admin → 200 CHANGES_REQUESTED")
    void EVENT_CT_054_RequestChanges_AsAdmin_Returns200() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/approval/request-changes", eventBId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"note\": \"Please provide a tighter agenda\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.approvalStatus").value("CHANGES_REQUESTED"));
    }

    @Test
    @Order(55)
    @DisplayName("EVENT-CT-055 POST /events/{id}/approval/resubmit as organizer → 200 PENDING")
    void EVENT_CT_055_Resubmit_AsOrganizer_Returns200() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/approval/resubmit", eventBId)
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.approvalStatus").value("PENDING"));
    }

    @Test
    @Order(56)
    @DisplayName("EVENT-CT-056 POST /events/{id}/approval/reject as admin → 200 REJECTED")
    void EVENT_CT_056_RejectEvent_AsAdmin_Returns200() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/approval/reject", eventBId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"note\": \"Not aligned with platform standards\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.approvalStatus").value("REJECTED"));
    }

    // =========================================================================
    // EVENT-CT-060..068  Disable / Enable Flow
    // =========================================================================

    @Test
    @Order(60)
    @DisplayName("EVENT-CT-060 POST /events/{id}/disable as admin → 200 DISABLED_BY_ADMIN")
    void EVENT_CT_060_DisableEvent_AsAdmin_Returns200() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/disable", eventAId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.status").value("DISABLED_BY_ADMIN"));
    }

    @Test
    @Order(61)
    @DisplayName("EVENT-CT-061 POST /events/{id}/disable without token → 401")
    void EVENT_CT_061_DisableEvent_Unauthenticated_Returns401() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/disable", eventBId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(62)
    @DisplayName("EVENT-CT-062 POST /events/{id}/request-enable as organizer → 200 PENDING (saves enableReqId)")
    void EVENT_CT_062_RequestEnable_AsOrganizer_Returns200() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/events/{id}/request-enable", eventAId)
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"note\": \"Ready to reopen\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();
        enableReqId = JsonPath.read(result.getResponse().getContentAsString(), "$.requestId");
    }

    @Test
    @Order(63)
    @DisplayName("EVENT-CT-063 GET /events/enable-requests as admin → 200 array")
    void EVENT_CT_063_ListEnableRequests_AsAdmin_Returns200() throws Exception {
        mockMvc.perform(get("/api/v1/events/enable-requests")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    @Test
    @Order(64)
    @DisplayName("EVENT-CT-064 GET /events/enable-requests as organizer → 403")
    void EVENT_CT_064_ListEnableRequests_AsOrganizer_ReturnsForbidden() throws Exception {
        mockMvc.perform(get("/api/v1/events/enable-requests")
                        .header("Authorization", "Bearer " + organizerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(65)
    @DisplayName("EVENT-CT-065 POST /events/enable-requests/{id}/approve as admin → 200 re-enabled")
    void EVENT_CT_065_ApproveEnableRequest_AsAdmin_Returns200() throws Exception {
        mockMvc.perform(post("/api/v1/events/enable-requests/{id}/approve", enableReqId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"note\": \"Approved, re-enabled\" }"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.status").value("PUBLISHED"));
    }

    @Test
    @Order(66)
    @DisplayName("EVENT-CT-066 POST /events/{id}/disable (second time) as admin → 200")
    void EVENT_CT_066_DisableEventAgain_AsAdmin_Returns200() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/disable", eventAId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.event.status").value("DISABLED_BY_ADMIN"));
    }

    @Test
    @Order(67)
    @DisplayName("EVENT-CT-067 POST /events/{id}/request-enable (second request) → 200 (saves enableReqId2)")
    void EVENT_CT_067_RequestEnableAgain_Returns200() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/events/{id}/request-enable", eventAId)
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"note\": \"Please re-enable again\" }"))
                .andExpect(status().isOk())
                .andReturn();
        enableReqId2 = JsonPath.read(result.getResponse().getContentAsString(), "$.requestId");
    }

    @Test
    @Order(68)
    @DisplayName("EVENT-CT-068 POST /events/enable-requests/{id}/reject as admin → 204")
    void EVENT_CT_068_RejectEnableRequest_AsAdmin_Returns204() throws Exception {
        mockMvc.perform(post("/api/v1/events/enable-requests/{id}/reject", enableReqId2)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{ \"note\": \"Not yet ready\" }"))
                .andExpect(status().isNoContent());
    }

    // =========================================================================
    // EVENT-CT-070  Delete Session
    // =========================================================================

    @Test
    @Order(70)
    @DisplayName("EVENT-CT-070 DELETE /events/{id}/sessions/{sId} as organizer → 204")
    void EVENT_CT_070_DeleteSession_AsOrganizer_Returns204() throws Exception {
        mockMvc.perform(delete("/api/v1/events/{id}/sessions/{sessionId}", eventAId, sessionId)
                        .header("Authorization", "Bearer " + organizerToken))
                .andExpect(status().isNoContent());
    }

    // =========================================================================
    // EVENT-CT-080..082  Delete Event
    // =========================================================================

    @Test
    @Order(80)
    @DisplayName("EVENT-CT-080 DELETE /events/{id} as organizer → 403 (admin-only)")
    void EVENT_CT_080_DeleteEvent_AsOrganizer_ReturnsForbidden() throws Exception {
        mockMvc.perform(delete("/api/v1/events/{id}", eventAId)
                        .header("Authorization", "Bearer " + organizerToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @Order(81)
    @DisplayName("EVENT-CT-081 DELETE /events/{id} without token → 401")
    void EVENT_CT_081_DeleteEvent_Unauthenticated_Returns401() throws Exception {
        mockMvc.perform(delete("/api/v1/events/{id}", eventAId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(82)
    @DisplayName("EVENT-CT-082 DELETE /events/{id} as admin → 200 with message")
    void EVENT_CT_082_DeleteEvent_AsAdmin_Returns200() throws Exception {
        mockMvc.perform(delete("/api/v1/events/{id}", eventAId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }

    // =========================================================================
    // EVENT-CT-090..091  Upload Endpoints
    // =========================================================================

    @Test
    @Order(90)
    @DisplayName("EVENT-CT-090 POST /events/uploads/banner-image without token → 401")
    void EVENT_CT_090_UploadBanner_Unauthenticated_Returns401() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "banner.jpg", "image/jpeg", new byte[100]);
        mockMvc.perform(multipart("/api/v1/events/uploads/banner-image").file(file))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @Order(91)
    @DisplayName("EVENT-CT-091 POST /events/uploads/banner-image auth + storage disabled → 503")
    void EVENT_CT_091_UploadBanner_StorageDisabled_Returns503() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "banner.jpg", "image/jpeg", new byte[100]);
        mockMvc.perform(multipart("/api/v1/events/uploads/banner-image").file(file)
                        .header("Authorization", "Bearer " + organizerToken))
                .andExpect(status().isServiceUnavailable());
    }

    @Test
    @Order(92)
    @DisplayName("EVENT-CT-092 POST /events/uploads/speaker-photo without token → 401")
    void EVENT_CT_092_UploadSpeakerPhoto_Unauthenticated_Returns401() throws Exception {
        MockMultipartFile file = new MockMultipartFile(
                "file", "photo.jpg", "image/jpeg", new byte[100]);
        mockMvc.perform(multipart("/api/v1/events/uploads/speaker-photo").file(file))
                .andExpect(status().isUnauthorized());
    }

    // =========================================================================
    // EVENT-CT-100..101  Internal Event Controller
    // =========================================================================

    @Test
    @Order(100)
    @DisplayName("EVENT-CT-100 GET /internal/events/{id}/booking-owner with valid key → 200")
    void EVENT_CT_100_InternalGetBookingOwner_ValidKey_Returns200() throws Exception {
        mockMvc.perform(get("/api/v1/internal/events/{id}/booking-owner", eventBId)
                        .header("x-internal-service-key", "test-internal-key"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.organizerId").value(ORGANIZER_ID.toString()));
    }

    @Test
    @Order(101)
    @DisplayName("EVENT-CT-101 GET /internal/events/{id}/booking-owner with wrong key → 403")
    void EVENT_CT_101_InternalGetBookingOwner_InvalidKey_ReturnsForbidden() throws Exception {
        mockMvc.perform(get("/api/v1/internal/events/{id}/booking-owner", eventBId)
                        .header("x-internal-service-key", "wrong-key"))
                .andExpect(status().isForbidden());
    }
}
