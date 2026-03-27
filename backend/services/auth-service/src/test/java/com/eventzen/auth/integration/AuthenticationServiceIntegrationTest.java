package com.eventzen.auth.integration;

import com.eventzen.auth.dto.AuthResponse;
import com.eventzen.auth.dto.ForgotPasswordRequest;
import com.eventzen.auth.dto.LoginRequest;
import com.eventzen.auth.dto.MfaSetupResponse;
import com.eventzen.auth.dto.MfaVerifyRequest;
import com.eventzen.auth.dto.RefreshTokenRequest;
import com.eventzen.auth.dto.RegisterRequest;
import com.eventzen.auth.dto.AssignRolesRequest;
import com.eventzen.auth.dto.ResetPasswordRequest;
import com.eventzen.auth.dto.UpdateProfileRequest;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.exception.EventZenException;
import com.eventzen.auth.repository.RefreshTokenRepository;
import com.eventzen.auth.repository.UserRoleRepository;
import com.eventzen.auth.repository.UserRepository;
import com.eventzen.auth.security.RoleName;
import com.eventzen.auth.security.TotpService;
import com.eventzen.auth.service.AuthNotificationService;
import com.eventzen.auth.service.AuthenticationService;
import com.eventzen.auth.service.UserManagementService;
import com.eventzen.auth.service.RegisterResult;
import com.eventzen.auth.service.ProfileUpdateResult;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AuthenticationServiceIntegrationTest {

    @Autowired
    private AuthenticationService authenticationService;
    @Autowired
    private UserManagementService userManagementService;
    @Autowired
    private UserRepository userRepository;
    @Autowired
    private RefreshTokenRepository refreshTokenRepository;
    @Autowired
    private TotpService totpService;
    @Autowired
    private UserRoleRepository userRoleRepository;
    @Autowired
    private CaptureAuthNotificationService captureAuthNotificationService;

    @Test
    void registerCreatesUserAndRefreshToken() {
        RegisterRequest request = new RegisterRequest("Integration", "User", "integration.user@example.com", "Password@123", "+911234567890", RoleName.ATTENDEE);

        RegisterResult response = authenticationService.register(request, "127.0.0.1");

        assertThat(response.response().accessToken()).isNotBlank();
        assertThat(response.response().refreshToken()).isNotBlank();
        assertThat(userRepository.findByEmailIgnoreCase("integration.user@example.com")).isPresent();
        assertThat(refreshTokenRepository.findAll()).isNotEmpty();
    }

    @Test
    void loginSucceedsAfterRegistration() {
        authenticationService.register(
                new RegisterRequest("Login", "User", "login.user@example.com", "Password@123", null, RoleName.ATTENDEE),
                "127.0.0.1"
        );

        AuthResponse response = authenticationService.login(new LoginRequest("login.user@example.com", "Password@123", null), "127.0.0.1");

        assertThat(response.accessToken()).isNotBlank();
        assertThat(response.refreshToken()).isNotBlank();
    }

    @Test
    void refreshRotatesAndLogoutRevokesTokens() {
        RegisterResult registration = authenticationService.register(
                new RegisterRequest("Refresh", "User", "refresh.user@example.com", "Password@123", null, RoleName.ATTENDEE),
                "127.0.0.1"
        );

        AuthResponse refreshed = authenticationService.refresh(new RefreshTokenRequest(registration.response().refreshToken()), "127.0.0.1");

        assertThat(refreshed.refreshToken()).isNotEqualTo(registration.response().refreshToken());
        assertThat(refreshTokenRepository.findAll()).hasSizeGreaterThanOrEqualTo(2);

        authenticationService.logout(new RefreshTokenRequest(refreshed.refreshToken()), "127.0.0.1");

        assertThatThrownBy(() -> authenticationService.refresh(new RefreshTokenRequest(refreshed.refreshToken()), "127.0.0.1"))
                .isInstanceOf(EventZenException.class);
    }

    @Test
    void mfaSetupStoresEncryptedSecretAndLoginRequiresOtpAfterVerification() throws Exception {
        RegisterResult registration = authenticationService.register(
                new RegisterRequest("Mfa", "User", "mfa.user@example.com", "Password@123", null, RoleName.ATTENDEE),
                "127.0.0.1"
        );
        User user = userRepository.findByEmailIgnoreCase("mfa.user@example.com").orElseThrow();

        MfaSetupResponse setup = authenticationService.setupMfa(user.getId());
        user = userRepository.findById(user.getId()).orElseThrow();

        assertThat(user.getMfaSecret()).startsWith("enc:");
        assertThat(user.getMfaSecret()).doesNotContain(setup.secret());

        String currentCode = currentCode(setup.secret());
        authenticationService.verifyMfa(user.getId(), new MfaVerifyRequest(currentCode));

        assertThatThrownBy(() -> authenticationService.login(new LoginRequest("mfa.user@example.com", "Password@123", null), "127.0.0.1"))
                .isInstanceOf(EventZenException.class)
                .hasMessage("A valid MFA code is required");

        AuthResponse login = authenticationService.login(new LoginRequest("mfa.user@example.com", "Password@123", currentCode), "127.0.0.1");
        assertThat(login.accessToken()).isNotBlank();
    }

    @Test
    void deactivatedUserCanBeReactivatedAndLoginAgain() {
        authenticationService.register(
                new RegisterRequest("Reactivation", "User", "reactivation.user@example.com", "Password@123", null, RoleName.ATTENDEE),
                "127.0.0.1"
        );
        User user = userRepository.findByEmailIgnoreCase("reactivation.user@example.com").orElseThrow();

        userManagementService.deactivateUser(user.getId());

        assertThatThrownBy(() -> authenticationService.login(new LoginRequest("reactivation.user@example.com", "Password@123", null), "127.0.0.1"))
                .isInstanceOf(Exception.class);

        userManagementService.reactivateUser(user.getId());

        AuthResponse login = authenticationService.login(new LoginRequest("reactivation.user@example.com", "Password@123", null), "127.0.0.1");
        assertThat(login.accessToken()).isNotBlank();
    }

    @Test
    void adminCanAssignRolesToAnotherUser() {
        authenticationService.register(
                new RegisterRequest("Role", "Target", "role.target@example.com", "Password@123", null, RoleName.ATTENDEE),
                "127.0.0.1"
        );
        User target = userRepository.findByEmailIgnoreCase("role.target@example.com").orElseThrow();

        userManagementService.assignRoles(target.getId(), new AssignRolesRequest(Set.of(RoleName.ADMIN, RoleName.ORGANIZER)));

        assertThat(userRoleRepository.findAllByUser_Id(target.getId()))
                .extracting(userRole -> userRole.getRole().getName())
                .containsExactlyInAnyOrder(RoleName.ADMIN, RoleName.ORGANIZER);
    }

    @Test
    void emailVerificationAndPasswordResetFlowWorks() {
        authenticationService.register(
                new RegisterRequest("Verify", "User", "verify.user@example.com", "Password@123", null, RoleName.ATTENDEE),
                "127.0.0.1"
        );
        User user = userRepository.findByEmailIgnoreCase("verify.user@example.com").orElseThrow();

        assertThat(user.getEmailVerificationTokenHash()).isNotBlank();
        authenticationService.resendEmailVerification("verify.user@example.com", "127.0.0.1");
        String emailVerificationToken = captureAuthNotificationService.latestVerificationToken("verify.user@example.com");
        authenticationService.verifyEmail(emailVerificationToken, "127.0.0.1");

        user = userRepository.findById(user.getId()).orElseThrow();
        assertThat(user.isEmailVerified()).isTrue();

        authenticationService.forgotPassword(new ForgotPasswordRequest("verify.user@example.com"), "127.0.0.1");
        String passwordResetToken = captureAuthNotificationService.latestPasswordResetToken("verify.user@example.com");
        authenticationService.resetPassword(new ResetPasswordRequest(passwordResetToken, "NewPassword@123"), "127.0.0.1");

        AuthResponse login = authenticationService.login(new LoginRequest("verify.user@example.com", "NewPassword@123", null), "127.0.0.1");
        assertThat(login.accessToken()).isNotBlank();
    }

    @Test
    void profileUpdateChangesEmailAndPhone() {
        authenticationService.register(
                new RegisterRequest("Profile", "User", "profile.user@example.com", "Password@123", "+911234567890", RoleName.ATTENDEE),
                "127.0.0.1"
        );
        User user = userRepository.findByEmailIgnoreCase("profile.user@example.com").orElseThrow();

        ProfileUpdateResult result = authenticationService.updateMyProfile(
                user.getId(),
                new UpdateProfileRequest("Profile", "Updated", "profile.updated@example.com", "+919999999999"),
                "127.0.0.1"
        );

        User updated = userRepository.findById(user.getId()).orElseThrow();
        assertThat(updated.getEmail()).isEqualTo("profile.updated@example.com");
        assertThat(updated.getPhone()).isEqualTo("+919999999999");
        assertThat(updated.isEmailVerified()).isFalse();
        assertThat(result.emailVerificationToken()).isNotBlank();
    }

    private String currentCode(String secret) throws Exception {
        Method generateCode = TotpService.class.getDeclaredMethod("generateCode", String.class, long.class);
        generateCode.setAccessible(true);
        long currentWindow = System.currentTimeMillis() / 1000 / 30;
        return (String) generateCode.invoke(totpService, secret, currentWindow);
    }

    @TestConfiguration
    static class TestNotificationsConfiguration {

        @Bean
        @Primary
        CaptureAuthNotificationService captureAuthNotificationService() {
            return new CaptureAuthNotificationService();
        }
    }

    static class CaptureAuthNotificationService implements AuthNotificationService {

        private final Map<String, String> passwordResetTokens = new ConcurrentHashMap<>();
        private final Map<String, String> verificationTokens = new ConcurrentHashMap<>();

        @Override
        public void sendPasswordResetEmail(String email, String firstName, String token) {
            passwordResetTokens.put(email.toLowerCase(), token);
        }

        @Override
        public void sendEmailVerificationEmail(String email, String firstName, String token) {
            verificationTokens.put(email.toLowerCase(), token);
        }

        String latestPasswordResetToken(String email) {
            return passwordResetTokens.get(email.toLowerCase());
        }

        String latestVerificationToken(String email) {
            return verificationTokens.get(email.toLowerCase());
        }
    }
}
