package com.eventzen.finance.dto;

import com.eventzen.finance.model.PaymentMethod;
import com.eventzen.finance.model.PaymentStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record PaymentResponse(
        UUID id,
        UUID eventId,
        String eventName,
        UUID registrationId,
        UUID venueBookingId,
        BigDecimal amount,
        String currency,
        PaymentMethod paymentMethod,
        PaymentStatus status,
        String gatewayReference,
        String gatewayOrderId,
        String gatewayPaymentId,
        String checkoutKeyId,
        Long checkoutAmount,
        String checkoutName,
        String checkoutDescription,
        String customerEmail,
        String description,
        String invoiceNumber,
        String invoiceUrl,
        OffsetDateTime paymentDate,
        OffsetDateTime createdAt
) {
}
