package com.eventzen.finance.service;

import com.eventzen.finance.config.NotificationServiceProperties;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class NotificationClient {

    private static final Logger log = LoggerFactory.getLogger(NotificationClient.class);

    private final NotificationServiceProperties properties;
    private final RestClient restClient;

    public NotificationClient(NotificationServiceProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(2));
        requestFactory.setReadTimeout(Duration.ofSeconds(2));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

        public void sendInAppNotification(
            UUID userId,
            String email,
            String eventType,
            String title,
            String body,
            String html,
            Map<String, Object> metadata
        ) {
        try {
            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("eventType", eventType);
            payload.put("recipients", List.of(Map.of(
                "userId", userId.toString(),
                "email", email
            )));
            payload.put("title", title);
            payload.put("body", body);
            payload.put("metadata", metadata);
            if (html != null && !html.isBlank()) {
            payload.put("html", html);
            }

            restClient.post()
                    .uri(properties.baseUrl().replaceAll("/$", "") + "/api/v1/notifications/send")
                    .header("x-internal-service-key", properties.internalServiceKey())
                .body(payload)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception exception) {
            log.warn("Failed to dispatch notification for eventType={}", eventType, exception);
        }
    }
}
