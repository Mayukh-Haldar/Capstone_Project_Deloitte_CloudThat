package com.eventzen.finance.service;

import com.eventzen.finance.dto.CreateExpenseRequest;
import com.eventzen.finance.dto.ExpenseResponse;
import com.eventzen.finance.exception.FinanceServiceException;
import com.eventzen.finance.model.Budget;
import com.eventzen.finance.model.BudgetCategory;
import com.eventzen.finance.model.BudgetStatus;
import com.eventzen.finance.model.Expense;
import com.eventzen.finance.repository.BudgetRepository;
import com.eventzen.finance.repository.ExpenseRepository;
import com.eventzen.finance.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for ExpenseService (FIN-EX-001 – FIN-EX-007).
 * All dependencies are mocked via Mockito – no Spring context required.
 */
@ExtendWith(MockitoExtension.class)
class ExpenseServiceTest {

    @Mock private ExpenseRepository expenseRepository;
    @Mock private BudgetRepository budgetRepository;
    @Mock private BudgetService budgetService;
    @Mock private FinanceMapper financeMapper;

    private ExpenseService expenseService;

    @BeforeEach
    void setUp() {
        expenseService = new ExpenseService(expenseRepository, budgetRepository, budgetService, financeMapper);
    }

    // ── FIN-EX-001: Log expense – happy path ─────────────────────────────────

