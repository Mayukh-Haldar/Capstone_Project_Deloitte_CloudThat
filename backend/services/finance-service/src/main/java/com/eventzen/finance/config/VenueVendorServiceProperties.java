package com.eventzen.finance.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "finance.venue-vendor")
public record VenueVendorServiceProperties(
        String baseUrl,
        String internalServiceKey
) {
}
