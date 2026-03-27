package com.eventzen.finance.service;

import com.eventzen.finance.dto.ApproveBudgetRequest;
import com.eventzen.finance.dto.BudgetAlertResponse;
import com.eventzen.finance.dto.BudgetItemRequest;
import com.eventzen.finance.dto.BudgetResponse;
import com.eventzen.finance.dto.CreateBudgetRequest;
import com.eventzen.finance.exception.FinanceServiceException;
import com.eventzen.finance.model.Budget;
import com.eventzen.finance.model.BudgetItem;
import com.eventzen.finance.model.BudgetStatus;
import com.eventzen.finance.repository.BudgetRepository;
import com.eventzen.finance.repository.ExpenseRepository;
import com.eventzen.finance.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class BudgetService {

    private final BudgetRepository budgetRepository;
    private final ExpenseRepository expenseRepository;
    private final FinanceMapper financeMapper;

    public BudgetService(BudgetRepository budgetRepository, ExpenseRepository expenseRepository, FinanceMapper financeMapper) {
        this.budgetRepository = budgetRepository;
        this.expenseRepository = expenseRepository;
        this.financeMapper = financeMapper;
    }

    @Transactional
    public BudgetResponse createBudget(UUID eventId, CreateBudgetRequest request, AuthenticatedUser actor) {
        budgetRepository.findByEventId(eventId).ifPresent(existing -> {
            throw new FinanceServiceException(HttpStatus.CONFLICT, "FIN-4003", "Budget already exists for this event");
        });

        Budget budget = new Budget();
        budget.setId(UUID.randomUUID());
        budget.setEventId(eventId);
        budget.setEventName(request.eventName());
        budget.setCurrency(request.currency().toUpperCase());
        budget.setStatus(BudgetStatus.DRAFT);
        budget.setCreatedByUserId(actor.id());
        budget.setActualTotal(BigDecimal.ZERO);
        budget.setApprovedTotal(BigDecimal.ZERO);

        BigDecimal estimatedTotal = BigDecimal.ZERO;
        for (BudgetItemRequest itemRequest : request.items()) {
            BudgetItem item = new BudgetItem();
            item.setTitle(itemRequest.title());
            item.setCategory(itemRequest.category());
            item.setEstimatedAmount(itemRequest.estimatedAmount());
            item.setActualAmount(BigDecimal.ZERO);
            item.setNotes(itemRequest.notes());
            budget.addItem(item);
            estimatedTotal = estimatedTotal.add(itemRequest.estimatedAmount());
        }
        budget.setEstimatedTotal(estimatedTotal);

        Budget saved = budgetRepository.save(budget);
        return financeMapper.toBudgetResponse(saved, buildAlerts(saved));
    }

    @Transactional(readOnly = true)
    public BudgetResponse getBudgetForEvent(UUID eventId, AuthenticatedUser actor) {
        Budget budget = requireBudgetByEventId(eventId);
        assertCanAccess(budget, actor);
        refreshBudgetActuals(budget);
        return financeMapper.toBudgetResponse(budget, buildAlerts(budget));
    }

    @Transactional
    public BudgetResponse approveBudget(UUID budgetId, ApproveBudgetRequest request, AuthenticatedUser actor) {
        if (!actor.hasRole("ADMIN")) {
            throw new FinanceServiceException(HttpStatus.FORBIDDEN, "AUTH-403", "Only admins can approve budgets");
        }
        Budget budget = requireBudget(budgetId);
        budget.setApprovedTotal(request.approvedTotal());
        budget.setStatus(BudgetStatus.APPROVED);
        budget.setApprovedAt(OffsetDateTime.now());
        budget.setApprovedByUserId(actor.id());
        refreshBudgetActuals(budget);
        return financeMapper.toBudgetResponse(budgetRepository.save(budget), buildAlerts(budget));
    }

    @Transactional
    public BudgetResponse addBudgetItem(UUID budgetId, BudgetItemRequest request, AuthenticatedUser actor) {
        Budget budget = requireBudget(budgetId);
        assertCanAccess(budget, actor);

        BudgetItem item = new BudgetItem();
        item.setTitle(request.title());
        item.setCategory(request.category());
        item.setEstimatedAmount(request.estimatedAmount());
        item.setActualAmount(BigDecimal.ZERO);
        item.setNotes(request.notes());
        budget.addItem(item);
        budget.setEstimatedTotal(budget.getEstimatedTotal().add(request.estimatedAmount()));

        refreshBudgetActuals(budget);
        return financeMapper.toBudgetResponse(budgetRepository.save(budget), buildAlerts(budget));
    }

    @Transactional
    public void refreshBudgetActuals(Budget budget) {
        BigDecimal actualTotal = expenseRepository.totalByEventId(budget.getEventId());
        budget.setActualTotal(actualTotal);
        for (BudgetItem item : budget.getItems()) {
            BigDecimal itemActual = expenseRepository.totalByEventIdAndCategory(budget.getEventId(), item.getCategory());
            item.setActualAmount(itemActual);
        }
    }

    public List<BudgetAlertResponse> buildAlerts(Budget budget) {
        List<BudgetAlertResponse> alerts = new ArrayList<>();
        BigDecimal thresholdBase = budget.getApprovedTotal().compareTo(BigDecimal.ZERO) > 0
                ? budget.getApprovedTotal()
                : budget.getEstimatedTotal();
        if (thresholdBase.compareTo(BigDecimal.ZERO) > 0) {
            BigDecimal utilization = budget.getActualTotal().divide(thresholdBase, 4, RoundingMode.HALF_UP);
            if (utilization.compareTo(BigDecimal.ONE) >= 0) {
                alerts.add(new BudgetAlertResponse("budget.alert.threshold", "HIGH",
                        "Budget is fully utilized or overrun for " + budget.getEventName() + "."));
            } else if (utilization.compareTo(new BigDecimal("0.80")) >= 0) {
                alerts.add(new BudgetAlertResponse("budget.alert.threshold", "MEDIUM",
                        "Budget utilization crossed 80% for " + budget.getEventName() + "."));
            }
        }
        return alerts;
    }

    @Transactional(readOnly = true)
    public Budget requireBudget(UUID budgetId) {
        return budgetRepository.findById(budgetId)
                .orElseThrow(() -> new FinanceServiceException(HttpStatus.NOT_FOUND, "FIN-4041", "Budget not found"));
    }

    @Transactional(readOnly = true)
    public Budget requireBudgetByEventId(UUID eventId) {
        return budgetRepository.findByEventId(eventId)
                .orElseThrow(() -> new FinanceServiceException(HttpStatus.NOT_FOUND, "FIN-4041", "Budget not found for event"));
    }

    @Transactional(readOnly = true)
    public Optional<Budget> findBudgetByEventId(UUID eventId) {
        return budgetRepository.findByEventId(eventId);
    }

    private void assertCanAccess(Budget budget, AuthenticatedUser actor) {
        if (actor.hasRole("ADMIN")) {
            return;
        }
        if (!actor.hasRole("ORGANIZER") || !budget.getCreatedByUserId().equals(actor.id())) {
            throw new FinanceServiceException(HttpStatus.FORBIDDEN, "AUTH-403", "Insufficient permissions for resource");
        }
    }
}
