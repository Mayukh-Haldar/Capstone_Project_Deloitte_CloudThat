package com.eventzen.finance.dto;

import com.eventzen.finance.model.BudgetStatus;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record BudgetResponse(
        UUID id,
        UUID eventId,
        String eventName,
        String currency,
        BudgetStatus status,
        BigDecimal estimatedTotal,
        BigDecimal approvedTotal,
        BigDecimal actualTotal,
        BigDecimal utilizationPercent,
        OffsetDateTime createdAt,
        OffsetDateTime approvedAt,
        UUID approvedByUserId,
        List<BudgetItemResponse> items,
        List<BudgetAlertResponse> alerts
) {
}
