package com.eventzen.finance.dto;

import com.eventzen.finance.model.BudgetCategory;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

public record ExpenseResponse(
        UUID id,
        UUID eventId,
        String eventName,
        BudgetCategory category,
        BigDecimal amount,
        String currency,
        String vendorName,
        String description,
        String receiptUrl,
        LocalDate expenseDate,
        OffsetDateTime createdAt
) {
}
