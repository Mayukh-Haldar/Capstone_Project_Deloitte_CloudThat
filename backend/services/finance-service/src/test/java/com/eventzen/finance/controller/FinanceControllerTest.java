package com.eventzen.finance.controller;

import com.eventzen.finance.config.TicketingServiceProperties;
import com.eventzen.finance.config.VenueVendorServiceProperties;
import com.eventzen.finance.dto.ApproveBudgetRequest;
import com.eventzen.finance.dto.BudgetItemRequest;
import com.eventzen.finance.dto.BudgetResponse;
import com.eventzen.finance.dto.CreateBudgetRequest;
import com.eventzen.finance.dto.CreateExpenseRequest;
import com.eventzen.finance.dto.CreatePaymentRequest;
import com.eventzen.finance.model.BudgetCategory;
import com.eventzen.finance.model.PaymentMethod;
import com.eventzen.finance.model.PaymentStatus;
import com.eventzen.finance.security.AuthenticatedUser;
import com.eventzen.finance.service.BudgetService;
import com.eventzen.finance.service.PaymentService;
import com.eventzen.finance.service.TicketingClient;
import com.eventzen.finance.service.VenueBookingClient;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * HTTP integration tests for Finance Service controllers (FIN-CT-001 – FIN-CT-018).
 *
 * Uses a full Spring Boot context with an H2 in-memory database (test profile).
 * Authentication exploits the local dev-header fallback in JwtAuthenticationFilter:
 * MockMvc requests arrive with serverName="localhost", which satisfies the loopback check,
 * so x-user-id/x-user-email/x-user-roles headers are accepted without a real JWT.
 */
