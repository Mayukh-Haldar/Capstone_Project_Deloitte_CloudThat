package com.eventzen.auth.config;

import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "auth.bootstrap")
public record AuthBootstrapProperties(
        @NotBlank String adminEmail,
        @NotBlank String adminPassword,
        @NotBlank String adminFirstName,
        @NotBlank String adminLastName
) {
}
