package com.eventzen.auth.config;

import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "auth.features")
public record AuthFeatureProperties(
        @Min(1) long passwordResetMinutes,
        @Min(1) long emailVerificationHours,
        String googleClientId,
        boolean requireVerifiedEmailForLogin,
        boolean exposeDebugTokens,
        boolean allowDebugGoogleTokens
) {
}
