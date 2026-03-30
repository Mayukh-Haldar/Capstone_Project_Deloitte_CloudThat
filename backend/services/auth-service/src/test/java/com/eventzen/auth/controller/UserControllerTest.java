package com.eventzen.auth.controller;

import com.eventzen.auth.security.RoleName;
import com.eventzen.auth.service.NotificationClient;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.context.WebApplicationContext;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller-layer HTTP tests for all UserController endpoints (admin-only).
 *
 * Test IDs covered: AUTH-CT-031 through AUTH-CT-055
 *
 * All endpoints under /api/v1/users require ROLE_ADMIN.
 * The test profile bootstraps admin@test.local / Admin@12345 via DataSeeder.
 *
 * NotificationClient is mocked to avoid 2-second TCP timeouts on port 8086.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.DisplayName.class)
class UserControllerTest {

    private MockMvc mockMvc;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Autowired private WebApplicationContext context;
    @MockitoBean  private NotificationClient notificationClient;

    @BeforeEach
    void setUp() {
        this.mockMvc = MockMvcBuilders.webAppContextSetup(context)
                .apply(SecurityMockMvcConfigurers.springSecurity())
                .build();
    }

    // -----------------------------------------------------------------------
    // Helper utilities
    // -----------------------------------------------------------------------

