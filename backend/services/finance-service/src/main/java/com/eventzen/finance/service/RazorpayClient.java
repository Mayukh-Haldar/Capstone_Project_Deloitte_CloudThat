package com.eventzen.finance.service;

import com.eventzen.finance.config.RazorpayProperties;
import com.eventzen.finance.exception.FinanceServiceException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class RazorpayClient {

    private final RazorpayProperties properties;
    private final RestClient restClient;

    public RazorpayClient(RazorpayProperties properties) {
        this.properties = properties;
        this.restClient = RestClient.builder()
                .baseUrl("https://api.razorpay.com/v1")
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + basicAuth(properties))
                .build();
    }

    public RazorpayOrderResponse createOrder(BigDecimal amount, String currency, String receipt) {
        if (!properties.enabled()) {
            throw new FinanceServiceException(HttpStatus.SERVICE_UNAVAILABLE, "FIN-4004", "Razorpay is not enabled");
        }
        if (!StringUtils.hasText(properties.keyId()) || !StringUtils.hasText(properties.keySecret())) {
            throw new FinanceServiceException(HttpStatus.SERVICE_UNAVAILABLE, "FIN-4006", "Razorpay API keys are missing");
        }
        long amountInSubunits = amount.multiply(BigDecimal.valueOf(100)).setScale(0, RoundingMode.HALF_UP).longValueExact();
        try {
            RazorpayOrderResponse order = restClient.post()
                    .uri("/orders")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(new RazorpayOrderRequest(amountInSubunits, currency, receipt))
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), (request, response) -> {
                        throw new FinanceServiceException(HttpStatus.BAD_GATEWAY, "FIN-4005", "Unable to create Razorpay order. Check your test keys and Razorpay account mode.");
                    })
                    .body(RazorpayOrderResponse.class);
            if (order == null || !StringUtils.hasText(order.id())) {
                throw new FinanceServiceException(HttpStatus.BAD_GATEWAY, "FIN-4007", "Razorpay returned an empty order response");
            }
            return order;
        } catch (FinanceServiceException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new FinanceServiceException(HttpStatus.BAD_GATEWAY, "FIN-4008", "Unable to reach Razorpay. Check your internet connection and gateway keys.");
        }
    }

    public RazorpayPaymentResponse fetchPayment(String paymentId) {
        if (!properties.enabled()) {
            throw new FinanceServiceException(HttpStatus.SERVICE_UNAVAILABLE, "FIN-4004", "Razorpay is not enabled");
        }
        if (!StringUtils.hasText(properties.keyId()) || !StringUtils.hasText(properties.keySecret())) {
            throw new FinanceServiceException(HttpStatus.SERVICE_UNAVAILABLE, "FIN-4006", "Razorpay API keys are missing");
        }
        try {
            RazorpayPaymentResponse payment = restClient.get()
                    .uri("/payments/{paymentId}", paymentId)
                    .retrieve()
                    .onStatus(status -> status.is4xxClientError() || status.is5xxServerError(), (request, response) -> {
                        throw new FinanceServiceException(HttpStatus.BAD_GATEWAY, "FIN-4009", "Unable to fetch Razorpay payment details.");
                    })
                    .body(RazorpayPaymentResponse.class);
            if (payment == null || !StringUtils.hasText(payment.id())) {
                throw new FinanceServiceException(HttpStatus.BAD_GATEWAY, "FIN-4010", "Razorpay returned an empty payment response");
            }
            return payment;
        } catch (FinanceServiceException exception) {
            throw exception;
        } catch (RestClientException exception) {
            throw new FinanceServiceException(HttpStatus.BAD_GATEWAY, "FIN-4011", "Unable to reach Razorpay to fetch payment details.");
        }
    }

    public boolean enabled() {
        return properties.enabled();
    }

    public String keyId() {
        return properties.keyId();
    }

    public String checkoutName() {
        return properties.checkoutName();
    }

    public String checkoutDescription() {
        return properties.checkoutDescription();
    }

    private static String basicAuth(RazorpayProperties properties) {
        String value = (properties.keyId() == null ? "" : properties.keyId()) + ":" + (properties.keySecret() == null ? "" : properties.keySecret());
        return Base64.getEncoder().encodeToString(value.getBytes(StandardCharsets.UTF_8));
    }

    public record RazorpayOrderRequest(long amount, String currency, String receipt) {
    }

    public record RazorpayOrderResponse(String id, String entity, long amount, String currency, String status, String receipt) {
    }

    public record RazorpayPaymentResponse(String id, String method) {
    }
}
