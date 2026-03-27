package com.eventzen.finance.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "finance.jwt")
public record JwtProperties(String secret, String issuer) {
}
