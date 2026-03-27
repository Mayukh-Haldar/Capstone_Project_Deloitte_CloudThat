package com.eventzen.finance.service;

import com.eventzen.finance.dto.CreateExpenseRequest;
import com.eventzen.finance.dto.ExpenseResponse;
import com.eventzen.finance.exception.FinanceServiceException;
import com.eventzen.finance.model.Budget;
import com.eventzen.finance.model.Expense;
import com.eventzen.finance.repository.BudgetRepository;
import com.eventzen.finance.repository.ExpenseRepository;
import com.eventzen.finance.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExpenseService {

    private final ExpenseRepository expenseRepository;
    private final BudgetRepository budgetRepository;
    private final BudgetService budgetService;
    private final FinanceMapper financeMapper;

    public ExpenseService(
            ExpenseRepository expenseRepository,
            BudgetRepository budgetRepository,
            BudgetService budgetService,
            FinanceMapper financeMapper
    ) {
        this.expenseRepository = expenseRepository;
        this.budgetRepository = budgetRepository;
        this.budgetService = budgetService;
        this.financeMapper = financeMapper;
    }

    @Transactional
    public ExpenseResponse logExpense(CreateExpenseRequest request, AuthenticatedUser actor) {
        if (!actor.hasRole("ADMIN") && !actor.hasRole("ORGANIZER")) {
            throw new FinanceServiceException(HttpStatus.FORBIDDEN, "AUTH-403", "Only organizers and admins can log expenses");
        }

        Budget budget = budgetRepository.findByEventId(request.eventId())
                .orElseThrow(() -> new FinanceServiceException(HttpStatus.NOT_FOUND, "FIN-4041", "Create a budget before logging expenses"));
        if (!actor.hasRole("ADMIN") && !budget.getCreatedByUserId().equals(actor.id())) {
            throw new FinanceServiceException(HttpStatus.FORBIDDEN, "AUTH-403", "Insufficient permissions for resource");
        }

        BigDecimal currentTotal = expenseRepository.totalByEventId(request.eventId());
        BigDecimal threshold = budget.getApprovedTotal().compareTo(BigDecimal.ZERO) > 0 ? budget.getApprovedTotal() : budget.getEstimatedTotal();
        if (threshold.compareTo(BigDecimal.ZERO) > 0 && currentTotal.add(request.amount()).compareTo(threshold) > 0) {
            throw new FinanceServiceException(HttpStatus.UNPROCESSABLE_ENTITY, "FIN-4001", "Expense exceeds approved budget");
        }

        Expense expense = new Expense();
        expense.setId(UUID.randomUUID());
        expense.setEventId(request.eventId());
        expense.setEventName(request.eventName());
        expense.setCategory(request.category());
        expense.setAmount(request.amount());
        expense.setCurrency(request.currency().toUpperCase());
        expense.setVendorName(request.vendorName());
        expense.setDescription(request.description());
        expense.setReceiptUrl(request.receiptUrl());
        expense.setExpenseDate(request.expenseDate());
        expense.setCreatedByUserId(actor.id());

        Expense saved = expenseRepository.save(expense);
        budgetService.refreshBudgetActuals(budget);
        budgetRepository.save(budget);
        return financeMapper.toExpenseResponse(saved);
    }
}
