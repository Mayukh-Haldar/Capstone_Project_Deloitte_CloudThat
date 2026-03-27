package com.eventzen.event.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.eventzen.event.model.EventCategory;
import com.eventzen.event.repository.EventCategoryRepository;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class EventControllerIntegrationTest {

    private static final String TEST_JWT_SECRET = "change-me-change-me-change-me-change-me-1234567890";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private EventCategoryRepository categoryRepository;

    private UUID categoryId;
    private String organizerToken;

    @BeforeEach
    void setUp() {
        categoryId = categoryRepository.findAll().stream().findFirst().map(EventCategory::getId).orElseThrow();
        organizerToken = Jwts.builder()
                .subject("organizer@eventzen.local")
                .issuer("eventzen-auth-service")
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plusSeconds(3600)))
                .claim("type", "access")
                .claim("uid", UUID.randomUUID().toString())
                .claim("authorities", List.of("ROLE_ORGANIZER"))
                .signWith(Keys.hmacShaKeyFor(TEST_JWT_SECRET.getBytes(StandardCharsets.UTF_8)))
                .compact();
    }

    @Test
    void publicCanListCategories() throws Exception {
        mockMvc.perform(get("/api/v1/categories"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").exists());
    }

    @Test
    void organizerCanCreateEvent() throws Exception {
        String payload = """
                {
                  "categoryId": "%s",
                  "title": "Global AI Summit 2030",
                  "eventType": "CONFERENCE",
                  "description": "Enterprise AI summit",
                  "startTime": "2030-10-24T09:00:00Z",
                  "endTime": "2030-10-24T17:00:00Z",
                  "expectedAttendees": 400,
                  "capacity": 500,
                  "estimatedBudget": 250000,
                  "recurrenceRule": "NONE",
                  "tags": ["ai", "enterprise"],
                  "agendaItems": []
                }
                """.formatted(categoryId);

        mockMvc.perform(post("/api/v1/events")
                        .header("Authorization", "Bearer " + organizerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.event.title").value("Global AI Summit 2030"))
                .andExpect(jsonPath("$.event.status").value("DRAFT"));
    }

    @Test
    void unauthenticatedCreateIsRejected() throws Exception {
        String payload = """
                {
                  "categoryId": "%s",
                  "title": "Unauthorized Event",
                  "eventType": "CONFERENCE",
                  "description": "Enterprise AI summit",
                  "startTime": "2030-10-24T09:00:00Z",
                  "endTime": "2030-10-24T17:00:00Z",
                  "expectedAttendees": 400,
                  "capacity": 500,
                  "estimatedBudget": 250000,
                  "agendaItems": []
                }
                """.formatted(categoryId);

        mockMvc.perform(post("/api/v1/events")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isUnauthorized());
    }
}
