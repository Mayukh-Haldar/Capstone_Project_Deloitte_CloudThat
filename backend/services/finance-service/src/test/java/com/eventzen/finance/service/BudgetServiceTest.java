package com.eventzen.finance.service;

import com.eventzen.finance.dto.ApproveBudgetRequest;
import com.eventzen.finance.dto.BudgetAlertResponse;
import com.eventzen.finance.dto.BudgetItemRequest;
import com.eventzen.finance.dto.BudgetItemResponse;
import com.eventzen.finance.dto.BudgetResponse;
import com.eventzen.finance.dto.CreateBudgetRequest;
import com.eventzen.finance.exception.FinanceServiceException;
import com.eventzen.finance.model.Budget;
import com.eventzen.finance.model.BudgetCategory;
import com.eventzen.finance.model.BudgetStatus;
import com.eventzen.finance.repository.BudgetRepository;
import com.eventzen.finance.repository.ExpenseRepository;
import com.eventzen.finance.security.AuthenticatedUser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.*;

/**
 * Unit tests for BudgetService (FIN-US-001 – FIN-US-013).
 * All dependencies are mocked via Mockito – no Spring context required.
 */
@ExtendWith(MockitoExtension.class)
class BudgetServiceTest {

    @Mock private BudgetRepository budgetRepository;
    @Mock private ExpenseRepository expenseRepository;
    @Mock private FinanceMapper financeMapper;

    private BudgetService budgetService;

    @BeforeEach
    void setUp() {
        budgetService = new BudgetService(budgetRepository, expenseRepository, financeMapper);
    }

    // ── FIN-US-001: Create budget – happy path ───────────────────────────────

