package com.eventzen.finance.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "finance.notification")
public record NotificationServiceProperties(
        String baseUrl,
        String internalServiceKey
) {
}
