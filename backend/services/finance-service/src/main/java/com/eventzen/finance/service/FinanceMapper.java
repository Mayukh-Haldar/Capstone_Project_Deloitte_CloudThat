package com.eventzen.finance.service;

import com.eventzen.finance.dto.BudgetAlertResponse;
import com.eventzen.finance.dto.BudgetItemResponse;
import com.eventzen.finance.dto.BudgetResponse;
import com.eventzen.finance.dto.ExpenseResponse;
import com.eventzen.finance.dto.PaymentResponse;
import com.eventzen.finance.dto.TransactionResponse;
import com.eventzen.finance.model.Budget;
import com.eventzen.finance.model.BudgetItem;
import com.eventzen.finance.model.Expense;
import com.eventzen.finance.model.Payment;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class FinanceMapper {

    private final RazorpayClient razorpayClient;

    public FinanceMapper(RazorpayClient razorpayClient) {
        this.razorpayClient = razorpayClient;
    }

    public BudgetResponse toBudgetResponse(Budget budget, List<BudgetAlertResponse> alerts) {
        BigDecimal denominator = budget.getApprovedTotal().compareTo(BigDecimal.ZERO) > 0
                ? budget.getApprovedTotal()
                : budget.getEstimatedTotal();
        BigDecimal utilization = denominator.compareTo(BigDecimal.ZERO) == 0
                ? BigDecimal.ZERO
                : budget.getActualTotal().multiply(BigDecimal.valueOf(100)).divide(denominator, 2, RoundingMode.HALF_UP);
        return new BudgetResponse(
                budget.getId(),
                budget.getEventId(),
                budget.getEventName(),
                budget.getCurrency(),
                budget.getStatus(),
                budget.getEstimatedTotal(),
                budget.getApprovedTotal(),
                budget.getActualTotal(),
                utilization,
                budget.getCreatedAt(),
                budget.getApprovedAt(),
                budget.getApprovedByUserId(),
                budget.getItems().stream().map(this::toBudgetItemResponse).toList(),
                alerts
        );
    }

    public BudgetItemResponse toBudgetItemResponse(BudgetItem item) {
        return new BudgetItemResponse(
                item.getId(),
                item.getTitle(),
                item.getCategory(),
                item.getEstimatedAmount(),
                item.getActualAmount(),
                item.getNotes()
        );
    }

    public ExpenseResponse toExpenseResponse(Expense expense) {
        return new ExpenseResponse(
                expense.getId(),
                expense.getEventId(),
                expense.getEventName(),
                expense.getCategory(),
                expense.getAmount(),
                expense.getCurrency(),
                expense.getVendorName(),
                expense.getDescription(),
                expense.getReceiptUrl(),
                expense.getExpenseDate(),
                expense.getCreatedAt()
        );
    }

    public PaymentResponse toPaymentResponse(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getEventId(),
                payment.getEventName(),
                payment.getRegistrationId(),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getPaymentMethod(),
                payment.getPaymentStatus(),
                payment.getGatewayReference(),
                payment.getGatewayOrderId(),
                payment.getGatewayPaymentId(),
                razorpayClient.enabled() ? razorpayClient.keyId() : null,
                payment.getAmount().multiply(BigDecimal.valueOf(100)).longValue(),
                razorpayClient.checkoutName(),
                razorpayClient.checkoutDescription(),
                payment.getCustomerEmail(),
                payment.getDescription(),
                payment.getInvoiceNumber(),
                payment.getInvoiceUrl(),
                payment.getPaymentDate(),
                payment.getCreatedAt()
        );
    }

    public List<TransactionResponse> toTransactions(List<Payment> payments, List<Expense> expenses) {
        return java.util.stream.Stream.concat(
                        payments.stream().map(this::toTransaction),
                        expenses.stream().map(this::toTransaction))
                .sorted(Comparator.comparing(TransactionResponse::occurredAt).reversed())
                .toList();
    }

    private TransactionResponse toTransaction(Payment payment) {
        return new TransactionResponse(
                payment.getId(),
                "PAYMENT",
                payment.getPaymentMethod().name(),
                payment.getCustomerEmail(),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getPaymentStatus().name(),
                payment.getGatewayReference(),
                payment.getDescription(),
                payment.getPaymentDate() != null ? payment.getPaymentDate() : payment.getCreatedAt()
        );
    }

    private TransactionResponse toTransaction(Expense expense) {
        OffsetDateTime occurredAt = expense.getExpenseDate().atStartOfDay().atOffset(ZoneOffset.UTC);
        return new TransactionResponse(
                expense.getId(),
                "EXPENSE",
                expense.getCategory().name(),
                expense.getVendorName(),
                expense.getAmount(),
                expense.getCurrency(),
                "LOGGED",
                expense.getId().toString(),
                expense.getDescription(),
                occurredAt
        );
    }
}