    private void registerUser(String firstName, String lastName,
                               String email, String password, RoleName role) throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"%s\",\"lastName\":\"%s\",\"email\":\"%s\",\"password\":\"%s\",\"requestedRole\":\"%s\"}"
                                .formatted(firstName, lastName, email, password, role)))
                .andExpect(status().isOk());
    }

    private AuthTokens loginAndGetTokens(String email, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return new AuthTokens(json.get("accessToken").asText(), json.get("refreshToken").asText());
    }

    private String getAdminToken() throws Exception {
        return loginAndGetTokens("admin@test.local", "Admin@12345").access();
    }

    /**
     * Registers a fresh user and returns their UUID (extracted from GET /api/v1/users admin list).
     */
    private UUID registerUserAndGetId(String email, String password, RoleName role) throws Exception {
        String suffix = email.split("@")[0];
        registerUser("First", suffix, email, password, role);

        // Use admin to look up the user id from the users list
        String adminToken = getAdminToken();
        MvcResult result = mockMvc.perform(get("/api/v1/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("page", "0")
                        .param("size", "200"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode root = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode content = root.get("content");
        for (JsonNode user : content) {
            if (email.equals(user.get("email").asText())) {
                return UUID.fromString(user.get("id").asText());
            }
        }
        throw new IllegalStateException("User not found in admin list: " + email);
    }

    private record AuthTokens(String access, String refresh) {}

    // -----------------------------------------------------------------------
    // GET /api/v1/users  [AUTH-CT-031 … AUTH-CT-033]
    // -----------------------------------------------------------------------

    /** AUTH-CT-031 — Admin can retrieve paginated user list. */
    @Test
    void listUsersAsAdminReturns200WithPage() throws Exception {
        String adminToken = getAdminToken();

        mockMvc.perform(get("/api/v1/users")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("page", "0")
                        .param("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").isArray())
                .andExpect(jsonPath("$.totalElements").isNumber());
    }

    /** AUTH-CT-032 — Non-admin authenticated user receives 403 FORBIDDEN. */
    @Test
    void listUsersAsNonAdminReturns403() throws Exception {
        registerUser("Usr", "NonAdmin032", "non.admin.032@example.com", "Password@032", RoleName.ATTENDEE);
        String userToken = loginAndGetTokens("non.admin.032@example.com", "Password@032").access();

        mockMvc.perform(get("/api/v1/users")
                        .header("Authorization", "Bearer " + userToken))
                .andExpect(status().isForbidden());
    }

    /** AUTH-CT-033 — Unauthenticated request to /users returns 401. */
    @Test
    void listUsersUnauthenticatedReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/users"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // PUT /api/v1/users/{id}/roles  [AUTH-CT-034 … AUTH-CT-036]
    // -----------------------------------------------------------------------

    /** AUTH-CT-034 — Admin can assign a new role to an existing user. */
    @Test
    void assignRoleAsAdminReturns200WithUpdatedUser() throws Exception {
        UUID userId = registerUserAndGetId("roles.user.034@example.com", "Password@034", RoleName.ATTENDEE);
        String adminToken = getAdminToken();

        mockMvc.perform(put("/api/v1/users/{id}/roles", userId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roles\":[\"ORGANIZER\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.roles").isArray());
    }

    /** AUTH-CT-035 — Non-admin user cannot assign roles — returns 403. */
    @Test
    void assignRoleAsNonAdminReturns403() throws Exception {
        UUID userId = registerUserAndGetId("roles.user.035@example.com", "Password@035", RoleName.ATTENDEE);
        registerUser("Plain", "User035b", "plain.user.035b@example.com", "Password@035b", RoleName.ATTENDEE);
        String plainToken = loginAndGetTokens("plain.user.035b@example.com", "Password@035b").access();

        mockMvc.perform(put("/api/v1/users/{id}/roles", userId)
                        .header("Authorization", "Bearer " + plainToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roles\":[\"ORGANIZER\"]}"))
                .andExpect(status().isForbidden());
    }

    /** AUTH-CT-036 — Assigning role to non-existent user returns 404. */
    @Test
    void assignRoleForUnknownUserReturns404() throws Exception {
        String adminToken = getAdminToken();
        UUID randomId = UUID.randomUUID();

        mockMvc.perform(put("/api/v1/users/{id}/roles", randomId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"roles\":[\"ATTENDEE\"]}"))
                .andExpect(status().isNotFound());
    }

    // -----------------------------------------------------------------------
    // DELETE /api/v1/users/{id}  (soft deactivation)  [AUTH-CT-037 … AUTH-CT-039]
    // -----------------------------------------------------------------------

    /** AUTH-CT-037 — Admin can deactivate a user account (soft delete). */
    @Test
    void deactivateUserAsAdminReturns200() throws Exception {
        UUID userId = registerUserAndGetId("deact.user.037@example.com", "Password@037", RoleName.ATTENDEE);
        String adminToken = getAdminToken();

        mockMvc.perform(delete("/api/v1/users/{id}", userId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    /** AUTH-CT-038 — Non-admin cannot deactivate a user — returns 403. */
    @Test
    void deactivateUserAsNonAdminReturns403() throws Exception {
        UUID userId = registerUserAndGetId("deact.user.038@example.com", "Password@038", RoleName.ATTENDEE);
        registerUser("Plain", "User038b", "plain.user.038b@example.com", "Password@038b", RoleName.ATTENDEE);
        String plainToken = loginAndGetTokens("plain.user.038b@example.com", "Password@038b").access();

        mockMvc.perform(delete("/api/v1/users/{id}", userId)
                        .header("Authorization", "Bearer " + plainToken))
                .andExpect(status().isForbidden());
    }

    /** AUTH-CT-039 — Deactivating a non-existent user returns 404. */
    @Test
    void deactivateNonExistentUserReturns404() throws Exception {
        String adminToken = getAdminToken();
        mockMvc.perform(delete("/api/v1/users/{id}", UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    // -----------------------------------------------------------------------
    // PATCH /api/v1/users/{id}/reactivate  [AUTH-CT-040 … AUTH-CT-042]
    // -----------------------------------------------------------------------

    /** AUTH-CT-040 — Admin can reactivate a previously deactivated user. */
    @Test
    void reactivateUserAsAdminReturns200() throws Exception {
        UUID userId = registerUserAndGetId("react.user.040@example.com", "Password@040", RoleName.ATTENDEE);
        String adminToken = getAdminToken();

        // Deactivate first
        mockMvc.perform(delete("/api/v1/users/{id}", userId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk());

        // Now reactivate
        mockMvc.perform(patch("/api/v1/users/{id}/reactivate", userId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    /** AUTH-CT-041 — Non-admin cannot reactivate a user — returns 403. */
    @Test
    void reactivateUserAsNonAdminReturns403() throws Exception {
        UUID userId = registerUserAndGetId("react.user.041@example.com", "Password@041", RoleName.ATTENDEE);
        registerUser("Plain", "User041b", "plain.user.041b@example.com", "Password@041b", RoleName.ATTENDEE);
        String plainToken = loginAndGetTokens("plain.user.041b@example.com", "Password@041b").access();

        mockMvc.perform(patch("/api/v1/users/{id}/reactivate", userId)
                        .header("Authorization", "Bearer " + plainToken))
                .andExpect(status().isForbidden());
    }

    /** AUTH-CT-042 — Reactivating a non-existent user returns 404. */
    @Test
    void reactivateNonExistentUserReturns404() throws Exception {
        String adminToken = getAdminToken();
        mockMvc.perform(patch("/api/v1/users/{id}/reactivate", UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    // -----------------------------------------------------------------------
    // DELETE /api/v1/users/{id}/gdpr/delete  [AUTH-CT-043 … AUTH-CT-045]
    // -----------------------------------------------------------------------

    /** AUTH-CT-043 — Admin can GDPR-delete a user account (hard delete / anonymize). */
    @Test
    void gdprDeleteUserAsAdminReturns200() throws Exception {
        UUID userId = registerUserAndGetId("gdpr.user.043@example.com", "Password@043", RoleName.ATTENDEE);
        String adminToken = getAdminToken();

        mockMvc.perform(delete("/api/v1/users/{id}/gdpr/delete", userId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    /** AUTH-CT-044 — Non-admin cannot GDPR-delete a user — returns 403. */
    @Test
    void gdprDeleteUserAsNonAdminReturns403() throws Exception {
        UUID userId = registerUserAndGetId("gdpr.user.044@example.com", "Password@044", RoleName.ATTENDEE);
        registerUser("Plain", "User044b", "plain.user.044b@example.com", "Password@044b", RoleName.ATTENDEE);
        String plainToken = loginAndGetTokens("plain.user.044b@example.com", "Password@044b").access();

        mockMvc.perform(delete("/api/v1/users/{id}/gdpr/delete", userId)
                        .header("Authorization", "Bearer " + plainToken))
                .andExpect(status().isForbidden());
    }

    /** AUTH-CT-045 — GDPR-deleting a non-existent user returns 404. */
    @Test
    void gdprDeleteNonExistentUserReturns404() throws Exception {
        String adminToken = getAdminToken();
        mockMvc.perform(delete("/api/v1/users/{id}/gdpr/delete", UUID.randomUUID())
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }
}
