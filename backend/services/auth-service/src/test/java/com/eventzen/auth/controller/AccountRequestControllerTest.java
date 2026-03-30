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
 * Controller-layer HTTP tests for all AccountRequestController endpoints.
 *
 * Test IDs covered: AUTH-CT-046 through AUTH-CT-065
 *
 * AccountRequestType values: DEACTIVATE, REACTIVATE, GDPR_DELETE, VENDOR_ACCESS
 * AccountRequestStatus values: PENDING, APPROVED, REJECTED, CANCELED
 *
 * NotificationClient is mocked to avoid 2-second TCP timeouts on port 8086.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.DisplayName.class)
class AccountRequestControllerTest {

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
     * Submits a VENDOR_ACCESS account request as the given user and returns its UUID.
     */
    private UUID submitVendorRequestAndGetId(String userToken) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/v1/account-requests")
                        .header("Authorization", "Bearer " + userToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"VENDOR_ACCESS\",\"reason\":\"I want to list my venue\"}"))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return UUID.fromString(json.get("id").asText());
    }

    private record AuthTokens(String access, String refresh) {}

    // -----------------------------------------------------------------------
    // POST /api/v1/account-requests  [AUTH-CT-046 … AUTH-CT-048]
    // -----------------------------------------------------------------------

    /** AUTH-CT-046 — Authenticated user submits a VENDOR_ACCESS request; response has PENDING status. */
    @Test
    void submitAccountRequestAsAuthenticatedUserReturns200PendingStatus() throws Exception {
        registerUser("Submit", "Request046", "submit.req.046@example.com", "Password@046", RoleName.ATTENDEE);
        String token = loginAndGetTokens("submit.req.046@example.com", "Password@046").access();

        mockMvc.perform(post("/api/v1/account-requests")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"VENDOR_ACCESS\",\"reason\":\"Apply for vendor access\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").isNotEmpty())
                .andExpect(jsonPath("$.type").value("VENDOR_ACCESS"))
                .andExpect(jsonPath("$.status").value("PENDING"));
    }

    /** AUTH-CT-047 — Unauthenticated request to submit returns 401. */
    @Test
    void submitAccountRequestUnauthenticatedReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/account-requests")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"type\":\"VENDOR_ACCESS\",\"reason\":\"No auth\"}"))
                .andExpect(status().isUnauthorized());
    }

    /** AUTH-CT-048 — Missing required 'type' field returns 400 VALIDATION_ERROR. */
    @Test
    void submitAccountRequestMissingTypeReturns400() throws Exception {
        registerUser("Submit", "NoType048", "submit.notype.048@example.com", "Password@048", RoleName.ATTENDEE);
        String token = loginAndGetTokens("submit.notype.048@example.com", "Password@048").access();

        mockMvc.perform(post("/api/v1/account-requests")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"Missing type\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    // -----------------------------------------------------------------------
    // GET /api/v1/account-requests/me  [AUTH-CT-049 … AUTH-CT-050]
    // -----------------------------------------------------------------------

    /** AUTH-CT-049 — Authenticated user can list their own account requests. */
    @Test
    void listMyRequestsAsAuthenticatedUserReturns200List() throws Exception {
        registerUser("List", "Mine049", "list.mine.049@example.com", "Password@049", RoleName.ATTENDEE);
        String token = loginAndGetTokens("list.mine.049@example.com", "Password@049").access();
        submitVendorRequestAndGetId(token);

        mockMvc.perform(get("/api/v1/account-requests/me")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$[0].type").value("VENDOR_ACCESS"));
    }

    /** AUTH-CT-050 — Unauthenticated request to list my requests returns 401. */
    @Test
    void listMyRequestsUnauthenticatedReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/account-requests/me"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/account-requests/public/reactivation  [AUTH-CT-051 … AUTH-CT-053]
    // -----------------------------------------------------------------------

    /** AUTH-CT-051 — Public reactivation request always returns 200 (no user enumeration). */
    @Test
    void publicReactivationForAnyEmailReturns200() throws Exception {
        mockMvc.perform(post("/api/v1/account-requests/public/reactivation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"vanished.user.051@example.com\",\"reason\":\"Please reactivate\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    /** AUTH-CT-052 — Public reactivation for a registered but active user also returns 200 (silent). */
    @Test
    void publicReactivationForActiveUserReturns200() throws Exception {
        registerUser("Active", "User052", "active.user.052@example.com", "Password@052", RoleName.ATTENDEE);

        mockMvc.perform(post("/api/v1/account-requests/public/reactivation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"active.user.052@example.com\",\"reason\":\"I am already active\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    /** AUTH-CT-053 — Public reactivation with missing email field returns 400. */
    @Test
    void publicReactivationWithMissingEmailReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/account-requests/public/reactivation")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"reason\":\"No email provided\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    // -----------------------------------------------------------------------
    // GET /api/v1/account-requests/public/reactivation/status  [AUTH-CT-054 … AUTH-CT-055]
    // -----------------------------------------------------------------------

    /** AUTH-CT-054 — Status for an unknown email returns 200 with accountInactive=false. */
    @Test
    void publicStatusForUnknownEmailReturns200FalseFlags() throws Exception {
        mockMvc.perform(get("/api/v1/account-requests/public/reactivation/status")
                        .param("email", "unknown.status.054@example.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountInactive").value(false))
                .andExpect(jsonPath("$.hasPendingRequest").value(false));
    }

    /** AUTH-CT-055 — Status for an active user with no pending request returns both flags as false. */
    @Test
    void publicStatusForActiveUserReturns200BothFlagsFalse() throws Exception {
        registerUser("Status", "User055", "status.user.055@example.com", "Password@055", RoleName.ATTENDEE);

        mockMvc.perform(get("/api/v1/account-requests/public/reactivation/status")
                        .param("email", "status.user.055@example.com"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accountInactive").value(false))
                .andExpect(jsonPath("$.hasPendingRequest").value(false));
    }

    // -----------------------------------------------------------------------
    // DELETE /api/v1/account-requests/{id}  [AUTH-CT-056 … AUTH-CT-058]
    // -----------------------------------------------------------------------

    /** AUTH-CT-056 — Owner can cancel their own pending request. */
    @Test
    void cancelMyPendingRequestReturns200Canceled() throws Exception {
        registerUser("Cancel", "Request056", "cancel.req.056@example.com", "Password@056", RoleName.ATTENDEE);
        String token = loginAndGetTokens("cancel.req.056@example.com", "Password@056").access();
        UUID requestId = submitVendorRequestAndGetId(token);

        mockMvc.perform(delete("/api/v1/account-requests/{id}", requestId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Request canceled"));
    }

    /** AUTH-CT-057 — Unauthenticated cancel attempt returns 401. */
    @Test
    void cancelRequestUnauthenticatedReturns401() throws Exception {
        mockMvc.perform(delete("/api/v1/account-requests/{id}", UUID.randomUUID()))
                .andExpect(status().isUnauthorized());
    }

    /** AUTH-CT-058 — Canceling another user's request returns 404 or 403 (ownership check). */
    @Test
    void cancelOtherUsersRequestReturns403Or404() throws Exception {
        // Register user A and create a request
        registerUser("OwnerA", "058a", "owner.a.058@example.com", "Password@058a", RoleName.ATTENDEE);
        String ownerToken = loginAndGetTokens("owner.a.058@example.com", "Password@058a").access();
        UUID requestId = submitVendorRequestAndGetId(ownerToken);

        // User B tries to cancel it
        registerUser("OtherB", "058b", "other.b.058@example.com", "Password@058b", RoleName.ATTENDEE);
        String otherToken = loginAndGetTokens("other.b.058@example.com", "Password@058b").access();

        mockMvc.perform(delete("/api/v1/account-requests/{id}", requestId)
                        .header("Authorization", "Bearer " + otherToken))
                .andExpect(result -> {
                    int status = result.getResponse().getStatus();
                    assertThat(status).isIn(403, 404);
                });
    }

    // -----------------------------------------------------------------------
    // GET /api/v1/account-requests/admin  [AUTH-CT-059 … AUTH-CT-061]
    // -----------------------------------------------------------------------

    /** AUTH-CT-059 — Admin can list all account requests. */
    @Test
    void listRequestsAsAdminReturns200Array() throws Exception {
        String adminToken = getAdminToken();

        mockMvc.perform(get("/api/v1/account-requests/admin")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    /** AUTH-CT-060 — Admin can filter requests by status. */
    @Test
    void listRequestsAsAdminWithStatusFilterReturns200() throws Exception {
        String adminToken = getAdminToken();

        mockMvc.perform(get("/api/v1/account-requests/admin")
                        .header("Authorization", "Bearer " + adminToken)
                        .param("status", "PENDING"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    /** AUTH-CT-061 — Non-admin requesting admin list returns 403. */
    @Test
    void listRequestsAsNonAdminReturns403() throws Exception {
        registerUser("Plain", "User061", "plain.user.061@example.com", "Password@061", RoleName.ATTENDEE);
        String token = loginAndGetTokens("plain.user.061@example.com", "Password@061").access();

        mockMvc.perform(get("/api/v1/account-requests/admin")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden());
    }

    // -----------------------------------------------------------------------
    // PATCH /api/v1/account-requests/admin/{id}/approve  [AUTH-CT-062 … AUTH-CT-063]
    // -----------------------------------------------------------------------

    /** AUTH-CT-062 — Admin can approve a pending VENDOR_ACCESS request. */
    @Test
    void approveAccountRequestAsAdminReturns200ApprovedStatus() throws Exception {
        registerUser("Approve", "You062", "approve.user.062@example.com", "Password@062", RoleName.ATTENDEE);
        String userToken = loginAndGetTokens("approve.user.062@example.com", "Password@062").access();
        UUID requestId = submitVendorRequestAndGetId(userToken);

        String adminToken = getAdminToken();

        mockMvc.perform(patch("/api/v1/account-requests/admin/{id}/approve", requestId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminComment\":\"Approved - looks good\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"));
    }

    /** AUTH-CT-063 — Non-admin trying to approve a request returns 403. */
    @Test
    void approveAccountRequestAsNonAdminReturns403() throws Exception {
        registerUser("Approve", "Target063", "approve.target.063@example.com", "Password@063", RoleName.ATTENDEE);
        String targetToken = loginAndGetTokens("approve.target.063@example.com", "Password@063").access();
        UUID requestId = submitVendorRequestAndGetId(targetToken);

        registerUser("Plain", "User063b", "plain.user.063b@example.com", "Password@063b", RoleName.ATTENDEE);
        String plainToken = loginAndGetTokens("plain.user.063b@example.com", "Password@063b").access();

        mockMvc.perform(patch("/api/v1/account-requests/admin/{id}/approve", requestId)
                        .header("Authorization", "Bearer " + plainToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminComment\":\"Trying to approve\"}"))
                .andExpect(status().isForbidden());
    }

    // -----------------------------------------------------------------------
    // PATCH /api/v1/account-requests/admin/{id}/reject  [AUTH-CT-064 … AUTH-CT-065]
    // -----------------------------------------------------------------------

    /** AUTH-CT-064 — Admin can reject a pending account request. */
    @Test
    void rejectAccountRequestAsAdminReturns200RejectedStatus() throws Exception {
        registerUser("Reject", "You064", "reject.user.064@example.com", "Password@064", RoleName.ATTENDEE);
        String userToken = loginAndGetTokens("reject.user.064@example.com", "Password@064").access();
        UUID requestId = submitVendorRequestAndGetId(userToken);

        String adminToken = getAdminToken();

        mockMvc.perform(patch("/api/v1/account-requests/admin/{id}/reject", requestId)
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminComment\":\"Insufficient information\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("REJECTED"));
    }

    /** AUTH-CT-065 — Non-admin trying to reject returns 403. */
    @Test
    void rejectAccountRequestAsNonAdminReturns403() throws Exception {
        registerUser("Reject", "Target065", "reject.target.065@example.com", "Password@065", RoleName.ATTENDEE);
        String targetToken = loginAndGetTokens("reject.target.065@example.com", "Password@065").access();
        UUID requestId = submitVendorRequestAndGetId(targetToken);

        registerUser("Plain", "User065b", "plain.user.065b@example.com", "Password@065b", RoleName.ATTENDEE);
        String plainToken = loginAndGetTokens("plain.user.065b@example.com", "Password@065b").access();

        mockMvc.perform(patch("/api/v1/account-requests/admin/{id}/reject", requestId)
                        .header("Authorization", "Bearer " + plainToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"adminComment\":\"Trying to reject\"}"))
                .andExpect(status().isForbidden());
    }
}
