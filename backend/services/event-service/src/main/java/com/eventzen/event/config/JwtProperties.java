package com.eventzen.event.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "event.jwt")
public record JwtProperties(String secret, String issuer) {
}
