package com.eventzen.finance;

import com.eventzen.finance.dto.ApproveBudgetRequest;
import com.eventzen.finance.dto.BudgetItemRequest;
import com.eventzen.finance.dto.BudgetResponse;
import com.eventzen.finance.dto.CreateBudgetRequest;
import com.eventzen.finance.dto.CreateExpenseRequest;
import com.eventzen.finance.dto.CreatePaymentRequest;
import com.eventzen.finance.dto.FinancialReportResponse;
import com.eventzen.finance.exception.FinanceServiceException;
import com.eventzen.finance.model.BudgetCategory;
import com.eventzen.finance.model.PaymentMethod;
import com.eventzen.finance.security.AuthenticatedUser;
import com.eventzen.finance.service.BudgetService;
import com.eventzen.finance.service.ExpenseService;
import com.eventzen.finance.service.FinancialReportService;
import com.eventzen.finance.service.PaymentService;
import com.eventzen.finance.service.TicketingClient;
import com.eventzen.finance.service.VenueBookingClient;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.ActiveProfiles;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

@SpringBootTest
@ActiveProfiles("test")
@Import(FinanceServiceIntegrationTest.TestOverrides.class)
class FinanceServiceIntegrationTest {

    @Autowired
    private BudgetService budgetService;

    @Autowired
    private ExpenseService expenseService;

    @Autowired
    private PaymentService paymentService;

    @Autowired
    private FinancialReportService financialReportService;

    @TestConfiguration
    static class TestOverrides {
        @Bean
        @Primary
        TicketingClient ticketingClient() {
            return new TicketingClient(new com.eventzen.finance.config.TicketingServiceProperties("http://localhost:8084", "test-key")) {
                @Override
                public void confirmRegistrationPayment(UUID registrationId) {
                    // Keep integration tests self-contained instead of requiring ticketing-service.
                }
            };
        }

        @Bean
        @Primary
        VenueBookingClient venueBookingClient() {
            return new VenueBookingClient(new com.eventzen.finance.config.VenueVendorServiceProperties("http://localhost:8083", "test-key")) {
                @Override
                public void confirmVenueBookingPayment(com.eventzen.finance.model.Payment payment) {
                    // Keep integration tests self-contained instead of requiring venue-vendor-service.
                }
            };
        }
    }

    @Test
    void createsBudgetTracksExpenseAndRevenueInReport() {
        UUID eventId = UUID.randomUUID();
        AuthenticatedUser organizer = user("ORGANIZER");
        AuthenticatedUser admin = user("ADMIN");

        BudgetResponse budget = budgetService.createBudget(eventId, new CreateBudgetRequest(
                "EventZen Summit",
                "INR",
                List.of(
                        new BudgetItemRequest("Venue", BudgetCategory.VENUE, new BigDecimal("1000.00"), null),
                        new BudgetItemRequest("Marketing", BudgetCategory.MARKETING, new BigDecimal("500.00"), null)
                )
        ), organizer);

        budgetService.approveBudget(budget.id(), new ApproveBudgetRequest(new BigDecimal("1500.00")), admin);

        expenseService.logExpense(new CreateExpenseRequest(
                eventId,
                "EventZen Summit",
                BudgetCategory.MARKETING,
                new BigDecimal("300.00"),
                "INR",
                "AdVendor",
                "Launch campaign",
                null,
                LocalDate.now()
        ), organizer);

        paymentService.initiatePayment(new CreatePaymentRequest(
                eventId,
                "EventZen Summit",
                UUID.randomUUID(),
                null,
                new BigDecimal("799.00"),
                "INR",
                PaymentMethod.CARD,
                "attendee@example.com",
                "VIP ticket",
                false
        ), organizer);

        FinancialReportResponse report = financialReportService.getEventFinancialReport(eventId, organizer);
        assertEquals(new BigDecimal("799.00"), report.totalRevenue());
        assertEquals(new BigDecimal("300.00"), report.totalExpenses());
        assertEquals(new BigDecimal("499.00"), report.netProfit());
        assertEquals(2, report.recentTransactions().size());
    }

    @Test
    void rejectsExpenseThatExceedsApprovedBudget() {
        UUID eventId = UUID.randomUUID();
        AuthenticatedUser organizer = user("ORGANIZER");
        AuthenticatedUser admin = user("ADMIN");

        BudgetResponse budget = budgetService.createBudget(eventId, new CreateBudgetRequest(
                "Compact Event",
                "INR",
                List.of(new BudgetItemRequest("Venue", BudgetCategory.VENUE, new BigDecimal("100.00"), null))
        ), organizer);
        budgetService.approveBudget(budget.id(), new ApproveBudgetRequest(new BigDecimal("100.00")), admin);

        FinanceServiceException exception = assertThrows(FinanceServiceException.class, () -> expenseService.logExpense(
                new CreateExpenseRequest(
                        eventId,
                        "Compact Event",
                        BudgetCategory.VENUE,
                        new BigDecimal("150.00"),
                        "INR",
                        "Venue Vendor",
                        "Over budget rental",
                        null,
                        LocalDate.now()
                ),
                organizer
        ));

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, exception.getStatus());
        assertEquals("FIN-4001", exception.getCode());
    }

    @Test
    void nonRazorpayCardPaymentSucceedsImmediatelyWhenGatewayDisabled() {
        AuthenticatedUser organizer = user("ORGANIZER");
        var payment = paymentService.initiatePayment(new CreatePaymentRequest(
                UUID.randomUUID(),
                "Gateway Disabled Event",
                UUID.randomUUID(),
                null,
                new BigDecimal("199.00"),
                "INR",
                PaymentMethod.CARD,
                "attendee@example.com",
                "General ticket",
                false
        ), organizer);

        assertEquals("SUCCEEDED", payment.status().name());
    }

    private AuthenticatedUser user(String role) {
        return new AuthenticatedUser(
                UUID.randomUUID(),
                role.toLowerCase() + "@eventzen.test",
                Set.of(role),
                List.of(new SimpleGrantedAuthority("ROLE_" + role))
        );
    }
}
