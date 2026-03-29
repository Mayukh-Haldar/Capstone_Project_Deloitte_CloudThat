package com.eventzen.finance.service;

import com.eventzen.finance.dto.BudgetAlertResponse;
import com.eventzen.finance.dto.BudgetResponse;
import com.eventzen.finance.dto.FinancialReportResponse;
import com.eventzen.finance.dto.TransactionResponse;
import com.eventzen.finance.model.Budget;
import com.eventzen.finance.model.Expense;
import com.eventzen.finance.model.Payment;
import com.eventzen.finance.model.PaymentStatus;
import com.eventzen.finance.repository.ExpenseRepository;
import com.eventzen.finance.repository.PaymentRepository;
import com.eventzen.finance.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FinancialReportService {

    private final BudgetService budgetService;
    private final PaymentRepository paymentRepository;
    private final ExpenseRepository expenseRepository;
    private final FinanceMapper financeMapper;

    public FinancialReportService(
            BudgetService budgetService,
            PaymentRepository paymentRepository,
            ExpenseRepository expenseRepository,
            FinanceMapper financeMapper
    ) {
        this.budgetService = budgetService;
        this.paymentRepository = paymentRepository;
        this.expenseRepository = expenseRepository;
        this.financeMapper = financeMapper;
    }

    @Transactional(readOnly = true)
    public FinancialReportResponse getEventFinancialReport(UUID eventId, AuthenticatedUser actor) {
        Budget budget = budgetService.findBudgetByEventId(eventId).orElse(null);
        BudgetResponse budgetResponse = null;
        String eventName = "Event Finance Overview";
        if (budget != null) {
            budgetResponse = budgetService.getBudgetForEvent(eventId, actor);
            eventName = budget.getEventName();
        }
        BigDecimal totalRevenue = paymentRepository.totalByEventIdAndStatus(eventId, PaymentStatus.SUCCEEDED);
        BigDecimal ticketBookingRevenue = paymentRepository.totalTicketRevenueByEventIdAndStatus(eventId, PaymentStatus.SUCCEEDED);
        BigDecimal venueBookingRevenue = paymentRepository.totalVenueRevenueByEventIdAndStatus(eventId, PaymentStatus.SUCCEEDED);
        BigDecimal totalExpenses = expenseRepository.totalByEventId(eventId);
        BigDecimal netProfit = totalRevenue.subtract(totalExpenses);
        List<Payment> payments = paymentRepository.findTop10ByEventIdOrderByCreatedAtDesc(eventId);
        List<Expense> expenses = expenseRepository.findTop10ByEventIdOrderByExpenseDateDescCreatedAtDesc(eventId);
        if (!payments.isEmpty()) {
            eventName = payments.get(0).getEventName();
        } else if (!expenses.isEmpty()) {
            eventName = expenses.get(0).getEventName();
        }
        List<TransactionResponse> transactions = financeMapper.toTransactions(payments, expenses).stream().limit(10).toList();
        List<BudgetAlertResponse> alerts = new ArrayList<>(budgetResponse != null ? budgetResponse.alerts() : List.of());
        long failedPayments = paymentRepository.countByEventIdAndPaymentStatus(eventId, PaymentStatus.FAILED);
        if (failedPayments > 0) {
            alerts.add(new BudgetAlertResponse("payment.failed", "MEDIUM",
                    failedPayments + " payment(s) have failed for " + eventName + "."));
        }

        return new FinancialReportResponse(
                eventId,
                eventName,
                budgetResponse,
                totalRevenue,
                ticketBookingRevenue,
                venueBookingRevenue,
                totalExpenses,
                netProfit,
                paymentRepository.countByEventIdAndPaymentStatus(eventId, PaymentStatus.SUCCEEDED),
                expenseRepository.countByEventId(eventId),
                transactions,
                alerts,
                OffsetDateTime.now()
        );
    }
}
