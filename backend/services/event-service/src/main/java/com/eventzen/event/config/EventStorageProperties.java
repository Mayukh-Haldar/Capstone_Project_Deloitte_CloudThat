package com.eventzen.event.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "event.storage")
public record EventStorageProperties(
        boolean enabled,
        String endpoint,
        String accessKey,
        String secretKey,
        String bucket,
        String publicBaseUrl,
        String eventBannersPrefix,
        String speakerPhotosPrefix
) {
}
