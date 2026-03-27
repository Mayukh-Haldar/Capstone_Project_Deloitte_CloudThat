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
import com.eventzen.auth.entity.UserRole;
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
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.HexFormat;
import java.util.UUID;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuthenticationService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final TotpService totpService;
    private final AuditService auditService;
    private final UserMapper userMapper;
    private final EventZenUserDetailsService userDetailsService;
    private final FieldEncryptionService fieldEncryptionService;
    private final AuthNotificationService authNotificationService;
    private final GoogleTokenVerifier googleTokenVerifier;
    private final AuthFeatureProperties authFeatureProperties;

    public AuthenticationService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            RefreshTokenRepository refreshTokenRepository,
            PasswordEncoder passwordEncoder,
            AuthenticationManager authenticationManager,
            JwtService jwtService,
            TotpService totpService,
            AuditService auditService,
            UserMapper userMapper,
            EventZenUserDetailsService userDetailsService,
            FieldEncryptionService fieldEncryptionService,
            AuthNotificationService authNotificationService,
            GoogleTokenVerifier googleTokenVerifier,
            AuthFeatureProperties authFeatureProperties
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.totpService = totpService;
        this.auditService = auditService;
        this.userMapper = userMapper;
        this.userDetailsService = userDetailsService;
        this.fieldEncryptionService = fieldEncryptionService;
        this.authNotificationService = authNotificationService;
        this.googleTokenVerifier = googleTokenVerifier;
        this.authFeatureProperties = authFeatureProperties;
    }

    @Transactional
    public RegisterResult register(RegisterRequest request, String ipAddress) {
        if (userRepository.existsByEmailIgnoreCase(request.email())) {
            throw new EventZenException(HttpStatus.CONFLICT, "BUSINESS_ERROR", "AUTH-1004", "User already exists with this email");
        }

        User user = userRepository.save(User.register(
                request.firstName(),
                request.lastName(),
                request.email(),
                passwordEncoder.encode(request.password()),
                request.phone()
        ));

        RoleName requestedRole = request.requestedRole() == null || request.requestedRole() == RoleName.ADMIN
                ? RoleName.ATTENDEE
                : request.requestedRole();
        Role role = roleRepository.findByName(requestedRole)
                .orElseThrow(() -> new EventZenException(HttpStatus.INTERNAL_SERVER_ERROR, "SYSTEM_ERROR", "SYS-9001", "Default role configuration is missing"));
        userRoleRepository.save(UserRole.of(user, role, user.getId()));
        String emailVerificationToken = sendEmailVerification(user);
        auditService.log(user, "USER_REGISTERED", "user", user.getId().toString(), ipAddress, "Requested role: " + requestedRole.name());
        return new RegisterResult(issueTokens(user, ipAddress, null), emailVerificationToken);
    }

    public AuthResponse login(LoginRequest request, String ipAddress) {
        try {
            authenticationManager.authenticate(new UsernamePasswordAuthenticationToken(request.email(), request.password()));
        } catch (BadCredentialsException exception) {
            throw new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1001", "Invalid credentials");
        }

        User user = userRepository.findByEmailIgnoreCase(request.email())
                .orElseThrow(() -> new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1001", "Invalid credentials"));

        if (!user.isActive()) {
            throw new EventZenException(HttpStatus.FORBIDDEN, "AUTHORIZATION_ERROR", "AUTH-1002", "User account is inactive");
        }
        if (authFeatureProperties.requireVerifiedEmailForLogin() && !user.isEmailVerified()) {
            throw new EventZenException(HttpStatus.FORBIDDEN, "AUTHORIZATION_ERROR", "AUTH-1010", "Email address has not been verified");
        }

        if (user.isMfaEnabled()) {
            String decryptedSecret = fieldEncryptionService.decryptIfNeeded(user.getMfaSecret());
            if (request.otpCode() == null || !totpService.verifyCode(decryptedSecret, request.otpCode())) {
                throw new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1001", "A valid MFA code is required");
            }
        }

        auditService.log(user, "USER_LOGIN", "user", user.getId().toString(), ipAddress, "Login successful");
        return issueTokens(user, ipAddress, null);
    }

    @Transactional
    public AuthResponse refresh(RefreshTokenRequest request, String ipAddress) {
        if (!jwtService.isRefreshToken(request.refreshToken())) {
            throw new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1001", "Invalid refresh token");
        }

        String tokenHash = hashToken(request.refreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1001", "Refresh token not recognized"));

        if (stored.isRevoked() || stored.getExpiresAt().isBefore(Instant.now())) {
            revokeFamily(stored.getFamilyId());
            throw new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1001", "Refresh token has expired or was revoked");
        }

        stored.revoke();
        refreshTokenRepository.save(stored);
        auditService.log(stored.getUser(), "TOKEN_REFRESH", "refresh_token", stored.getId().toString(), ipAddress, "Refresh token rotated");
        return issueTokens(stored.getUser(), ipAddress, stored.getFamilyId());
    }

    @Transactional
    public void logout(RefreshTokenRequest request, String ipAddress) {
        String tokenHash = hashToken(request.refreshToken());
        RefreshToken stored = refreshTokenRepository.findByTokenHash(tokenHash)
                .orElseThrow(() -> new EventZenException(HttpStatus.NOT_FOUND, "BUSINESS_ERROR", "AUTH-1005", "Refresh token not found"));
        revokeFamily(stored.getFamilyId());
        auditService.log(stored.getUser(), "USER_LOGOUT", "refresh_token", stored.getId().toString(), ipAddress, "Token family revoked");
    }

    public CurrentUserResponse currentUser(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EventZenException(HttpStatus.NOT_FOUND, "BUSINESS_ERROR", "AUTH-1006", "User not found"));
        return userMapper.toCurrentUserResponse(user);
    }

    @Transactional
    public MfaSetupResponse setupMfa(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EventZenException(HttpStatus.NOT_FOUND, "BUSINESS_ERROR", "AUTH-1006", "User not found"));
        String secret = totpService.generateSecret();
        user.setMfaSecret(fieldEncryptionService.encrypt(secret));
        user.setMfaEnabled(false);
        userRepository.save(user);
        return new MfaSetupResponse(secret, totpService.buildOtpAuthUri(user.getEmail(), secret));
    }

    @Transactional
    public void verifyMfa(UUID userId, MfaVerifyRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EventZenException(HttpStatus.NOT_FOUND, "BUSINESS_ERROR", "AUTH-1006", "User not found"));
        String decryptedSecret = fieldEncryptionService.decryptIfNeeded(user.getMfaSecret());
        if (decryptedSecret == null || !totpService.verifyCode(decryptedSecret, request.code())) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-1007", "Invalid MFA verification code");
        }
        user.setMfaEnabled(true);
        userRepository.save(user);
    }

    @Transactional
    public String forgotPassword(ForgotPasswordRequest request, String ipAddress) {
        return userRepository.findByEmailIgnoreCase(request.email()).map(user -> {
            String token = UUID.randomUUID() + "." + UUID.randomUUID();
            user.setPasswordResetToken(hashToken(token), Instant.now().plusSeconds(authFeatureProperties.passwordResetMinutes() * 60));
            userRepository.save(user);
            authNotificationService.sendPasswordResetEmail(user.getEmail(), user.getFirstName(), token);
            auditService.log(user, "PASSWORD_RESET_REQUESTED", "user", user.getId().toString(), ipAddress, "Password reset token issued");
            return token;
        }).orElse(null);
    }

    @Transactional
    public void resetPassword(ResetPasswordRequest request, String ipAddress) {
        User user = userRepository.findByPasswordResetTokenHash(hashToken(request.token()))
                .orElseThrow(() -> new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-1011", "Password reset token is invalid"));

        if (user.getPasswordResetTokenExpiresAt() == null || user.getPasswordResetTokenExpiresAt().isBefore(Instant.now())) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-1011", "Password reset token is invalid");
        }

        user.updatePassword(passwordEncoder.encode(request.newPassword()));
        userRepository.save(user);
        refreshTokenRepository.findAllByUser_Id(user.getId()).forEach(token -> {
            token.revoke();
            refreshTokenRepository.save(token);
        });
        auditService.log(user, "PASSWORD_RESET_COMPLETED", "user", user.getId().toString(), ipAddress, "Password reset completed");
    }

    @Transactional
    public String resendEmailVerification(String email, String ipAddress) {
        return userRepository.findByEmailIgnoreCase(email).map(user -> {
            if (user.isEmailVerified()) {
                return null;
            }
            String token = sendEmailVerification(user);
            auditService.log(user, "EMAIL_VERIFICATION_RESENT", "user", user.getId().toString(), ipAddress, "Verification email resent");
            return token;
        }).orElse(null);
    }

    @Transactional
    public void verifyEmail(String token, String ipAddress) {
        User user = userRepository.findByEmailVerificationTokenHash(hashToken(token))
                .orElseThrow(() -> new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-1012", "Email verification token is invalid"));

        if (user.getEmailVerificationTokenExpiresAt() == null || user.getEmailVerificationTokenExpiresAt().isBefore(Instant.now())) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-1012", "Email verification token is invalid");
        }

        user.markEmailVerified();
        userRepository.save(user);
        auditService.log(user, "EMAIL_VERIFIED", "user", user.getId().toString(), ipAddress, "Email verified");
    }

    @Transactional
    public AuthResponse signInWithGoogle(GoogleSignInRequest request, String ipAddress) {
        GoogleIdentity identity = googleTokenVerifier.verify(request.idToken());
        if (!identity.emailVerified()) {
            throw new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1015", "Google account email is not verified");
        }

        User user = userRepository.findByGoogleSubject(identity.subject())
                .or(() -> userRepository.findByEmailIgnoreCase(identity.email()))
                .orElseGet(() -> createGoogleUser(identity, request.requestedRole()));

        user.linkGoogleSubject(identity.subject());
        user.markEmailVerified();
        if (!user.isActive()) {
            throw new EventZenException(HttpStatus.FORBIDDEN, "AUTHORIZATION_ERROR", "AUTH-1002", "User account is inactive");
        }

        if (user.isMfaEnabled()) {
            String decryptedSecret = fieldEncryptionService.decryptIfNeeded(user.getMfaSecret());
            if (request.otpCode() == null || !totpService.verifyCode(decryptedSecret, request.otpCode())) {
                throw new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR", "AUTH-1001", "A valid MFA code is required");
            }
        }

        userRepository.save(user);
        auditService.log(user, "GOOGLE_SIGN_IN", "user", user.getId().toString(), ipAddress, "Google sign-in successful");
        return issueTokens(user, ipAddress, null);
    }

    @Transactional
    public ProfileUpdateResult updateMyProfile(UUID userId, UpdateProfileRequest request, String ipAddress) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new EventZenException(HttpStatus.NOT_FOUND, "BUSINESS_ERROR", "AUTH-1006", "User not found"));

        String updatedFirstName = normalizeRequiredValue(request.firstName(), user.getFirstName(), "First name");
        String updatedLastName = normalizeRequiredValue(request.lastName(), user.getLastName(), "Last name");
        String updatedEmail = normalizeRequiredValue(request.email(), user.getEmail(), "Email").toLowerCase();
        String updatedPhone = normalizeOptionalValue(request.phone(), user.getPhone());

        boolean emailChanged = !user.getEmail().equalsIgnoreCase(updatedEmail);
        if (emailChanged && userRepository.existsByEmailIgnoreCaseAndIdNot(updatedEmail, userId)) {
            throw new EventZenException(HttpStatus.CONFLICT, "BUSINESS_ERROR", "AUTH-1004", "User already exists with this email");
        }

        String emailVerificationToken = null;
        user.updateProfile(updatedFirstName, updatedLastName, updatedEmail, updatedPhone);
        if (emailChanged) {
            user.markEmailUnverified();
            emailVerificationToken = sendEmailVerification(user);
        }

        try {
            userRepository.save(user);
        } catch (DataIntegrityViolationException exception) {
            throw new EventZenException(HttpStatus.CONFLICT, "BUSINESS_ERROR", "AUTH-1004", "User already exists with this email");
        }
        auditService.log(user, "PROFILE_UPDATED", "user", user.getId().toString(), ipAddress, emailChanged ? "Profile updated and email re-verification required" : "Profile updated");
        return new ProfileUpdateResult(userMapper.toCurrentUserResponse(user), emailVerificationToken);
    }

    private AuthResponse issueTokens(User user, String ipAddress, UUID existingFamilyId) {
        CurrentUserPrincipal principal = userDetailsService.toPrincipal(user);
        UUID familyId = existingFamilyId == null ? UUID.randomUUID() : existingFamilyId;
        String accessToken = jwtService.generateAccessToken(principal);
        String refreshToken = jwtService.generateRefreshToken(principal, familyId);
        refreshTokenRepository.save(RefreshToken.of(
                user,
                hashToken(refreshToken),
                Instant.now().plusSeconds(jwtService.refreshTokenTtlSeconds()),
                familyId,
                ipAddress
        ));
        return new AuthResponse(
                accessToken,
                refreshToken,
                jwtService.accessTokenTtlSeconds(),
                userMapper.toCurrentUserResponse(user)
        );
    }

    private void revokeFamily(UUID familyId) {
        refreshTokenRepository.findAllByFamilyId(familyId).forEach(token -> {
            token.revoke();
            refreshTokenRepository.save(token);
        });
    }

    private String hashToken(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(token.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException exception) {
            throw new EventZenException(HttpStatus.INTERNAL_SERVER_ERROR, "SYSTEM_ERROR", "SYS-9001", "Unable to hash token");
        }
    }

    private String sendEmailVerification(User user) {
        String token = UUID.randomUUID() + "." + UUID.randomUUID();
        user.setEmailVerificationToken(hashToken(token), Instant.now().plusSeconds(authFeatureProperties.emailVerificationHours() * 3600));
        userRepository.save(user);
        authNotificationService.sendEmailVerificationEmail(user.getEmail(), user.getFirstName(), token);
        return token;
    }

    private User createGoogleUser(GoogleIdentity identity, RoleName requestedRole) {
        User user = userRepository.save(User.register(
                defaultName(identity.givenName()),
                defaultName(identity.familyName()),
                identity.email(),
                passwordEncoder.encode("google-auth-" + UUID.randomUUID()),
                null
        ));
        user.linkGoogleSubject(identity.subject());
        user.markEmailVerified();
        RoleName effectiveRole = requestedRole == null || requestedRole == RoleName.ADMIN ? RoleName.ATTENDEE : requestedRole;
        Role role = roleRepository.findByName(effectiveRole)
                .orElseThrow(() -> new EventZenException(HttpStatus.INTERNAL_SERVER_ERROR, "SYSTEM_ERROR", "SYS-9001", "Default role configuration is missing"));
        userRoleRepository.save(UserRole.of(user, role, user.getId()));
        return userRepository.save(user);
    }

    private String normalizeRequiredValue(String requestedValue, String currentValue, String fieldName) {
        String effectiveValue = requestedValue == null ? currentValue : requestedValue.trim();
        if (effectiveValue == null || effectiveValue.isBlank()) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-1013", fieldName + " cannot be blank");
        }
        return effectiveValue;
    }

    private String normalizeOptionalValue(String requestedValue, String currentValue) {
        if (requestedValue == null) {
            return currentValue;
        }
        String trimmed = requestedValue.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private String defaultName(String value) {
        return value == null || value.isBlank() ? "Google" : value.trim();
    }
}
