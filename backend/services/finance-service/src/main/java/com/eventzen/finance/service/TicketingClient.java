package com.eventzen.finance.service;

import com.eventzen.finance.config.TicketingServiceProperties;
import java.time.Duration;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class TicketingClient {

    private static final Logger log = LoggerFactory.getLogger(TicketingClient.class);

    private final TicketingServiceProperties properties;
    private final RestClient restClient;

    public TicketingClient(TicketingServiceProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(2));
        requestFactory.setReadTimeout(Duration.ofSeconds(3));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    public void confirmRegistrationPayment(UUID registrationId) {
        if (registrationId == null) {
            return;
        }

        try {
            restClient.post()
                    .uri(properties.baseUrl().replaceAll("/$", "") + "/api/v1/internal/registrations/" + registrationId + "/confirm-payment")
                    .header("x-internal-service-key", properties.internalServiceKey())
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception exception) {
            log.warn("Failed to confirm ticketing registration after payment verification for registrationId={}", registrationId, exception);
            throw exception;
        }
    }
}
