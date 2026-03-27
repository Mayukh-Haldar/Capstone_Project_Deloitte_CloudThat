package com.eventzen.finance.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "finance.storage")
public record StorageProperties(
        boolean enabled,
        String endpoint,
        String accessKey,
        String secretKey,
        String bucket,
        String publicBaseUrl,
        String invoicesPrefix
) {
}
