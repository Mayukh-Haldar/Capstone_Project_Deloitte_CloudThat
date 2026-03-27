package com.eventzen.finance.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "finance.razorpay")
public record RazorpayProperties(
        boolean enabled,
        String keyId,
        String keySecret,
        String checkoutName,
        String checkoutDescription
) {
}
