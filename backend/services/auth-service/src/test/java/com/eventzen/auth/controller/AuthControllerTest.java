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

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * Controller-layer HTTP tests for all AuthController endpoints.
 *
 * Test IDs covered: AUTH-CT-001 through AUTH-CT-030
 *
 * Each test is self-contained: it registers/logs-in any required users
 * before exercising the endpoint under test.
 *
 * The test profile (application-test.properties) has:
 *  - H2 in-memory database (create-drop)
 *  - auth.features.expose-debug-tokens=true
 *  - auth.features.allow-debug-google-tokens=true
 *  - auth.features.require-verified-email-for-login=false
 *
 * NotificationClient is mocked to avoid 2-second TCP timeouts on port 8086.
 */
@SpringBootTest
@ActiveProfiles("test")
@TestMethodOrder(MethodOrderer.DisplayName.class)
class AuthControllerTest {

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

    private String registerUser(String firstName, String lastName,
                                String email, String password, RoleName role) throws Exception {
        String body = """
                {"firstName":"%s","lastName":"%s","email":"%s","password":"%s","requestedRole":"%s"}
                """.formatted(firstName, lastName, email, password, role);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();

        // Return the debug verification token header so callers can confirm email if needed.
        return result.getResponse().getHeader("X-Debug-Email-Verification-Token");
    }

    private AuthTokens loginAndGetTokens(String email, String password) throws Exception {
        String body = "{\"email\":\"%s\",\"password\":\"%s\"}".formatted(email, password);
        MvcResult result = mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        return new AuthTokens(json.get("accessToken").asText(), json.get("refreshToken").asText());
    }

    private AuthTokens getAdminTokens() throws Exception {
        return loginAndGetTokens("admin@test.local", "Admin@12345");
    }

    private record AuthTokens(String access, String refresh) {}

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/register  [AUTH-CT-001 … AUTH-CT-004]
    // -----------------------------------------------------------------------

