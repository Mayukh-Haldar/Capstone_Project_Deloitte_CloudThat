package com.eventzen.event.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Fire-and-forget Kafka publisher for the EventZen notification service.
 * Publishes JSON notification payloads to Kafka topics (e.g. "event.cancelled", "event.updated")
 * which are consumed by the notification-service Kafka consumer.
 * Failures are logged but never propagate to callers.
 */
@Component
public class NotificationClient {

    private static final Logger log = LoggerFactory.getLogger(NotificationClient.class);

    private final KafkaTemplate<String, String> kafkaTemplate;
    private final ObjectMapper objectMapper;

    public NotificationClient(KafkaTemplate<String, String> kafkaTemplate, ObjectMapper objectMapper) {
        this.kafkaTemplate = kafkaTemplate;
        this.objectMapper = objectMapper;
    }

    /**
     * Publish a notification event to the Kafka topic matching {@code eventType}.
     *
     * @param eventType  Kafka topic name, e.g. "event.cancelled" or "event.updated"
     * @param recipients list of recipients — {@code userId} is required, {@code email} is optional
     * @param title      notification title
     * @param body       plain-text notification body
     * @param metadata   optional key/value metadata stored with each notification
     */
    public void sendNotification(String eventType,
                                 List<Recipient> recipients,
                                 String title,
                                 String body,
                                 Map<String, Object> metadata) {
        if (recipients == null || recipients.isEmpty()) return;
        try {
            var payload = new LinkedHashMap<String, Object>();
            payload.put("eventType", eventType);
            payload.put("recipients", recipients.stream().map(r -> {
                var rm = new LinkedHashMap<String, Object>();
                rm.put("userId", r.userId());
                if (r.email() != null && !r.email().isBlank()) rm.put("email", r.email());
                return rm;
            }).toList());
            payload.put("title", title);
            payload.put("body", body);
            payload.put("metadata", metadata != null ? metadata : Map.of());
            String json = objectMapper.writeValueAsString(payload);
            kafkaTemplate.send(eventType, json);
        } catch (JsonProcessingException ex) {
            log.warn("Failed to serialize notification payload (eventType={}): {}", eventType, ex.getMessage());
        } catch (Exception ex) {
            log.warn("Failed to publish notification to Kafka (eventType={}): {}", eventType, ex.getMessage());
        }
    }

    public record Recipient(String userId, String email) {}
}
