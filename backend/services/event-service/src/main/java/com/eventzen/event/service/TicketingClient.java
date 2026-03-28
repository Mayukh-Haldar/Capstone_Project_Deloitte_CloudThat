package com.eventzen.event.service;

import com.eventzen.event.config.EventClientProperties;
import com.eventzen.event.security.AuthenticatedUser;
import com.eventzen.event.service.NotificationClient.Recipient;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * Internal HTTP client for fetching attendee (registration) info from the ticketing service.
 */
@Component
public class TicketingClient {

    private static final Logger log = LoggerFactory.getLogger(TicketingClient.class);

    private final RestClient restClient;
    private final EventClientProperties properties;

    public TicketingClient(RestClient restClient, EventClientProperties properties) {
        this.restClient = restClient;
        this.properties = properties;
    }

    /**
     * Returns the list of confirmed/pending attendees for an event.
     * Uses the caller's JWT when available and also forwards local-dev fallback headers so
     * ticketing lookups still work behind nginx/dev auth.
     * Returns an empty list on any error to keep disable/enable operations non-blocking.
     */
    public List<Recipient> getAttendees(UUID eventId, AuthenticatedUser actor, String authorization) {
        try {
            List<RegistrationSummary> registrations = restClient.get()
                .uri(properties.ticketingBaseUrl() + "/api/v1/events/" + eventId + "/registrations")
                    .headers(headers -> applyAuthHeaders(headers, actor, authorization))
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() {});
            if (registrations == null || registrations.isEmpty()) {
                return List.of();
            }

            var recipientsByUserId = new LinkedHashMap<String, Recipient>();
            for (RegistrationSummary registration : registrations) {
                if (!isActiveRegistration(registration.status())) {
                    continue;
                }
                if (registration.attendeeUserId() == null || registration.attendeeUserId().isBlank()) {
                    continue;
                }
                if (registration.attendeeEmail() == null || registration.attendeeEmail().isBlank()) {
                    continue;
                }

                recipientsByUserId.putIfAbsent(
                        registration.attendeeUserId(),
                        new Recipient(registration.attendeeUserId(), registration.attendeeEmail().trim()));
            }

            List<Recipient> recipients = List.copyOf(recipientsByUserId.values());
            log.info("Fetched {} attendee recipients for event {}", recipients.size(), eventId);
            return recipients;
        } catch (RestClientException ex) {
            log.warn("Failed to fetch attendees for event {} from ticketing service: {}", eventId, ex.getMessage());
            return List.of();
        } catch (Exception ex) {
            log.warn("Unexpected error fetching attendees for event {}: {}", eventId, ex.getMessage());
            return List.of();
        }
    }

    private void applyAuthHeaders(HttpHeaders headers, AuthenticatedUser actor, String authorization) {
        if (authorization != null && !authorization.isBlank()) {
            headers.set(HttpHeaders.AUTHORIZATION, authorization);
        }
        if (properties.notificationInternalServiceKey() != null && !properties.notificationInternalServiceKey().isBlank()) {
            headers.set("x-internal-service-key", properties.notificationInternalServiceKey());
        }
        if (actor == null) {
            return;
        }

        headers.set("x-user-id", actor.id().toString());
        if (actor.email() != null && !actor.email().isBlank()) {
            headers.set("x-user-email", actor.email());
        }
        if (actor.roles() != null && !actor.roles().isEmpty()) {
            headers.set("x-user-roles", String.join(",", actor.roles()));
        }
    }

    private boolean isActiveRegistration(String status) {
        return status == null || !"CANCELED".equalsIgnoreCase(status.trim().toUpperCase(Locale.ROOT));
    }

    private record RegistrationSummary(String status, String attendeeUserId, String attendeeEmail) {}
}