@SpringBootTest
@ActiveProfiles("test")
@AutoConfigureMockMvc
@Import(FinanceControllerTest.TestOverrides.class)
class FinanceControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired BudgetService budgetService;
    @Autowired PaymentService paymentService;

    private final ObjectMapper objectMapper = new ObjectMapper()
            .registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);

    /** Override outbound HTTP clients so tests work without external services. */
    @TestConfiguration
    static class TestOverrides {

        @Bean
        @Primary
        TicketingClient ticketingClient() {
            return new TicketingClient(new TicketingServiceProperties("http://localhost:8084", "test-key")) {
                @Override
                public void confirmRegistrationPayment(UUID registrationId) { /* no-op */ }
            };
        }

        @Bean
        @Primary
        VenueBookingClient venueBookingClient() {
            return new VenueBookingClient(new VenueVendorServiceProperties("http://localhost:8083", "test-key")) {
                @Override
                public void confirmVenueBookingPayment(com.eventzen.finance.model.Payment payment) { /* no-op */ }
            };
        }
    }

    // ─── Budget endpoints ────────────────────────────────────────────────────

    /** FIN-CT-001 – POST /api/v1/events/{id}/budget – 201 as ORGANIZER */
    @Test
    void createBudget_asOrganizer_returns201() throws Exception {
        UUID eventId = UUID.randomUUID();
        mockMvc.perform(post("/api/v1/events/{id}/budget", eventId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleCreateBudgetRequest()))
                        .header("x-user-id", UUID.randomUUID())
                        .header("x-user-email", "organizer@eventzen.test")
                        .header("x-user-roles", "ORGANIZER"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("DRAFT"))
                .andExpect(jsonPath("$.eventId").value(eventId.toString()));
    }

    /** FIN-CT-002 – POST /api/v1/events/{id}/budget – 401 without any auth */
    @Test
    void createBudget_noAuth_returns401() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/budget", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleCreateBudgetRequest())))
                .andExpect(status().isUnauthorized());
    }

    /** FIN-CT-003 – POST /api/v1/events/{id}/budget – 403 as ATTENDEE */
    @Test
    void createBudget_asAttendee_returns403() throws Exception {
        mockMvc.perform(post("/api/v1/events/{id}/budget", UUID.randomUUID())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleCreateBudgetRequest()))
                        .header("x-user-id", UUID.randomUUID())
                        .header("x-user-email", "attendee@eventzen.test")
                        .header("x-user-roles", "ATTENDEE"))
                .andExpect(status().isForbidden());
    }

    /** FIN-CT-004 – POST /api/v1/events/{id}/budget – 409 CONFLICT for duplicate event */
    @Test
    void createBudget_duplicateEvent_returns409() throws Exception {
        UUID eventId = UUID.randomUUID();
        UUID organizerId = UUID.randomUUID();
        // First create succeeds
        mockMvc.perform(post("/api/v1/events/{id}/budget", eventId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleCreateBudgetRequest()))
                        .header("x-user-id", organizerId)
                        .header("x-user-email", "organizer@eventzen.test")
                        .header("x-user-roles", "ORGANIZER"))
                .andExpect(status().isCreated());

        // Second create for same event → conflict
        mockMvc.perform(post("/api/v1/events/{id}/budget", eventId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(sampleCreateBudgetRequest()))
                        .header("x-user-id", organizerId)
                        .header("x-user-email", "organizer@eventzen.test")
                        .header("x-user-roles", "ORGANIZER"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("FIN-4003"));
    }

    /** FIN-CT-005 – GET /api/v1/events/{id}/budget – 200 returns budget */
    @Test
    void getBudget_asOrganizer_returns200() throws Exception {
        UUID eventId = UUID.randomUUID();
        UUID organizerId = UUID.randomUUID();
        AuthenticatedUser organizer = userWithId(organizerId, "ORGANIZER");

        budgetService.createBudget(eventId, sampleCreateBudgetRequest(), organizer);

        mockMvc.perform(get("/api/v1/events/{id}/budget", eventId)
                        .header("x-user-id", organizerId)
                        .header("x-user-email", "organizer@eventzen.test")
                        .header("x-user-roles", "ORGANIZER"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventId").value(eventId.toString()))
                .andExpect(jsonPath("$.items").isArray());
    }

    /** FIN-CT-006 – PUT /api/v1/budgets/{id}/approve – 200 as ADMIN */
    @Test
    void approveBudget_asAdmin_returns200WithApprovedStatus() throws Exception {
        UUID eventId = UUID.randomUUID();
        UUID organizerId = UUID.randomUUID();
        UUID adminId = UUID.randomUUID();
        AuthenticatedUser organizer = userWithId(organizerId, "ORGANIZER");

        BudgetResponse created = budgetService.createBudget(eventId, sampleCreateBudgetRequest(), organizer);

        mockMvc.perform(put("/api/v1/budgets/{id}/approve", created.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ApproveBudgetRequest(new BigDecimal("1500.00"))))
                        .header("x-user-id", adminId)
                        .header("x-user-email", "admin@eventzen.test")
                        .header("x-user-roles", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("APPROVED"))
                .andExpect(jsonPath("$.approvedTotal").value(1500.00));
    }

    /** FIN-CT-007 – PUT /api/v1/budgets/{id}/approve – 403 when called by ORGANIZER */
    @Test
    void approveBudget_asOrganizer_returns403() throws Exception {
        UUID eventId = UUID.randomUUID();
        UUID organizerId = UUID.randomUUID();
        AuthenticatedUser organizer = userWithId(organizerId, "ORGANIZER");

        BudgetResponse created = budgetService.createBudget(eventId, sampleCreateBudgetRequest(), organizer);

        mockMvc.perform(put("/api/v1/budgets/{id}/approve", created.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new ApproveBudgetRequest(new BigDecimal("1500.00"))))
                        .header("x-user-id", organizerId)
                        .header("x-user-email", "organizer@eventzen.test")
                        .header("x-user-roles", "ORGANIZER"))
                .andExpect(status().isForbidden());
    }

    /** FIN-CT-008 – POST /api/v1/budgets/{id}/items – 201 adds a new line item */
    @Test
    void addBudgetItem_asOrganizer_returns201WithUpdatedTotal() throws Exception {
        UUID eventId = UUID.randomUUID();
        UUID organizerId = UUID.randomUUID();
        AuthenticatedUser organizer = userWithId(organizerId, "ORGANIZER");

        BudgetResponse created = budgetService.createBudget(eventId, sampleCreateBudgetRequest(), organizer);

        BudgetItemRequest newItem = new BudgetItemRequest("Security", BudgetCategory.SECURITY, new BigDecimal("200.00"), null);

        mockMvc.perform(post("/api/v1/budgets/{id}/items", created.id())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(newItem))
                        .header("x-user-id", organizerId)
                        .header("x-user-email", "organizer@eventzen.test")
                        .header("x-user-roles", "ORGANIZER"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.items", hasSize(greaterThan(1))));
    }

    // ─── Expense endpoints ───────────────────────────────────────────────────

    /** FIN-CT-009 – POST /api/v1/expenses – 201 when OK */
    @Test
    void logExpense_asOrganizer_returns201() throws Exception {
        UUID eventId = UUID.randomUUID();
        UUID organizerId = UUID.randomUUID();
        AuthenticatedUser organizer = userWithId(organizerId, "ORGANIZER");
        AuthenticatedUser admin = userWithId(UUID.randomUUID(), "ADMIN");

        BudgetResponse budget = budgetService.createBudget(eventId, sampleCreateBudgetRequest(), organizer);
        budgetService.approveBudget(budget.id(), new ApproveBudgetRequest(new BigDecimal("2000.00")), admin);

        CreateExpenseRequest expenseReq = new CreateExpenseRequest(
                eventId, "CT Test Event", BudgetCategory.VENUE,
                new BigDecimal("300.00"), "INR", "Venue Corp", "Hall rental", null, LocalDate.now()
        );

        mockMvc.perform(post("/api/v1/expenses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(expenseReq))
                        .header("x-user-id", organizerId)
                        .header("x-user-email", "organizer@eventzen.test")
                        .header("x-user-roles", "ORGANIZER"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.amount").value(300.00));
    }

    /** FIN-CT-010 – POST /api/v1/expenses – 422 when expense exceeds budget */
    @Test
    void logExpense_overBudget_returns422WithFin4001() throws Exception {
        UUID eventId = UUID.randomUUID();
        UUID organizerId = UUID.randomUUID();
        AuthenticatedUser organizer = userWithId(organizerId, "ORGANIZER");
        AuthenticatedUser admin = userWithId(UUID.randomUUID(), "ADMIN");

        BudgetResponse budget = budgetService.createBudget(eventId, sampleCreateBudgetRequest(), organizer);
        budgetService.approveBudget(budget.id(), new ApproveBudgetRequest(new BigDecimal("100.00")), admin);

        CreateExpenseRequest overBudgetReq = new CreateExpenseRequest(
                eventId, "CT Small Event", BudgetCategory.VENUE,
                new BigDecimal("500.00"), "INR", "BigVendor", "Way over budget", null, LocalDate.now()
        );

        mockMvc.perform(post("/api/v1/expenses")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(overBudgetReq))
                        .header("x-user-id", organizerId)
                        .header("x-user-email", "organizer@eventzen.test")
                        .header("x-user-roles", "ORGANIZER"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("FIN-4001"));
    }

    // ─── Payment endpoints ───────────────────────────────────────────────────

    /** FIN-CT-011 – POST /api/v1/payments – 201 CARD immediate SUCCEEDED (Razorpay disabled) */
    @Test
    void initiatePayment_asAttendee_returns201Succeeded() throws Exception {
        CreatePaymentRequest payReq = new CreatePaymentRequest(
                UUID.randomUUID(), "CT Payment Event", UUID.randomUUID(), null,
                new BigDecimal("299.00"), "INR", PaymentMethod.CARD,
                "attendee@eventzen.test", "General ticket", false
        );

        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payReq))
                        .header("x-user-id", UUID.randomUUID())
                        .header("x-user-email", "attendee@eventzen.test")
                        .header("x-user-roles", "ATTENDEE"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.gatewayReference").value(startsWith("PAY-")));
    }

    /** FIN-CT-012 – POST /api/v1/payments – 402 when simulateFailure = true */
    @Test
    void initiatePayment_simulateFailure_returns402WithFin4002() throws Exception {
        CreatePaymentRequest payReq = new CreatePaymentRequest(
                UUID.randomUUID(), "CT Fail Event", UUID.randomUUID(), null,
                new BigDecimal("499.00"), "INR", PaymentMethod.CARD,
                "attendee@eventzen.test", "VIP ticket", true
        );

        mockMvc.perform(post("/api/v1/payments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(payReq))
                        .header("x-user-id", UUID.randomUUID())
                        .header("x-user-email", "attendee@eventzen.test")
                        .header("x-user-roles", "ATTENDEE"))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.code").value("FIN-4002"));
    }

    /** FIN-CT-013 – GET /api/v1/payments/me – 200 returns list (possibly empty) */
    @Test
    void listMyPayments_asAttendee_returns200Array() throws Exception {
        mockMvc.perform(get("/api/v1/payments/me")
                        .header("x-user-id", UUID.randomUUID())
                        .header("x-user-email", "attendee@eventzen.test")
                        .header("x-user-roles", "ATTENDEE"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray());
    }

    /** FIN-CT-014 – POST /api/v1/payments/webhook – 200 is publicly accessible */
    @Test
    void paymentWebhook_noAuth_returns200ForKnownGatewayReference() throws Exception {
        // Create a payment first so webhook has a target
        UUID attendeeId = UUID.randomUUID();
        AuthenticatedUser attendee = userWithId(attendeeId, "ATTENDEE");
        var payment = paymentService.initiatePayment(new CreatePaymentRequest(
                UUID.randomUUID(), "Webhook Test Event", UUID.randomUUID(), null,
                new BigDecimal("199.00"), "INR", PaymentMethod.CARD,
                "wh@eventzen.test", "Webhook ticket", false
        ), attendee);

        String webhookBody = String.format(
                "{\"gatewayReference\":\"%s\",\"status\":\"SUCCEEDED\"}", payment.gatewayReference());

        mockMvc.perform(post("/api/v1/payments/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(webhookBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("SUCCEEDED"));
    }

    /** FIN-CT-015 – POST /api/v1/payments/webhook – 404 for unknown reference */
    @Test
    void paymentWebhook_unknownReference_returns404() throws Exception {
        String webhookBody = "{\"gatewayReference\":\"REF-DOES-NOT-EXIST\",\"status\":\"SUCCEEDED\"}";

        mockMvc.perform(post("/api/v1/payments/webhook")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(webhookBody))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("FIN-4042"));
    }

    // ─── Report endpoints ────────────────────────────────────────────────────

    /** FIN-CT-016 – GET /api/v1/events/{id}/reports/financial – 200 as ADMIN */
    @Test
    void getFinancialReport_asAdmin_returns200() throws Exception {
        UUID eventId = UUID.randomUUID();

        mockMvc.perform(get("/api/v1/events/{id}/reports/financial", eventId)
                        .header("x-user-id", UUID.randomUUID())
                        .header("x-user-email", "admin@eventzen.test")
                        .header("x-user-roles", "ADMIN"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.eventId").value(eventId.toString()))
                .andExpect(jsonPath("$.totalRevenue").exists());
    }

    /** FIN-CT-017 – GET /api/v1/events/{id}/reports/financial – 200 as ORGANIZER */
    @Test
    void getFinancialReport_asOrganizer_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/events/{id}/reports/financial", UUID.randomUUID())
                        .header("x-user-id", UUID.randomUUID())
                        .header("x-user-email", "organizer@eventzen.test")
                        .header("x-user-roles", "ORGANIZER"))
                .andExpect(status().isOk());
    }

    /** FIN-CT-018 – GET /api/v1/events/{id}/reports/financial – 403 as ATTENDEE */
    @Test
    void getFinancialReport_asAttendee_returns403() throws Exception {
        mockMvc.perform(get("/api/v1/events/{id}/reports/financial", UUID.randomUUID())
                        .header("x-user-id", UUID.randomUUID())
                        .header("x-user-email", "attendee@eventzen.test")
                        .header("x-user-roles", "ATTENDEE"))
                .andExpect(status().isForbidden());
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private CreateBudgetRequest sampleCreateBudgetRequest() {
        return new CreateBudgetRequest(
                "CT Test Event", "INR",
                List.of(
                        new BudgetItemRequest("Venue", BudgetCategory.VENUE, new BigDecimal("1000.00"), null),
                        new BudgetItemRequest("Marketing", BudgetCategory.MARKETING, new BigDecimal("500.00"), null)
                )
        );
    }

    private AuthenticatedUser userWithId(UUID id, String role) {
        return new AuthenticatedUser(
                id, role.toLowerCase() + "@eventzen.test",
                Set.of(role), List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
    }
}
