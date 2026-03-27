package com.eventzen.finance.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record CreateBudgetRequest(
        @NotBlank String eventName,
        @NotBlank String currency,
        @Valid @NotEmpty List<BudgetItemRequest> items
) {
}