    @Test
    void logExpense_success_savesExpenseAndRefreshesActuals() {
        AuthenticatedUser organizer = user("ORGANIZER");
        UUID eventId = UUID.randomUUID();
        Budget budget = sampleBudget(eventId, organizer.id(), new BigDecimal("1000.00"), BigDecimal.ZERO);

        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.of(budget));
        when(expenseRepository.totalByEventId(eventId)).thenReturn(BigDecimal.ZERO);
        when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toExpenseResponse(any(Expense.class))).thenReturn(sampleExpenseResponse(eventId));

        ExpenseResponse response = expenseService.logExpense(
                expenseRequest(eventId, new BigDecimal("200.00")), organizer);

        assertNotNull(response);
        verify(expenseRepository).save(any(Expense.class));
        verify(budgetService).refreshBudgetActuals(budget);
    }

    // ── FIN-EX-002: Log expense – budget not found ───────────────────────────

    @Test
    void logExpense_budgetNotFound_throwsFin4041() {
        UUID eventId = UUID.randomUUID();
        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.empty());

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                expenseService.logExpense(expenseRequest(eventId, new BigDecimal("100.00")), user("ORGANIZER")));

        assertEquals("FIN-4041", ex.getCode());
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
    }

    // ── FIN-EX-003: Log expense – organizer owns a different event's budget ──

    @Test
    void logExpense_organizerDoesNotOwnBudget_throwsForbidden() {
        UUID eventId = UUID.randomUUID();
        Budget budget = sampleBudget(eventId, UUID.randomUUID(), new BigDecimal("1000.00"), BigDecimal.ZERO);
        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.of(budget));

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                expenseService.logExpense(expenseRequest(eventId, new BigDecimal("100.00")), user("ORGANIZER")));

        assertEquals("AUTH-403", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    // ── FIN-EX-004: Log expense – exceeds approved budget (FIN-4001) ─────────

    @Test
    void logExpense_exceedsApprovedBudget_throwsFin4001() {
        AuthenticatedUser organizer = user("ORGANIZER");
        UUID eventId = UUID.randomUUID();
        Budget budget = sampleBudget(eventId, organizer.id(), new BigDecimal("1000.00"), new BigDecimal("500.00"));

        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.of(budget));
        when(expenseRepository.totalByEventId(eventId)).thenReturn(new BigDecimal("400.00")); // 400 + 150 > 500

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                expenseService.logExpense(expenseRequest(eventId, new BigDecimal("150.00")), organizer));

        assertEquals("FIN-4001", ex.getCode());
        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, ex.getStatus());
    }

    // ── FIN-EX-005: Log expense – exactly at budget limit succeeds ───────────

    @Test
    void logExpense_exactlyAtApprovedBudget_succeeds() {
        AuthenticatedUser organizer = user("ORGANIZER");
        UUID eventId = UUID.randomUUID();
        Budget budget = sampleBudget(eventId, organizer.id(), new BigDecimal("1000.00"), new BigDecimal("500.00"));

        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.of(budget));
        when(expenseRepository.totalByEventId(eventId)).thenReturn(new BigDecimal("400.00")); // 400 + 100 = 500 (exact)
        when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toExpenseResponse(any())).thenReturn(sampleExpenseResponse(eventId));

        assertDoesNotThrow(() ->
                expenseService.logExpense(expenseRequest(eventId, new BigDecimal("100.00")), organizer));
    }

    // ── FIN-EX-006: Log expense – admin bypasses ownership check ─────────────

    @Test
    void logExpense_adminCanLogForAnyEvent() {
        AuthenticatedUser admin = user("ADMIN");
        UUID eventId = UUID.randomUUID();
        Budget budget = sampleBudget(eventId, UUID.randomUUID(), new BigDecimal("5000.00"), BigDecimal.ZERO);

        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.of(budget));
        when(expenseRepository.totalByEventId(eventId)).thenReturn(BigDecimal.ZERO);
        when(expenseRepository.save(any(Expense.class))).thenAnswer(inv -> inv.getArgument(0));
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toExpenseResponse(any())).thenReturn(sampleExpenseResponse(eventId));

        assertDoesNotThrow(() ->
                expenseService.logExpense(expenseRequest(eventId, new BigDecimal("200.00")), admin));
    }

    // ── FIN-EX-007: Log expense – no approved total → uses estimated total ───

    @Test
    void logExpense_noApprovedBudget_usesEstimatedTotalAsThreshold() {
        AuthenticatedUser organizer = user("ORGANIZER");
        UUID eventId = UUID.randomUUID();
        // approvedTotal = 0 → service falls back to estimatedTotal = 200
        Budget budget = sampleBudget(eventId, organizer.id(), new BigDecimal("200.00"), BigDecimal.ZERO);

        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.of(budget));
        when(expenseRepository.totalByEventId(eventId)).thenReturn(new BigDecimal("150.00")); // 150 + 100 = 250 > 200

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                expenseService.logExpense(expenseRequest(eventId, new BigDecimal("100.00")), organizer));

        assertEquals("FIN-4001", ex.getCode());
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private AuthenticatedUser user(String role) {
        return new AuthenticatedUser(
                UUID.randomUUID(),
                role.toLowerCase() + "@eventzen.test",
                Set.of(role),
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
    }

    private Budget sampleBudget(UUID eventId, UUID ownerId, BigDecimal estimated, BigDecimal approved) {
        Budget b = new Budget();
        b.setId(UUID.randomUUID());
        b.setEventId(eventId);
        b.setEventName("Test Event");
        b.setCurrency("INR");
        b.setStatus(approved.compareTo(BigDecimal.ZERO) > 0 ? BudgetStatus.APPROVED : BudgetStatus.DRAFT);
        b.setEstimatedTotal(estimated);
        b.setApprovedTotal(approved);
        b.setActualTotal(BigDecimal.ZERO);
        b.setCreatedByUserId(ownerId);
        return b;
    }

    private CreateExpenseRequest expenseRequest(UUID eventId, BigDecimal amount) {
        return new CreateExpenseRequest(
                eventId, "Test Event", BudgetCategory.VENUE,
                amount, "INR", "VendorX", "Test expense", null, LocalDate.now()
        );
    }

    private ExpenseResponse sampleExpenseResponse(UUID eventId) {
        return new ExpenseResponse(
                UUID.randomUUID(), eventId, "Test Event", BudgetCategory.VENUE,
                new BigDecimal("100.00"), "INR", "VendorX", "Test expense",
                null, LocalDate.now(), OffsetDateTime.now()
        );
    }
}
