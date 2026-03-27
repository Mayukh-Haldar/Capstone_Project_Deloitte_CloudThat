package com.eventzen.finance.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

public record TransactionResponse(
        UUID id,
        String type,
        String category,
        String counterparty,
        BigDecimal amount,
        String currency,
        String status,
        String reference,
        String description,
        OffsetDateTime occurredAt
) {
}
