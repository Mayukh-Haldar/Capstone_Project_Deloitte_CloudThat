package com.eventzen.finance.dto;

import com.eventzen.finance.model.PaymentStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record PaymentWebhookRequest(
        @NotBlank String gatewayReference,
        @NotNull PaymentStatus status,
        String gatewayPayload
) {
}