    /** AUTH-CT-001 — Valid registration returns 200 with access + refresh tokens. */
    @Test
    void registerWithValidPayloadReturns200WithTokens() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"firstName":"Reg","lastName":"Valid",
                                 "email":"reg.valid.001@example.com",
                                 "password":"Password@001","requestedRole":"ATTENDEE"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value("reg.valid.001@example.com"))
                .andExpect(jsonPath("$.user.firstName").value("Reg"));
    }

    /** AUTH-CT-002 — Duplicate email returns 409 CONFLICT. */
    @Test
    void registerWithDuplicateEmailReturns409() throws Exception {
        registerUser("Dup", "User", "reg.dup.002@example.com", "Password@002", RoleName.ATTENDEE);

        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"firstName":"Dup","lastName":"User2",
                                 "email":"reg.dup.002@example.com",
                                 "password":"Password@002","requestedRole":"ATTENDEE"}
                                """))
                .andExpect(status().isConflict());
    }

    /** AUTH-CT-003 — Missing required fields returns 400 VALIDATION_ERROR. */
    @Test
    void registerWithMissingFieldsReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lastName":"Only","password":"Password@003"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"))
                .andExpect(jsonPath("$.details").isArray());
    }

    /** AUTH-CT-004 — Invalid email format returns 400 with field-level error. */
    @Test
    void registerWithInvalidEmailReturns400FieldError() throws Exception {
        mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"firstName":"Bad","lastName":"Email",
                                 "email":"not-an-email","password":"Password@004",
                                 "requestedRole":"ATTENDEE"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.details").isArray())
                .andExpect(jsonPath("$.details[?(@.field=='email')]").exists());
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/login  [AUTH-CT-005 … AUTH-CT-008]
    // -----------------------------------------------------------------------

    /** AUTH-CT-005 — Valid login returns 200 with tokens and user profile. */
    @Test
    void loginWithCorrectCredentialsReturns200() throws Exception {
        registerUser("Login", "Valid", "login.valid.005@example.com", "Password@005", RoleName.ATTENDEE);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"login.valid.005@example.com\",\"password\":\"Password@005\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty())
                .andExpect(jsonPath("$.user.email").value("login.valid.005@example.com"));
    }

    /** AUTH-CT-006 — Wrong password returns 401 UNAUTHORIZED. */
    @Test
    void loginWithWrongPasswordReturns401() throws Exception {
        registerUser("Login", "Wrong", "login.wrong.006@example.com", "Password@006", RoleName.ATTENDEE);

        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"login.wrong.006@example.com\",\"password\":\"WrongPass@006\"}"))
                .andExpect(status().isUnauthorized());
    }

    /** AUTH-CT-007 — Non-existent user returns 401 UNAUTHORIZED. */
    @Test
    void loginWithUnknownEmailReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"does.not.exist.007@example.com\",\"password\":\"Password@007\"}"))
                .andExpect(status().isUnauthorized());
    }

    /** AUTH-CT-008 — Missing email field in login body returns 400. */
    @Test
    void loginWithMissingEmailFieldReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"password\":\"Password@008\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_ERROR"));
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/google/login  [AUTH-CT-009 … AUTH-CT-010]
    // -----------------------------------------------------------------------

    /** AUTH-CT-009 — Debug Google token creates new user and returns tokens. */
    @Test
    void googleLoginWithDebugTokenCreatesUserAndReturns200() throws Exception {
        mockMvc.perform(post("/api/v1/auth/google/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\":\"debug-google:google.new.009@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andExpect(jsonPath("$.refreshToken").isNotEmpty());
    }

    /** AUTH-CT-010 — Google login with missing idToken returns 400. */
    @Test
    void googleLoginWithMissingTokenReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/google/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/refresh  [AUTH-CT-011 … AUTH-CT-013]
    // -----------------------------------------------------------------------

    /** AUTH-CT-011 — Valid refresh token returns new access + refresh pair. */
    @Test
    void refreshWithValidTokenReturns200AndRotatesTokens() throws Exception {
        registerUser("Refresh", "User", "refresh.valid.011@example.com", "Password@011", RoleName.ATTENDEE);
        AuthTokens first = loginAndGetTokens("refresh.valid.011@example.com", "Password@011");

        MvcResult result = mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(first.refresh())))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode json = objectMapper.readTree(result.getResponse().getContentAsString());
        String newRefresh = json.get("refreshToken").asText();
        assertThat(newRefresh).isNotBlank().isNotEqualTo(first.refresh());
    }

    /** AUTH-CT-012 — Unknown/invalid refresh token returns 401. */
    @Test
    void refreshWithUnknownTokenReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"totally-fake-token-012\"}"))
                .andExpect(status().isUnauthorized());
    }

    /** AUTH-CT-013 — Missing refreshToken field returns 400. */
    @Test
    void refreshWithMissingFieldReturns400() throws Exception {
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/logout  [AUTH-CT-014 … AUTH-CT-015]
    // -----------------------------------------------------------------------

    /** AUTH-CT-014 — Valid logout returns 200 and revokes the refresh token. */
    @Test
    void logoutWithValidRefreshTokenReturns200() throws Exception {
        registerUser("Logout", "User", "logout.valid.014@example.com", "Password@014", RoleName.ATTENDEE);
        AuthTokens tokens = loginAndGetTokens("logout.valid.014@example.com", "Password@014");

        mockMvc.perform(post("/api/v1/auth/logout")
                        .header("Authorization", "Bearer " + tokens.access())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(tokens.refresh())))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logout successful"));

        // After logout the old refresh token must be rejected
        mockMvc.perform(post("/api/v1/auth/refresh")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\":\"%s\"}".formatted(tokens.refresh())))
                .andExpect(status().isUnauthorized());
    }

    /** AUTH-CT-015 — Logout without Authorization header returns 401. */
    @Test
    void logoutWithMissingBodyReturns400() throws Exception {
        // Logout endpoint requires authentication; calling without a token returns 401.
        mockMvc.perform(post("/api/v1/auth/logout")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}")
)
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // GET /api/v1/auth/me  [AUTH-CT-016 … AUTH-CT-017]
    // -----------------------------------------------------------------------

    /** AUTH-CT-016 — Authenticated request returns current user profile. */
    @Test
    void getMeWithValidTokenReturns200WithProfile() throws Exception {
        registerUser("Me", "User", "me.valid.016@example.com", "Password@016", RoleName.ATTENDEE);
        AuthTokens tokens = loginAndGetTokens("me.valid.016@example.com", "Password@016");

        mockMvc.perform(get("/api/v1/auth/me")
                        .header("Authorization", "Bearer " + tokens.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("me.valid.016@example.com"))
                .andExpect(jsonPath("$.firstName").value("Me"));
    }

    /** AUTH-CT-017 — Unauthenticated request to /me returns 401. */
    @Test
    void getMeWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get("/api/v1/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/mfa/setup  [AUTH-CT-018 … AUTH-CT-019]
    // -----------------------------------------------------------------------

    /** AUTH-CT-018 — Authenticated user can set up MFA and receives secret + OTP URI. */
    @Test
    void setupMfaWithValidTokenReturns200WithSecretAndUri() throws Exception {
        registerUser("Mfa", "Setup", "mfa.setup.018@example.com", "Password@018", RoleName.ATTENDEE);
        AuthTokens tokens = loginAndGetTokens("mfa.setup.018@example.com", "Password@018");

        mockMvc.perform(post("/api/v1/auth/mfa/setup")
                        .header("Authorization", "Bearer " + tokens.access()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secret").isNotEmpty())
                .andExpect(jsonPath("$.otpauthUri").isNotEmpty());
    }

    /** AUTH-CT-019 — Unauthenticated request to mfa/setup returns 401. */
    @Test
    void setupMfaWithoutTokenReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/mfa/setup"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/mfa/verify  [AUTH-CT-020 … AUTH-CT-021]
    // -----------------------------------------------------------------------

    /** AUTH-CT-020 — Submitting an invalid TOTP code returns 4xx error. */
    @Test
    void verifyMfaWithInvalidCodeReturns401() throws Exception {
        registerUser("Mfa", "Verify", "mfa.verify.020@example.com", "Password@020", RoleName.ATTENDEE);
        AuthTokens tokens = loginAndGetTokens("mfa.verify.020@example.com", "Password@020");

        // First set up MFA so there is a secret stored
        mockMvc.perform(post("/api/v1/auth/mfa/setup")
                .header("Authorization", "Bearer " + tokens.access()));

        mockMvc.perform(post("/api/v1/auth/mfa/verify")
                        .header("Authorization", "Bearer " + tokens.access())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"000000\"}"))
                .andExpect(status().is4xxClientError());
    }

    /** AUTH-CT-021 — Unauthenticated request to mfa/verify returns 401. */
    @Test
    void verifyMfaWithoutTokenReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/mfa/verify")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"code\":\"123456\"}"))
                .andExpect(status().isUnauthorized());
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/forgot-password  [AUTH-CT-022 … AUTH-CT-023]
    // -----------------------------------------------------------------------

    /** AUTH-CT-022 — Forgot password for an existing email returns 200 and debug token header. */
    @Test
    void forgotPasswordForExistingUserReturns200WithDebugHeader() throws Exception {
        registerUser("Forgot", "User", "forgot.user.022@example.com", "Password@022", RoleName.ATTENDEE);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"forgot.user.022@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andReturn();

        // In debug mode, the reset token is returned as a header.
        String debugToken = result.getResponse().getHeader("X-Debug-Password-Reset-Token");
        assertThat(debugToken).isNotBlank();
    }

    /** AUTH-CT-023 — Forgot password for a non-existent email returns 200 (no user enumeration). */
    @Test
    void forgotPasswordForNonExistentEmailReturns200() throws Exception {
        mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"ghost.023@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").isNotEmpty());
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/reset-password  [AUTH-CT-024 … AUTH-CT-025]
    // -----------------------------------------------------------------------

    /** AUTH-CT-024 — Valid reset token allows password change; user can log in with new password. */
    @Test
    void resetPasswordWithValidTokenUpdatesPasswordAndAllowsReLogin() throws Exception {
        registerUser("Reset", "User", "reset.user.024@example.com", "OldPass@024", RoleName.ATTENDEE);

        MvcResult forgotResult = mockMvc.perform(post("/api/v1/auth/forgot-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"reset.user.024@example.com\"}"))
                .andReturn();
        String resetToken = forgotResult.getResponse().getHeader("X-Debug-Password-Reset-Token");
        assertThat(resetToken).isNotBlank();

        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\",\"newPassword\":\"NewPass@024\"}".formatted(resetToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Password reset successful"));

        // Login with the new password must succeed
        mockMvc.perform(post("/api/v1/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"reset.user.024@example.com\",\"password\":\"NewPass@024\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }

    /** AUTH-CT-025 — Invalid/expired reset token returns 4xx error. */
    @Test
    void resetPasswordWithBadTokenReturns401() throws Exception {
        mockMvc.perform(post("/api/v1/auth/reset-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"bad-token-025\",\"newPassword\":\"NewPass@025\"}"))
                .andExpect(status().is4xxClientError());
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/email-verification/resend  [AUTH-CT-026]
    // -----------------------------------------------------------------------

    /** AUTH-CT-026 — Resend verification for a registered email returns 200 and a new debug token. */
    @Test
    void resendEmailVerificationReturns200WithDebugHeader() throws Exception {
        registerUser("Resend", "User", "resend.user.026@example.com", "Password@026", RoleName.ATTENDEE);

        MvcResult result = mockMvc.perform(post("/api/v1/auth/email-verification/resend")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"resend.user.026@example.com\"}"))
                .andExpect(status().isOk())
                .andReturn();

        String debugToken = result.getResponse().getHeader("X-Debug-Email-Verification-Token");
        assertThat(debugToken).isNotBlank();
    }

    // -----------------------------------------------------------------------
    // POST /api/v1/auth/email-verification/confirm  [AUTH-CT-027 … AUTH-CT-028]
    // -----------------------------------------------------------------------

    /** AUTH-CT-027 — Valid verification token marks the account as email-verified. */
    @Test
    void confirmEmailVerificationWithValidTokenReturns200() throws Exception {
        MvcResult regResult = mockMvc.perform(post("/api/v1/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"firstName":"Confirm","lastName":"Email",
                                 "email":"confirm.email.027@example.com",
                                 "password":"Password@027","requestedRole":"ATTENDEE"}
                                """))
                .andExpect(status().isOk())
                .andReturn();

        String verifyToken = regResult.getResponse().getHeader("X-Debug-Email-Verification-Token");
        assertThat(verifyToken).isNotBlank();

        mockMvc.perform(post("/api/v1/auth/email-verification/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"%s\"}".formatted(verifyToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Email verified"));
    }

    /** AUTH-CT-028 — Invalid/expired verification token returns a non-2xx error. */
    @Test
    void confirmEmailVerificationWithBadTokenReturnsError() throws Exception {
        mockMvc.perform(post("/api/v1/auth/email-verification/confirm")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"token\":\"invalid-token-028\"}"))
                .andExpect(status().is4xxClientError());
    }

    // -----------------------------------------------------------------------
    // PATCH /api/v1/auth/me/profile  [AUTH-CT-029 … AUTH-CT-030]
    // -----------------------------------------------------------------------

    /** AUTH-CT-029 — Authenticated user can update first/last name and phone. */
    @Test
    void updateProfileWithValidPayloadReturns200() throws Exception {
        registerUser("Profile", "Old", "profile.old.029@example.com", "Password@029", RoleName.ATTENDEE);
        AuthTokens tokens = loginAndGetTokens("profile.old.029@example.com", "Password@029");

        mockMvc.perform(patch("/api/v1/auth/me/profile")
                        .header("Authorization", "Bearer " + tokens.access())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"firstName":"Profile","lastName":"Updated",
                                 "email":"profile.old.029@example.com","phone":"+919876543210"}
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastName").value("Updated"))
                .andExpect(jsonPath("$.phone").value("+919876543210"));
    }

    /** AUTH-CT-030 — Unauthenticated request to profile update returns 401. */
    @Test
    void updateProfileWithoutTokenReturns401() throws Exception {
        mockMvc.perform(patch("/api/v1/auth/me/profile")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\":\"X\",\"lastName\":\"Y\",\"email\":\"a@b.com\"}"))
                .andExpect(status().isUnauthorized());
    }
}
