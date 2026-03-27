package com.eventzen.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "auth.mail")
public record AuthMailProperties(
        String fromEmail,
        String fromName,
        String appBaseUrl
) {
}
