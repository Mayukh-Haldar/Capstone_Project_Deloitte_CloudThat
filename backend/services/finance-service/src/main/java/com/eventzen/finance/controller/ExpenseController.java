package com.eventzen.finance.controller;

import com.eventzen.finance.dto.CreateExpenseRequest;
import com.eventzen.finance.dto.ExpenseResponse;
import com.eventzen.finance.security.AuthenticatedUser;
import com.eventzen.finance.service.ExpenseService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/expenses")
public class ExpenseController {

    private final ExpenseService expenseService;

    public ExpenseController(ExpenseService expenseService) {
        this.expenseService = expenseService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('ADMIN','ORGANIZER')")
    ExpenseResponse logExpense(@Valid @RequestBody CreateExpenseRequest request, @AuthenticationPrincipal AuthenticatedUser actor) {
        return expenseService.logExpense(request, actor);
    }
}
