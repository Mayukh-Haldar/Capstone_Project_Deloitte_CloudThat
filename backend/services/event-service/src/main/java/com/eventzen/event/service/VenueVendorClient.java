package com.eventzen.event.service;

import com.eventzen.event.config.EventClientProperties;
import com.eventzen.event.dto.VenueBookingRequest;
import com.eventzen.event.exception.EventServiceException;
import com.eventzen.event.security.AuthenticatedUser;
import java.time.OffsetDateTime;
import java.util.List;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class VenueVendorClient {

    private final RestClient restClient;
    private final EventClientProperties properties;

    public VenueVendorClient(RestClient restClient, EventClientProperties properties) {
        this.restClient = restClient;
        this.properties = properties;
    }

    public void ensureVenueAvailability(String authorization, AuthenticatedUser actor, VenueBookingRequest request, OffsetDateTime startTime, OffsetDateTime endTime) {
        String hallQuery = request.hallIds() == null || request.hallIds().isEmpty() ? "" : "&hallIds=" + String.join(",", request.hallIds());
        String url = "%s/api/v1/venues/%s/availability?start=%s&end=%s%s".formatted(
                properties.venueVendorBaseUrl(),
                request.venueId(),
                startTime,
                endTime,
                hallQuery
        );
        try {
            AvailabilityResponse response = restClient.get()
                    .uri(url)
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .header("x-user-id", actor.id().toString())
                    .header("x-user-email", actor.email())
                    .header("x-user-roles", String.join(",", actor.roles()))
                    .retrieve()
                    .body(AvailabilityResponse.class);
            if (response == null || !response.isAvailable()) {
                throw new EventServiceException(HttpStatus.CONFLICT, "EVENT-409", "Selected venue is not available for the requested schedule");
            }
        } catch (RestClientException exception) {
            throw new EventServiceException(HttpStatus.BAD_GATEWAY, "EVENT-502", "Venue availability check failed");
        }
    }

    public BookingResult createBooking(
            String authorization,
            AuthenticatedUser actor,
            String eventId,
            java.util.UUID organizerId,
            String organizerEmail,
            VenueBookingRequest request,
            OffsetDateTime startTime,
            OffsetDateTime endTime
    ) {
        try {
            BookingResponse response = restClient.post()
                    .uri(properties.venueVendorBaseUrl() + "/api/v1/venues/" + request.venueId() + "/book")
                    .header(HttpHeaders.AUTHORIZATION, authorization)
                    .header("x-user-id", actor.id().toString())
                    .header("x-user-email", actor.email())
                    .header("x-user-roles", String.join(",", actor.roles()))
                    .body(new CreateBookingRequest(
                            eventId,
                            startTime.toString(),
                            endTime.toString(),
                            request.hallIds() == null ? List.of() : request.hallIds(),
                            organizerId == null ? null : organizerId.toString(),
                            organizerId == null ? null : organizerId.toString(),
                            organizerEmail
                    ))
                    .retrieve()
                    .body(BookingResponse.class);
            if (response == null || response.bookingId() == null) {
                throw new EventServiceException(HttpStatus.BAD_GATEWAY, "EVENT-502", "Venue booking failed");
            }
            return new BookingResult(
                    response.bookingId(),
                    response.paymentStatus(),
                    response.paymentAmount(),
                    response.paymentCurrency()
            );
        } catch (RestClientException exception) {
            throw new EventServiceException(HttpStatus.BAD_GATEWAY, "EVENT-502", "Venue booking failed");
        }
    }

    private record AvailabilityResponse(String venueId, boolean isAvailable, List<Object> conflicts) {
    }

    private record CreateBookingRequest(
            String eventId,
            String bookingStart,
            String bookingEnd,
            List<String> hallIds,
            String vendorId,
            String bookingOwnerId,
            String bookingOwnerEmail
    ) {
    }

    public record BookingResult(String bookingId, String paymentStatus, java.math.BigDecimal paymentAmount, String paymentCurrency) {
        public boolean isPaymentPending() {
            return "PENDING".equalsIgnoreCase(paymentStatus);
        }
    }

    private record BookingResponse(String bookingId, String paymentStatus, java.math.BigDecimal paymentAmount, String paymentCurrency) {
    }
}
