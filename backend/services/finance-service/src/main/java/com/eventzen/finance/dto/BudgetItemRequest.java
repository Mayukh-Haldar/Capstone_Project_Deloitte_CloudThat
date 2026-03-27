package com.eventzen.finance.dto;

import com.eventzen.finance.model.BudgetCategory;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record BudgetItemRequest(
        @NotBlank String title,
        @NotNull BudgetCategory category,
        @NotNull @PositiveOrZero BigDecimal estimatedAmount,
        String notes
) {
}
