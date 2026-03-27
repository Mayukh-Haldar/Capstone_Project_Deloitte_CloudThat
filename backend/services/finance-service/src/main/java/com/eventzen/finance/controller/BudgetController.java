package com.eventzen.finance.controller;

import com.eventzen.finance.dto.ApproveBudgetRequest;
import com.eventzen.finance.dto.BudgetItemRequest;
import com.eventzen.finance.dto.BudgetResponse;
import com.eventzen.finance.dto.CreateBudgetRequest;
import com.eventzen.finance.security.AuthenticatedUser;
import com.eventzen.finance.service.BudgetService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class BudgetController {

    private final BudgetService budgetService;

    public BudgetController(BudgetService budgetService) {
        this.budgetService = budgetService;
    }

    @PostMapping("/events/{eventId}/budget")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    BudgetResponse createBudget(
            @PathVariable UUID eventId,
            @Valid @RequestBody CreateBudgetRequest request,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        return budgetService.createBudget(eventId, request, actor);
    }

    @GetMapping("/events/{eventId}/budget")
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    BudgetResponse getBudget(@PathVariable UUID eventId, @AuthenticationPrincipal AuthenticatedUser actor) {
        return budgetService.getBudgetForEvent(eventId, actor);
    }

    @PutMapping("/budgets/{budgetId}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    BudgetResponse approveBudget(
            @PathVariable UUID budgetId,
            @Valid @RequestBody ApproveBudgetRequest request,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        return budgetService.approveBudget(budgetId, request, actor);
    }

    @PostMapping("/budgets/{budgetId}/items")
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    BudgetResponse addItem(
            @PathVariable UUID budgetId,
            @Valid @RequestBody BudgetItemRequest request,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        return budgetService.addBudgetItem(budgetId, request, actor);
    }
}
