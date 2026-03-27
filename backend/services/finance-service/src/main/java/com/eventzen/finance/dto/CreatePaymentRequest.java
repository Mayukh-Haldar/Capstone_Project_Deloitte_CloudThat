package com.eventzen.finance.dto;

import com.eventzen.finance.model.PaymentMethod;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.util.UUID;

public record CreatePaymentRequest(
        @NotNull UUID eventId,
        @NotBlank String eventName,
        UUID registrationId,
        @NotNull @Positive BigDecimal amount,
        @NotBlank String currency,
        @NotNull PaymentMethod paymentMethod,
        @Email String customerEmail,
        @NotBlank String description,
        Boolean simulateFailure
) {
    public boolean shouldSimulateFailure() {
        return Boolean.TRUE.equals(simulateFailure);
    }
}
