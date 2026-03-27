package com.eventzen.finance.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;

public record ApproveBudgetRequest(@NotNull @PositiveOrZero BigDecimal approvedTotal) {
}