    @Test
    void createBudget_success_setsEstimatedTotalFromLineItems() {
        UUID eventId = UUID.randomUUID();
        AuthenticatedUser organizer = user("ORGANIZER");
        CreateBudgetRequest request = new CreateBudgetRequest(
                "EventZen Summit", "INR",
                List.of(
                        new BudgetItemRequest("Venue", BudgetCategory.VENUE, new BigDecimal("1000.00"), null),
                        new BudgetItemRequest("Marketing", BudgetCategory.MARKETING, new BigDecimal("500.00"), null)
                )
        );

        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.empty());
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toBudgetResponse(any(), any())).thenReturn(sampleBudgetResponse(eventId, new BigDecimal("1500.00")));

        BudgetResponse response = budgetService.createBudget(eventId, request, organizer);

        assertNotNull(response);
        verify(budgetRepository).save(argThat(b ->
                new BigDecimal("1500.00").compareTo(b.getEstimatedTotal()) == 0
                        && b.getEventId().equals(eventId)
                        && BudgetStatus.DRAFT.equals(b.getStatus())
                        && b.getCreatedByUserId().equals(organizer.id())
        ));
    }

    // ── FIN-US-002: Create budget – duplicate event ──────────────────────────

    @Test
    void createBudget_duplicateEvent_throwsFin4003() {
        UUID eventId = UUID.randomUUID();
        Budget existing = new Budget();
        existing.setId(UUID.randomUUID());
        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.of(existing));

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                budgetService.createBudget(eventId, minimalCreateRequest(), user("ORGANIZER")));

        assertEquals("FIN-4003", ex.getCode());
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
    }

    // ── FIN-US-003: Create budget – admin role is also allowed ───────────────

    @Test
    void createBudget_adminCanCreate() {
        UUID eventId = UUID.randomUUID();
        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.empty());
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toBudgetResponse(any(), any())).thenReturn(sampleBudgetResponse(eventId, new BigDecimal("200.00")));

        assertDoesNotThrow(() ->
                budgetService.createBudget(eventId, minimalCreateRequest(), user("ADMIN")));
    }

    // ── FIN-US-004: Approve budget – success ─────────────────────────────────

    @Test
    void approveBudget_asAdmin_setsStatusApprovedTotalAndApprover() {
        AuthenticatedUser admin = user("ADMIN");
        UUID budgetId = UUID.randomUUID();
        Budget budget = sampleBudget(budgetId, UUID.randomUUID());

        when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));
        when(expenseRepository.totalByEventId(any())).thenReturn(BigDecimal.ZERO);
        when(budgetRepository.save(any(Budget.class))).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toBudgetResponse(any(), any())).thenReturn(sampleBudgetResponse(budget.getEventId(), new BigDecimal("800.00")));

        budgetService.approveBudget(budgetId, new ApproveBudgetRequest(new BigDecimal("800.00")), admin);

        ArgumentCaptor<Budget> captor = ArgumentCaptor.forClass(Budget.class);
        verify(budgetRepository).save(captor.capture());
        Budget saved = captor.getValue();
        assertEquals(BudgetStatus.APPROVED, saved.getStatus());
        assertEquals(0, new BigDecimal("800.00").compareTo(saved.getApprovedTotal()));
        assertEquals(admin.id(), saved.getApprovedByUserId());
        assertNotNull(saved.getApprovedAt());
    }

    // ── FIN-US-005: Approve budget – non-admin is rejected ───────────────────

    @Test
    void approveBudget_asOrganizer_throwsForbidden() {
        UUID budgetId = UUID.randomUUID();

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                budgetService.approveBudget(budgetId, new ApproveBudgetRequest(new BigDecimal("1000.00")), user("ORGANIZER")));

        assertEquals("AUTH-403", ex.getCode());
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    // ── FIN-US-006: Approve budget – budget not found ────────────────────────

    @Test
    void approveBudget_budgetNotFound_throwsFin4041() {
        UUID budgetId = UUID.randomUUID();
        when(budgetRepository.findById(budgetId)).thenReturn(Optional.empty());

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                budgetService.approveBudget(budgetId, new ApproveBudgetRequest(new BigDecimal("1000.00")), user("ADMIN")));

        assertEquals("FIN-4041", ex.getCode());
        assertEquals(HttpStatus.NOT_FOUND, ex.getStatus());
    }

    // ── FIN-US-007: Get budget – not found ───────────────────────────────────

    @Test
    void getBudgetForEvent_notFound_throwsFin4041() {
        UUID eventId = UUID.randomUUID();
        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.empty());

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                budgetService.getBudgetForEvent(eventId, user("ADMIN")));

        assertEquals("FIN-4041", ex.getCode());
    }

    // ── FIN-US-008: Get budget – organizer owns it ───────────────────────────

    @Test
    void getBudgetForEvent_organizerOwnsIt_succeeds() {
        AuthenticatedUser organizer = user("ORGANIZER");
        UUID eventId = UUID.randomUUID();
        Budget budget = sampleBudget(UUID.randomUUID(), organizer.id());
        budget.setEventId(eventId);

        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.of(budget));
        when(expenseRepository.totalByEventId(any())).thenReturn(BigDecimal.ZERO);
        when(financeMapper.toBudgetResponse(any(), any())).thenReturn(sampleBudgetResponse(eventId, BigDecimal.ZERO));

        assertDoesNotThrow(() -> budgetService.getBudgetForEvent(eventId, organizer));
    }

    // ── FIN-US-009: Get budget – organizer does not own it ───────────────────

    @Test
    void getBudgetForEvent_organizerDoesNotOwnIt_throwsForbidden() {
        AuthenticatedUser organizer = user("ORGANIZER");
        UUID eventId = UUID.randomUUID();
        Budget budget = sampleBudget(UUID.randomUUID(), UUID.randomUUID()); // different owner
        budget.setEventId(eventId);

        when(budgetRepository.findByEventId(eventId)).thenReturn(Optional.of(budget));

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                budgetService.getBudgetForEvent(eventId, organizer));

        assertEquals("AUTH-403", ex.getCode());
    }

    // ── FIN-US-010: Add budget item – success ────────────────────────────────

    @Test
    void addBudgetItem_success_updatesEstimatedTotal() {
        AuthenticatedUser organizer = user("ORGANIZER");
        UUID budgetId = UUID.randomUUID();
        Budget budget = sampleBudget(budgetId, organizer.id());
        budget.setEstimatedTotal(new BigDecimal("200.00"));

        when(budgetRepository.findById(budgetId)).thenReturn(Optional.of(budget));
        when(expenseRepository.totalByEventId(any())).thenReturn(BigDecimal.ZERO);
        when(expenseRepository.totalByEventIdAndCategory(any(), any())).thenReturn(BigDecimal.ZERO);
        when(budgetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toBudgetResponse(any(), any())).thenReturn(sampleBudgetResponse(budget.getEventId(), new BigDecimal("500.00")));

        budgetService.addBudgetItem(budgetId,
                new BudgetItemRequest("AV Equipment", BudgetCategory.AV, new BigDecimal("300.00"), null),
                organizer);

        verify(budgetRepository).save(argThat(b ->
                new BigDecimal("500.00").compareTo(b.getEstimatedTotal()) == 0));
    }

    // ── FIN-US-011: Alerts – below 80% ───────────────────────────────────────

    @Test
    void buildAlerts_below80Percent_noAlerts() {
        Budget budget = sampleBudget(UUID.randomUUID(), UUID.randomUUID());
        budget.setApprovedTotal(new BigDecimal("1000.00"));
        budget.setActualTotal(new BigDecimal("700.00")); // 70%

        List<BudgetAlertResponse> alerts = budgetService.buildAlerts(budget);

        assertTrue(alerts.isEmpty());
    }

    // ── FIN-US-012: Alerts – 80% or more triggers MEDIUM ────────────────────

    @Test
    void buildAlerts_at85Percent_mediumAlert() {
        Budget budget = sampleBudget(UUID.randomUUID(), UUID.randomUUID());
        budget.setApprovedTotal(new BigDecimal("1000.00"));
        budget.setActualTotal(new BigDecimal("850.00")); // 85%

        List<BudgetAlertResponse> alerts = budgetService.buildAlerts(budget);

        assertEquals(1, alerts.size());
        assertEquals("MEDIUM", alerts.get(0).severity());
    }

    // ── FIN-US-013: Alerts – 100% or more triggers HIGH ─────────────────────

    @Test
    void buildAlerts_at100Percent_highAlert() {
        Budget budget = sampleBudget(UUID.randomUUID(), UUID.randomUUID());
        budget.setApprovedTotal(new BigDecimal("1000.00"));
        budget.setActualTotal(new BigDecimal("1050.00")); // 105%

        List<BudgetAlertResponse> alerts = budgetService.buildAlerts(budget);

        assertEquals(1, alerts.size());
        assertEquals("HIGH", alerts.get(0).severity());
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

    private Budget sampleBudget(UUID budgetId, UUID createdByUserId) {
        Budget b = new Budget();
        b.setId(budgetId);
        b.setEventId(UUID.randomUUID());
        b.setEventName("Test Event");
        b.setCurrency("INR");
        b.setStatus(BudgetStatus.DRAFT);
        b.setEstimatedTotal(new BigDecimal("200.00"));
        b.setApprovedTotal(BigDecimal.ZERO);
        b.setActualTotal(BigDecimal.ZERO);
        b.setCreatedByUserId(createdByUserId);
        return b;
    }

    private CreateBudgetRequest minimalCreateRequest() {
        return new CreateBudgetRequest("Test Event", "INR",
                List.of(new BudgetItemRequest("Misc", BudgetCategory.OTHER, new BigDecimal("200.00"), null)));
    }

    private BudgetResponse sampleBudgetResponse(UUID eventId, BigDecimal estimatedTotal) {
        return new BudgetResponse(
                UUID.randomUUID(), eventId, "Test Event", "INR",
                BudgetStatus.DRAFT, estimatedTotal, BigDecimal.ZERO, BigDecimal.ZERO,
                BigDecimal.ZERO, OffsetDateTime.now(), null, null,
                List.of(), List.of()
        );
    }
}
