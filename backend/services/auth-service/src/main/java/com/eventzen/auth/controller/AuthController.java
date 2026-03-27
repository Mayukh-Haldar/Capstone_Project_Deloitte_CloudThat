package com.eventzen.auth.controller;

import com.eventzen.auth.config.AuthFeatureProperties;
import com.eventzen.auth.dto.ApiMessageResponse;
import com.eventzen.auth.dto.AuthResponse;
import com.eventzen.auth.dto.CurrentUserResponse;
import com.eventzen.auth.dto.ForgotPasswordRequest;
import com.eventzen.auth.dto.GoogleSignInRequest;
import com.eventzen.auth.dto.LoginRequest;
import com.eventzen.auth.dto.MfaSetupResponse;
import com.eventzen.auth.dto.MfaVerifyRequest;
import com.eventzen.auth.dto.RefreshTokenRequest;
import com.eventzen.auth.dto.RegisterRequest;
import com.eventzen.auth.dto.ResendVerificationRequest;
import com.eventzen.auth.dto.ResetPasswordRequest;
import com.eventzen.auth.dto.UpdateProfileRequest;
import com.eventzen.auth.dto.VerifyEmailRequest;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.security.CurrentUserPrincipal;
import com.eventzen.auth.service.AuthenticationService;
import com.eventzen.auth.service.ProfileUpdateResult;
import com.eventzen.auth.service.RegisterResult;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthenticationService authenticationService;
    private final AuthFeatureProperties authFeatureProperties;

    public AuthController(AuthenticationService authenticationService, AuthFeatureProperties authFeatureProperties) {
        this.authenticationService = authenticationService;
        this.authFeatureProperties = authFeatureProperties;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request, @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress) {
        RegisterResult result = authenticationService.register(request, ipAddress);
        return withOptionalHeader(ResponseEntity.ok(), "X-Debug-Email-Verification-Token", result.emailVerificationToken()).body(result.response());
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request, @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress) {
        return ResponseEntity.ok(authenticationService.login(request, ipAddress));
    }

    @PostMapping("/google/login")
    public ResponseEntity<AuthResponse> googleLogin(@Valid @RequestBody GoogleSignInRequest request, @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress) {
        return ResponseEntity.ok(authenticationService.signInWithGoogle(request, ipAddress));
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(@Valid @RequestBody RefreshTokenRequest request, @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress) {
        return ResponseEntity.ok(authenticationService.refresh(request, ipAddress));
    }

    @PostMapping("/logout")
    public ResponseEntity<ApiMessageResponse> logout(@Valid @RequestBody RefreshTokenRequest request, @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress) {
        authenticationService.logout(request, ipAddress);
        return ResponseEntity.ok(new ApiMessageResponse("Logout successful"));
    }

    @GetMapping("/me")
    public ResponseEntity<CurrentUserResponse> me(@AuthenticationPrincipal CurrentUserPrincipal principal) {
        User user = principal.getUser();
        return ResponseEntity.ok(authenticationService.currentUser(user.getId()));
    }

    @PostMapping("/mfa/setup")
    public ResponseEntity<MfaSetupResponse> setupMfa(@AuthenticationPrincipal CurrentUserPrincipal principal) {
        return ResponseEntity.ok(authenticationService.setupMfa(principal.getUser().getId()));
    }

    @PostMapping("/mfa/verify")
    public ResponseEntity<ApiMessageResponse> verifyMfa(@AuthenticationPrincipal CurrentUserPrincipal principal, @Valid @RequestBody MfaVerifyRequest request) {
        authenticationService.verifyMfa(principal.getUser().getId(), request);
        return ResponseEntity.ok(new ApiMessageResponse("MFA verified"));
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<ApiMessageResponse> forgotPassword(@Valid @RequestBody ForgotPasswordRequest request, @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress) {
        String debugToken = authenticationService.forgotPassword(request, ipAddress);
        return withOptionalHeader(ResponseEntity.ok(), "X-Debug-Password-Reset-Token", debugToken)
                .body(new ApiMessageResponse("If the email exists, password reset instructions have been sent"));
    }

    @PostMapping("/reset-password")
    public ResponseEntity<ApiMessageResponse> resetPassword(@Valid @RequestBody ResetPasswordRequest request, @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress) {
        authenticationService.resetPassword(request, ipAddress);
        return ResponseEntity.ok(new ApiMessageResponse("Password reset successful"));
    }

    @PostMapping("/email-verification/resend")
    public ResponseEntity<ApiMessageResponse> resendEmailVerification(@Valid @RequestBody ResendVerificationRequest request, @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress) {
        String debugToken = authenticationService.resendEmailVerification(request.email(), ipAddress);
        return withOptionalHeader(ResponseEntity.ok(), "X-Debug-Email-Verification-Token", debugToken)
                .body(new ApiMessageResponse("If the email exists, verification instructions have been sent"));
    }

    @PostMapping("/email-verification/confirm")
    public ResponseEntity<ApiMessageResponse> verifyEmail(@Valid @RequestBody VerifyEmailRequest request, @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress) {
        authenticationService.verifyEmail(request.token(), ipAddress);
        return ResponseEntity.status(HttpStatus.OK).body(new ApiMessageResponse("Email verified"));
    }

    @PatchMapping("/me/profile")
    public ResponseEntity<CurrentUserResponse> updateProfile(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request,
            @RequestHeader(value = "X-Forwarded-For", required = false) String ipAddress
    ) {
        ProfileUpdateResult result = authenticationService.updateMyProfile(principal.getUser().getId(), request, ipAddress);
        return withOptionalHeader(ResponseEntity.ok(), "X-Debug-Email-Verification-Token", result.emailVerificationToken()).body(result.response());
    }

    private <T> ResponseEntity.BodyBuilder withOptionalHeader(ResponseEntity.BodyBuilder builder, String headerName, String headerValue) {
        if (!authFeatureProperties.exposeDebugTokens() || headerValue == null || headerValue.isBlank()) {
            return builder;
        }
        return builder.header(headerName, headerValue);
    }
}
