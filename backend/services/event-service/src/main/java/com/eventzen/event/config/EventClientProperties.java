package com.eventzen.event.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "event.client")
public record EventClientProperties(
        String venueVendorBaseUrl,
        String notificationBaseUrl,
        String ticketingBaseUrl,
        String notificationInternalServiceKey
) {
}
