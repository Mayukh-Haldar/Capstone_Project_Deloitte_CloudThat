package com.eventzen.auth.config;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "auth.jwt")
public record JwtProperties(
        @NotBlank String secret,
        @NotBlank String issuer,
        @Min(1) long accessTokenMinutes,
        @Min(1) long refreshTokenDays
) {
}
