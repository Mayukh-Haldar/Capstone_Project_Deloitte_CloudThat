package com.eventzen.finance.dto;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

public record FinancialReportResponse(
        UUID eventId,
        String eventName,
        BudgetResponse budget,
        BigDecimal totalRevenue,
        BigDecimal totalExpenses,
        BigDecimal netProfit,
        long successfulPayments,
        long expenseEntries,
        List<TransactionResponse> recentTransactions,
        List<BudgetAlertResponse> alerts,
        OffsetDateTime generatedAt
) {
}
