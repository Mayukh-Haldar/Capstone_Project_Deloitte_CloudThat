package com.eventzen.finance.dto;

import com.eventzen.finance.model.BudgetCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record CreateExpenseRequest(
        @NotNull UUID eventId,
        @NotBlank String eventName,
        @NotNull BudgetCategory category,
        @NotNull @Positive BigDecimal amount,
        @NotBlank String currency,
        @NotBlank String vendorName,
        @NotBlank String description,
        String receiptUrl,
        @NotNull LocalDate expenseDate
) {
}
