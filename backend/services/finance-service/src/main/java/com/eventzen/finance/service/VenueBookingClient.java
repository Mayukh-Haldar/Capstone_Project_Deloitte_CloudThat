package com.eventzen.finance.service;

import com.eventzen.finance.config.VenueVendorServiceProperties;
import com.eventzen.finance.model.Payment;
import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class VenueBookingClient {

    private static final Logger log = LoggerFactory.getLogger(VenueBookingClient.class);

    private final VenueVendorServiceProperties properties;
    private final RestClient restClient;

    public VenueBookingClient(VenueVendorServiceProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(2));
        requestFactory.setReadTimeout(Duration.ofSeconds(3));
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    public void confirmVenueBookingPayment(Payment payment) {
        if (payment.getVenueBookingId() == null) {
            return;
        }

        try {
            restClient.post()
                    .uri(properties.baseUrl().replaceAll("/$", "") + "/api/v1/venues/internal/bookings/" + payment.getVenueBookingId() + "/confirm-payment")
                    .header("x-internal-service-key", properties.internalServiceKey())
                    .body(new ConfirmVenueBookingPaymentRequest(
                            payment.getId(),
                            payment.getGatewayReference(),
                            payment.getInvoiceNumber(),
                            payment.getInvoiceUrl(),
                            payment.getAmount(),
                            payment.getCurrency()
                    ))
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception exception) {
            log.warn("Failed to confirm venue booking after payment verification for bookingId={}", payment.getVenueBookingId(), exception);
            throw exception;
        }
    }

    private record ConfirmVenueBookingPaymentRequest(
            java.util.UUID paymentId,
            String paymentReference,
            String invoiceNumber,
            String invoiceUrl,
            java.math.BigDecimal amount,
            String currency
    ) {
    }
}
