package com.eventzen.auth.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "auth.notification")
public record NotificationServiceProperties(
        @NotBlank String baseUrl,
        @NotBlank String internalServiceKey
) {
}
