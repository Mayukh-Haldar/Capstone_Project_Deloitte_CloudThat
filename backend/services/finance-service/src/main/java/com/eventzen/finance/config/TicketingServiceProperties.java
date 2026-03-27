package com.eventzen.finance.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "finance.ticketing")
public record TicketingServiceProperties(
        String baseUrl,
        String internalServiceKey
) {
}
