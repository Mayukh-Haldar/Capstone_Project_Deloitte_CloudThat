package com.eventzen.finance.dto;

import com.eventzen.finance.model.BudgetCategory;
import java.math.BigDecimal;
import java.util.UUID;

public record BudgetItemResponse(
        UUID id,
        String title,
        BudgetCategory category,
        BigDecimal estimatedAmount,
        BigDecimal actualAmount,
        String notes
) {
}
