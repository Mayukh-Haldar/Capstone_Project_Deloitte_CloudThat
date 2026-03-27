package com.eventzen.auth.service;

import com.eventzen.auth.config.AuthFeatureProperties;
import com.eventzen.auth.dto.AuthResponse;
import com.eventzen.auth.dto.CurrentUserResponse;
import com.eventzen.auth.dto.ForgotPasswordRequest;
import com.eventzen.auth.dto.GoogleSignInRequest;
import com.eventzen.auth.dto.LoginRequest;
import com.eventzen.auth.dto.MfaSetupResponse;
import com.eventzen.auth.dto.MfaVerifyRequest;
import com.eventzen.auth.dto.RefreshTokenRequest;
import com.eventzen.auth.dto.RegisterRequest;
import com.eventzen.auth.dto.ResetPasswordRequest;
import com.eventzen.auth.dto.UpdateProfileRequest;
import com.eventzen.auth.entity.RefreshToken;
import com.eventzen.auth.entity.Role;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.exception.EventZenException;
import com.eventzen.auth.repository.RefreshTokenRepository;
import com.eventzen.auth.repository.RoleRepository;
import com.eventzen.auth.repository.UserRepository;
import com.eventzen.auth.repository.UserRoleRepository;
import com.eventzen.auth.security.CurrentUserPrincipal;
import com.eventzen.auth.security.FieldEncryptionService;
import com.eventzen.auth.security.JwtService;
import com.eventzen.auth.security.RoleName;
import com.eventzen.auth.security.TotpService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthenticationServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private UserRoleRepository userRoleRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private JwtService jwtService;
    @Mock
    private TotpService totpService;
    @Mock
    private AuditService auditService;
    @Mock
    private UserMapper userMapper;
    @Mock
    private EventZenUserDetailsService userDetailsService;
    @Mock
    private FieldEncryptionService fieldEncryptionService;
    @Mock
    private AuthNotificationService authNotificationService;
    @Mock
    private GoogleTokenVerifier googleTokenVerifier;
    @Mock
    private AuthFeatureProperties authFeatureProperties;

    private AuthenticationService authenticationService;

    @BeforeEach
    void setUp() {
        authenticationService = new AuthenticationService(
                userRepository,
                roleRepository,
                userRoleRepository,
                refreshTokenRepository,
                passwordEncoder,
                authenticationManager,
                jwtService,
                totpService,
                auditService,
                userMapper,
                userDetailsService,
                fieldEncryptionService,
                authNotificationService,
                googleTokenVerifier,
                authFeatureProperties
        );
    }

    @Test
    void registerCreatesUserAssignsRoleAndIssuesTokens() {
        RegisterRequest request = new RegisterRequest("Mayuk", "Tester", "mayuk@example.com", "Password@123", "+911234567890", RoleName.ORGANIZER);
        Role organizerRole = Role.create(RoleName.ORGANIZER, RoleName.ORGANIZER.getDescription());
        User persistedUser = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded-password", "+911234567890");
        setId(persistedUser, UUID.randomUUID());
        CurrentUserResponse userResponse = new CurrentUserResponse(
                persistedUser.getId(), "Mayuk", "Tester", "mayuk@example.com", "+911234567890",
                true, false, false, Set.of("ORGANIZER"), Set.of("event:create"), Instant.now()
        );
        CurrentUserPrincipal principal = mock(CurrentUserPrincipal.class);

        when(userRepository.existsByEmailIgnoreCase("mayuk@example.com")).thenReturn(false);
        when(authFeatureProperties.emailVerificationHours()).thenReturn(24L);
        when(passwordEncoder.encode("Password@123")).thenReturn("encoded-password");
        when(userRepository.save(any(User.class))).thenReturn(persistedUser);
        when(roleRepository.findByName(RoleName.ORGANIZER)).thenReturn(Optional.of(organizerRole));
        when(userDetailsService.toPrincipal(persistedUser)).thenReturn(principal);
        when(jwtService.generateAccessToken(principal)).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(CurrentUserPrincipal.class), any(UUID.class))).thenReturn("refresh-token");
        when(jwtService.accessTokenTtlSeconds()).thenReturn(900L);
        when(jwtService.refreshTokenTtlSeconds()).thenReturn(604800L);
        when(userMapper.toCurrentUserResponse(persistedUser)).thenReturn(userResponse);
        when(authFeatureProperties.emailVerificationHours()).thenReturn(24L);

        RegisterResult result = authenticationService.register(request, "127.0.0.1");
        AuthResponse response = result.response();

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isEqualTo("refresh-token");
        assertThat(result.emailVerificationToken()).isNotBlank();
        verify(userRoleRepository).save(any());
        verify(refreshTokenRepository).save(any(RefreshToken.class));
        verify(auditService).log(any(User.class), anyString(), anyString(), anyString(), anyString(), anyString());
        verify(authNotificationService).sendEmailVerificationEmail(eq("mayuk@example.com"), eq("Mayuk"), anyString());
    }

    @Test
    void registerRejectsDuplicateEmail() {
        RegisterRequest request = new RegisterRequest("Mayuk", "Tester", "mayuk@example.com", "Password@123", "+911234567890", RoleName.ATTENDEE);
        when(userRepository.existsByEmailIgnoreCase("mayuk@example.com")).thenReturn(true);

        assertThatThrownBy(() -> authenticationService.register(request, "127.0.0.1"))
                .isInstanceOf(EventZenException.class)
                .hasMessage("User already exists with this email");
    }

    @Test
    void loginRejectsInvalidCredentials() {
        when(authenticationManager.authenticate(any())).thenThrow(new BadCredentialsException("bad credentials"));

        assertThatThrownBy(() -> authenticationService.login(new LoginRequest("mayuk@example.com", "wrong", null), "127.0.0.1"))
                .isInstanceOf(EventZenException.class)
                .extracting(ex -> ((EventZenException) ex).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void loginSucceedsWithoutMfa() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        setId(user, UUID.randomUUID());
        CurrentUserPrincipal principal = new CurrentUserPrincipal(user, Set.of(new SimpleGrantedAuthority("ROLE_ATTENDEE")));
        CurrentUserResponse userResponse = new CurrentUserResponse(
                user.getId(), "Mayuk", "Tester", "mayuk@example.com", null,
                true, false, false, Set.of("ATTENDEE"), Set.of("auth:read"), Instant.now()
        );

        when(userRepository.findByEmailIgnoreCase("mayuk@example.com")).thenReturn(Optional.of(user));
        when(authFeatureProperties.requireVerifiedEmailForLogin()).thenReturn(false);
        when(userDetailsService.toPrincipal(user)).thenReturn(principal);
        when(jwtService.generateAccessToken(principal)).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(CurrentUserPrincipal.class), any(UUID.class))).thenReturn("refresh-token");
        when(jwtService.accessTokenTtlSeconds()).thenReturn(900L);
        when(jwtService.refreshTokenTtlSeconds()).thenReturn(604800L);
        when(userMapper.toCurrentUserResponse(user)).thenReturn(userResponse);

        AuthResponse response = authenticationService.login(new LoginRequest("mayuk@example.com", "Password@123", null), "127.0.0.1");

        assertThat(response.accessToken()).isEqualTo("access-token");
        assertThat(response.refreshToken()).isEqualTo("refresh-token");
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void loginRejectsInactiveUser() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        user.deactivate();
        when(userRepository.findByEmailIgnoreCase("mayuk@example.com")).thenReturn(Optional.of(user));

        assertThatThrownBy(() -> authenticationService.login(new LoginRequest("mayuk@example.com", "Password@123", null), "127.0.0.1"))
                .isInstanceOf(EventZenException.class)
                .extracting(ex -> ((EventZenException) ex).getStatus())
                .isEqualTo(HttpStatus.FORBIDDEN);
    }

    @Test
    void loginRequiresOtpWhenMfaEnabled() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        user.setMfaEnabled(true);
        user.setMfaSecret("enc:value");

        when(userRepository.findByEmailIgnoreCase("mayuk@example.com")).thenReturn(Optional.of(user));
        when(authFeatureProperties.requireVerifiedEmailForLogin()).thenReturn(false);
        when(fieldEncryptionService.decryptIfNeeded("enc:value")).thenReturn("decrypted-secret");

        assertThatThrownBy(() -> authenticationService.login(new LoginRequest("mayuk@example.com", "Password@123", null), "127.0.0.1"))
                .isInstanceOf(EventZenException.class)
                .hasMessage("A valid MFA code is required");
    }

    @Test
    void refreshRotatesTokenFamilyMember() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        setId(user, UUID.randomUUID());
        RefreshToken existing = RefreshToken.of(user, hash("old-refresh-token"), Instant.now().plusSeconds(600), UUID.randomUUID(), "127.0.0.1");
        setRefreshTokenId(existing, UUID.randomUUID());
        CurrentUserPrincipal principal = new CurrentUserPrincipal(user, Set.of(new SimpleGrantedAuthority("ROLE_ATTENDEE")));
        CurrentUserResponse userResponse = new CurrentUserResponse(
                user.getId(), "Mayuk", "Tester", "mayuk@example.com", null,
                true, false, false, Set.of("ATTENDEE"), Set.of("auth:read"), Instant.now()
        );

        when(jwtService.isRefreshToken("old-refresh-token")).thenReturn(true);
        when(refreshTokenRepository.findByTokenHash(hash("old-refresh-token"))).thenReturn(Optional.of(existing));
        when(userDetailsService.toPrincipal(user)).thenReturn(principal);
        when(jwtService.generateAccessToken(principal)).thenReturn("new-access");
        when(jwtService.generateRefreshToken(any(CurrentUserPrincipal.class), any(UUID.class))).thenReturn("new-refresh");
        when(jwtService.accessTokenTtlSeconds()).thenReturn(900L);
        when(jwtService.refreshTokenTtlSeconds()).thenReturn(604800L);
        when(userMapper.toCurrentUserResponse(user)).thenReturn(userResponse);

        AuthResponse response = authenticationService.refresh(new RefreshTokenRequest("old-refresh-token"), "127.0.0.1");

        assertThat(response.refreshToken()).isEqualTo("new-refresh");
        assertThat(existing.isRevoked()).isTrue();
        verify(refreshTokenRepository).save(existing);
        verify(refreshTokenRepository, times(2)).save(any(RefreshToken.class));
    }

    @Test
    void refreshRejectsUnknownToken() {
        when(jwtService.isRefreshToken("missing-token")).thenReturn(true);
        when(refreshTokenRepository.findByTokenHash(hash("missing-token"))).thenReturn(Optional.empty());

        assertThatThrownBy(() -> authenticationService.refresh(new RefreshTokenRequest("missing-token"), "127.0.0.1"))
                .isInstanceOf(EventZenException.class)
                .extracting(ex -> ((EventZenException) ex).getStatus())
                .isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void setupMfaEncryptsSecretBeforeSaving() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        setId(user, UUID.randomUUID());
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(totpService.generateSecret()).thenReturn("PLAINSECRET");
        when(fieldEncryptionService.encrypt("PLAINSECRET")).thenReturn("enc:SECRET");
        when(totpService.buildOtpAuthUri("mayuk@example.com", "PLAINSECRET")).thenReturn("otpauth://totp/test");

        MfaSetupResponse response = authenticationService.setupMfa(user.getId());

        assertThat(response.secret()).isEqualTo("PLAINSECRET");
        assertThat(response.otpauthUri()).isEqualTo("otpauth://totp/test");
        verify(userRepository).save(user);
        assertThat(user.getMfaSecret()).isEqualTo("enc:SECRET");
    }

    @Test
    void verifyMfaEnablesMfaForValidCode() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        setId(user, UUID.randomUUID());
        user.setMfaSecret("enc:SECRET");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(fieldEncryptionService.decryptIfNeeded("enc:SECRET")).thenReturn("PLAINSECRET");
        when(totpService.verifyCode("PLAINSECRET", "123456")).thenReturn(true);

        authenticationService.verifyMfa(user.getId(), new MfaVerifyRequest("123456"));

        assertThat(user.isMfaEnabled()).isTrue();
        verify(userRepository).save(user);
    }

    @Test
    void forgotPasswordGeneratesResetTokenForExistingUser() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        setId(user, UUID.randomUUID());
        when(userRepository.findByEmailIgnoreCase("mayuk@example.com")).thenReturn(Optional.of(user));
        when(authFeatureProperties.passwordResetMinutes()).thenReturn(30L);

        String debugToken = authenticationService.forgotPassword(new ForgotPasswordRequest("mayuk@example.com"), "127.0.0.1");

        assertThat(user.getPasswordResetTokenHash()).isNotBlank();
        assertThat(user.getPasswordResetTokenExpiresAt()).isAfter(Instant.now());
        assertThat(debugToken).isNotBlank();
        verify(authNotificationService).sendPasswordResetEmail(eq("mayuk@example.com"), eq("Mayuk"), anyString());
    }

    @Test
    void resetPasswordUpdatesPasswordAndRevokesTokens() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        setId(user, UUID.randomUUID());
        String rawToken = "reset-token";
        user.setPasswordResetToken(hash(rawToken), Instant.now().plusSeconds(60));
        RefreshToken refreshToken = RefreshToken.of(user, "hash", Instant.now().plusSeconds(60), UUID.randomUUID(), "127.0.0.1");
        when(userRepository.findByPasswordResetTokenHash(hash(rawToken))).thenReturn(Optional.of(user));
        when(passwordEncoder.encode("NewPassword@123")).thenReturn("new-encoded");
        when(refreshTokenRepository.findAllByUser_Id(user.getId())).thenReturn(List.of(refreshToken));

        authenticationService.resetPassword(new ResetPasswordRequest(rawToken, "NewPassword@123"), "127.0.0.1");

        assertThat(user.getPasswordHash()).isEqualTo("new-encoded");
        assertThat(user.getPasswordResetTokenHash()).isNull();
        assertThat(refreshToken.isRevoked()).isTrue();
    }

    @Test
    void verifyEmailMarksUserAsVerified() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        setId(user, UUID.randomUUID());
        String rawToken = "verify-token";
        user.setEmailVerificationToken(hash(rawToken), Instant.now().plusSeconds(60));
        when(userRepository.findByEmailVerificationTokenHash(hash(rawToken))).thenReturn(Optional.of(user));

        authenticationService.verifyEmail(rawToken, "127.0.0.1");

        assertThat(user.isEmailVerified()).isTrue();
        assertThat(user.getEmailVerificationTokenHash()).isNull();
    }

    @Test
    void googleSignInCreatesUserWhenMissing() {
        Role attendeeRole = Role.create(RoleName.ATTENDEE, RoleName.ATTENDEE.getDescription());
        GoogleIdentity googleIdentity = new GoogleIdentity("google-subject", "google.user@example.com", true, "Google", "User");
        CurrentUserPrincipal principal = mock(CurrentUserPrincipal.class);
        when(googleTokenVerifier.verify("google-token")).thenReturn(googleIdentity);
        when(userRepository.findByGoogleSubject("google-subject")).thenReturn(Optional.empty());
        when(userRepository.findByEmailIgnoreCase("google.user@example.com")).thenReturn(Optional.empty());
        when(passwordEncoder.encode(anyString())).thenReturn("encoded-google-password");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            if (saved.getId() == null) {
                setId(saved, UUID.randomUUID());
            }
            return saved;
        });
        when(roleRepository.findByName(RoleName.ATTENDEE)).thenReturn(Optional.of(attendeeRole));
        when(userDetailsService.toPrincipal(any(User.class))).thenReturn(principal);
        when(jwtService.generateAccessToken(principal)).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(CurrentUserPrincipal.class), any(UUID.class))).thenReturn("refresh-token");
        when(jwtService.accessTokenTtlSeconds()).thenReturn(900L);
        when(jwtService.refreshTokenTtlSeconds()).thenReturn(604800L);
        when(userMapper.toCurrentUserResponse(any(User.class))).thenAnswer(invocation -> {
            User saved = invocation.getArgument(0);
            return new CurrentUserResponse(saved.getId(), saved.getFirstName(), saved.getLastName(), saved.getEmail(), saved.getPhone(),
                    true, true, false, Set.of("ATTENDEE"), Set.of(), Instant.now());
        });

        AuthResponse response = authenticationService.signInWithGoogle(new GoogleSignInRequest("google-token", null, null), "127.0.0.1");

        assertThat(response.accessToken()).isEqualTo("access-token");
        verify(userRoleRepository).save(any());
    }

    @Test
    void googleSignInRequiresOtpWhenMfaEnabled() {
        User user = User.register("Google", "User", "google.user@example.com", "encoded", null);
        setId(user, UUID.randomUUID());
        user.linkGoogleSubject("google-subject");
        user.markEmailVerified();
        user.setMfaEnabled(true);
        user.setMfaSecret("enc:SECRET");
        GoogleIdentity googleIdentity = new GoogleIdentity("google-subject", "google.user@example.com", true, "Google", "User");

        when(googleTokenVerifier.verify("google-token")).thenReturn(googleIdentity);
        when(userRepository.findByGoogleSubject("google-subject")).thenReturn(Optional.of(user));
        when(fieldEncryptionService.decryptIfNeeded("enc:SECRET")).thenReturn("PLAINSECRET");

        assertThatThrownBy(() -> authenticationService.signInWithGoogle(new GoogleSignInRequest("google-token", null, null), "127.0.0.1"))
                .isInstanceOf(EventZenException.class)
                .hasMessage("A valid MFA code is required");
    }

    @Test
    void googleSignInSucceedsWithOtpWhenMfaEnabled() {
        User user = User.register("Google", "User", "google.user@example.com", "encoded", null);
        setId(user, UUID.randomUUID());
        user.linkGoogleSubject("google-subject");
        user.markEmailVerified();
        user.setMfaEnabled(true);
        user.setMfaSecret("enc:SECRET");
        GoogleIdentity googleIdentity = new GoogleIdentity("google-subject", "google.user@example.com", true, "Google", "User");
        CurrentUserPrincipal principal = mock(CurrentUserPrincipal.class);

        when(googleTokenVerifier.verify("google-token")).thenReturn(googleIdentity);
        when(userRepository.findByGoogleSubject("google-subject")).thenReturn(Optional.of(user));
        when(fieldEncryptionService.decryptIfNeeded("enc:SECRET")).thenReturn("PLAINSECRET");
        when(totpService.verifyCode("PLAINSECRET", "123456")).thenReturn(true);
        when(userDetailsService.toPrincipal(user)).thenReturn(principal);
        when(jwtService.generateAccessToken(principal)).thenReturn("access-token");
        when(jwtService.generateRefreshToken(any(CurrentUserPrincipal.class), any(UUID.class))).thenReturn("refresh-token");
        when(jwtService.accessTokenTtlSeconds()).thenReturn(900L);
        when(jwtService.refreshTokenTtlSeconds()).thenReturn(604800L);
        when(userMapper.toCurrentUserResponse(user)).thenReturn(new CurrentUserResponse(
                user.getId(), "Google", "User", "google.user@example.com", null,
                true, true, true, Set.of("ATTENDEE"), Set.of(), Instant.now()
        ));

        AuthResponse response = authenticationService.signInWithGoogle(new GoogleSignInRequest("google-token", null, "123456"), "127.0.0.1");

        assertThat(response.accessToken()).isEqualTo("access-token");
        verify(refreshTokenRepository).save(any(RefreshToken.class));
    }

    @Test
    void updateMyProfileReverifiesOnEmailChange() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", "+911234567890");
        setId(user, UUID.randomUUID());
        user.markEmailVerified();
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.existsByEmailIgnoreCaseAndIdNot("updated@example.com", user.getId())).thenReturn(false);
        when(authFeatureProperties.emailVerificationHours()).thenReturn(24L);
        when(userMapper.toCurrentUserResponse(user)).thenReturn(new CurrentUserResponse(
                user.getId(), "Updated", "User", "updated@example.com", "+919876543210",
                true, false, false, Set.of("ATTENDEE"), Set.of(), Instant.now()
        ));

        ProfileUpdateResult result = authenticationService.updateMyProfile(
                user.getId(),
                new UpdateProfileRequest("Updated", "User", "updated@example.com", "+919876543210"),
                "127.0.0.1"
        );
        CurrentUserResponse response = result.response();

        assertThat(response.email()).isEqualTo("updated@example.com");
        assertThat(user.isEmailVerified()).isFalse();
        assertThat(result.emailVerificationToken()).isNotBlank();
        verify(authNotificationService).sendEmailVerificationEmail(eq("updated@example.com"), eq("Updated"), anyString());
    }

    private void setId(User user, UUID id) {
        try {
            Field field = User.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(user, id);
        } catch (ReflectiveOperationException exception) {
            throw new RuntimeException(exception);
        }
    }

    private void setRefreshTokenId(RefreshToken refreshToken, UUID id) {
        try {
            Field field = RefreshToken.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(refreshToken, id);
        } catch (ReflectiveOperationException exception) {
            throw new RuntimeException(exception);
        }
    }

    private String hash(String token) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException exception) {
            throw new RuntimeException(exception);
        }
    }
}
