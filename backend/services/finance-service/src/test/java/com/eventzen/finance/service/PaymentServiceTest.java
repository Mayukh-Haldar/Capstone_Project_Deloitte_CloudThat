package com.eventzen.finance.service;

import com.eventzen.finance.config.RazorpayProperties;
import com.eventzen.finance.dto.CreatePaymentRequest;
import com.eventzen.finance.dto.PaymentResponse;
import com.eventzen.finance.dto.VerifyRazorpayPaymentRequest;
import com.eventzen.finance.model.Payment;
import com.eventzen.finance.model.PaymentMethod;
import com.eventzen.finance.model.PaymentStatus;
import com.eventzen.finance.exception.FinanceServiceException;
import com.eventzen.finance.repository.PaymentRepository;
import com.eventzen.finance.security.AuthenticatedUser;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PaymentServiceTest {

    @Mock
    private PaymentRepository paymentRepository;

    @Mock
    private FinanceMapper financeMapper;

    @Mock
    private RazorpayClient razorpayClient;

    @Mock
    private NotificationClient notificationClient;

    @Mock
    private TicketingClient ticketingClient;

    @Mock
    private VenueBookingClient venueBookingClient;

    @Mock
    private InvoiceAssetService invoiceAssetService;

    private PaymentService paymentService;

    @BeforeEach
    void setUp() {
        paymentService = new PaymentService(
                paymentRepository,
                financeMapper,
                razorpayClient,
                notificationClient,
                ticketingClient,
                venueBookingClient,
                invoiceAssetService,
                new RazorpayProperties(true, "rzp_test_key", "super-secret", "EventZen", "Event registration payment")
        );
    }

    @Test
    void verifyRazorpayPaymentUpdatesStoredMethodFromGatewayDetails() throws Exception {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setEventId(UUID.randomUUID());
        payment.setEventName("EventZen Summit");
        payment.setRegistrationId(UUID.randomUUID());
        payment.setAmount(new BigDecimal("799.00"));
        payment.setCurrency("INR");
        payment.setPaymentMethod(PaymentMethod.CARD);
        payment.setPaymentStatus(PaymentStatus.PENDING);
        payment.setGatewayReference("PAY-12345678");
        payment.setGatewayOrderId("order_test_123");
        payment.setCustomerEmail("attendee@example.com");
        payment.setDescription("VIP ticket");
        payment.setCreatedByUserId(UUID.randomUUID());
        VerifyRazorpayPaymentRequest request = new VerifyRazorpayPaymentRequest(
                payment.getGatewayOrderId(),
                "pay_test_456",
                hmacSha256("super-secret", payment.getGatewayOrderId() + "|pay_test_456")
        );

        when(paymentRepository.findByGatewayOrderId(payment.getGatewayOrderId())).thenReturn(java.util.Optional.of(payment));
        when(razorpayClient.enabled()).thenReturn(true);
        when(razorpayClient.fetchPayment("pay_test_456")).thenReturn(new RazorpayClient.RazorpayPaymentResponse("pay_test_456", "upi"));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(financeMapper.toPaymentResponse(any(Payment.class))).thenAnswer(invocation -> toResponse(invocation.getArgument(0)));
        doNothing().when(ticketingClient).confirmRegistrationPayment(payment.getRegistrationId());

        PaymentResponse response = paymentService.verifyRazorpayPayment(request, false);

        assertEquals(PaymentMethod.UPI, response.paymentMethod());
        verify(razorpayClient).fetchPayment("pay_test_456");

        ArgumentCaptor<Payment> paymentCaptor = ArgumentCaptor.forClass(Payment.class);
        verify(paymentRepository).save(paymentCaptor.capture());
        assertEquals(PaymentMethod.UPI, paymentCaptor.getValue().getPaymentMethod());
        assertEquals(PaymentStatus.SUCCEEDED, paymentCaptor.getValue().getPaymentStatus());
    }

    @Test
    void verifyRazorpayPaymentStoresWalletMethodWhenGatewayReportsWallet() throws Exception {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setEventId(UUID.randomUUID());
        payment.setEventName("EventZen Summit");
        payment.setRegistrationId(UUID.randomUUID());
        payment.setAmount(new BigDecimal("799.00"));
        payment.setCurrency("INR");
        payment.setPaymentMethod(PaymentMethod.CARD);
        payment.setPaymentStatus(PaymentStatus.PENDING);
        payment.setGatewayReference("PAY-87654321");
        payment.setGatewayOrderId("order_test_wallet");
        payment.setCustomerEmail("attendee@example.com");
        payment.setDescription("VIP ticket");
        payment.setCreatedByUserId(UUID.randomUUID());

        VerifyRazorpayPaymentRequest request = new VerifyRazorpayPaymentRequest(
                payment.getGatewayOrderId(),
                "pay_test_wallet",
                hmacSha256("super-secret", payment.getGatewayOrderId() + "|pay_test_wallet")
        );

        when(paymentRepository.findByGatewayOrderId(payment.getGatewayOrderId())).thenReturn(java.util.Optional.of(payment));
        when(razorpayClient.enabled()).thenReturn(true);
        when(razorpayClient.fetchPayment("pay_test_wallet")).thenReturn(new RazorpayClient.RazorpayPaymentResponse("pay_test_wallet", "wallet"));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(financeMapper.toPaymentResponse(any(Payment.class))).thenAnswer(invocation -> toResponse(invocation.getArgument(0)));
        doNothing().when(ticketingClient).confirmRegistrationPayment(payment.getRegistrationId());

        PaymentResponse response = paymentService.verifyRazorpayPayment(request, false);

        assertEquals(PaymentMethod.WALLET, response.paymentMethod());
    }

    @Test
    void verifyRazorpayPaymentStoresNetbankingMethodWhenGatewayReportsNetbanking() throws Exception {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setEventId(UUID.randomUUID());
        payment.setEventName("EventZen Summit");
        payment.setRegistrationId(UUID.randomUUID());
        payment.setAmount(new BigDecimal("799.00"));
        payment.setCurrency("INR");
        payment.setPaymentMethod(PaymentMethod.CARD);
        payment.setPaymentStatus(PaymentStatus.PENDING);
        payment.setGatewayReference("PAY-NETBANK");
        payment.setGatewayOrderId("order_test_netbanking");
        payment.setCustomerEmail("attendee@example.com");
        payment.setDescription("VIP ticket");
        payment.setCreatedByUserId(UUID.randomUUID());

        VerifyRazorpayPaymentRequest request = new VerifyRazorpayPaymentRequest(
                payment.getGatewayOrderId(),
                "pay_test_netbanking",
                hmacSha256("super-secret", payment.getGatewayOrderId() + "|pay_test_netbanking")
        );

        when(paymentRepository.findByGatewayOrderId(payment.getGatewayOrderId())).thenReturn(java.util.Optional.of(payment));
        when(razorpayClient.enabled()).thenReturn(true);
        when(razorpayClient.fetchPayment("pay_test_netbanking")).thenReturn(new RazorpayClient.RazorpayPaymentResponse("pay_test_netbanking", "netbanking"));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(financeMapper.toPaymentResponse(any(Payment.class))).thenAnswer(invocation -> toResponse(invocation.getArgument(0)));
        doNothing().when(ticketingClient).confirmRegistrationPayment(payment.getRegistrationId());

        PaymentResponse response = paymentService.verifyRazorpayPayment(request, false);

        assertEquals(PaymentMethod.NETBANKING, response.paymentMethod());
    }

    @Test
    void verifyRazorpayPaymentStoresPayLaterMethodWhenGatewayReportsPayLater() throws Exception {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setEventId(UUID.randomUUID());
        payment.setEventName("EventZen Summit");
        payment.setRegistrationId(UUID.randomUUID());
        payment.setAmount(new BigDecimal("799.00"));
        payment.setCurrency("INR");
        payment.setPaymentMethod(PaymentMethod.CARD);
        payment.setPaymentStatus(PaymentStatus.PENDING);
        payment.setGatewayReference("PAY-LATER12");
        payment.setGatewayOrderId("order_test_paylater");
        payment.setCustomerEmail("attendee@example.com");
        payment.setDescription("VIP ticket");
        payment.setCreatedByUserId(UUID.randomUUID());

        VerifyRazorpayPaymentRequest request = new VerifyRazorpayPaymentRequest(
                payment.getGatewayOrderId(),
                "pay_test_paylater",
                hmacSha256("super-secret", payment.getGatewayOrderId() + "|pay_test_paylater")
        );

        when(paymentRepository.findByGatewayOrderId(payment.getGatewayOrderId())).thenReturn(java.util.Optional.of(payment));
        when(razorpayClient.enabled()).thenReturn(true);
        when(razorpayClient.fetchPayment("pay_test_paylater")).thenReturn(new RazorpayClient.RazorpayPaymentResponse("pay_test_paylater", "paylater"));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(financeMapper.toPaymentResponse(any(Payment.class))).thenAnswer(invocation -> toResponse(invocation.getArgument(0)));
        doNothing().when(ticketingClient).confirmRegistrationPayment(payment.getRegistrationId());

        PaymentResponse response = paymentService.verifyRazorpayPayment(request, false);

        assertEquals(PaymentMethod.PAY_LATER, response.paymentMethod());
    }

    // ── FIN-PAY-005: initiatePayment – simulateFailure saves FAILED and throws

    @Test
    void initiatePayment_simulateFailure_savesFailedPaymentAndThrowsFin4002() {
        // Razorpay disabled for this test so we create a separate service instance
        PaymentService svc = new PaymentService(
                paymentRepository, financeMapper, razorpayClient, notificationClient,
                ticketingClient, venueBookingClient, invoiceAssetService,
                new RazorpayProperties(false, "", "", "EventZen", "Event registration payment")
        );
        AuthenticatedUser actor = new AuthenticatedUser(UUID.randomUUID(), "attendee@test.local",
                java.util.Set.of("ATTENDEE"), java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ATTENDEE")));

        CreatePaymentRequest request = new CreatePaymentRequest(
                UUID.randomUUID(), "Failure Event", UUID.randomUUID(), null,
                new BigDecimal("199.00"), "INR", com.eventzen.finance.model.PaymentMethod.CARD,
                "attendee@test.local", "General ticket", true  // simulateFailure = true
        );

        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                svc.initiatePayment(request, actor));

        assertEquals("FIN-4002", ex.getCode());
        assertEquals(org.springframework.http.HttpStatus.PAYMENT_REQUIRED, ex.getStatus());
        verify(paymentRepository).save(argThat(p -> p.getPaymentStatus() == PaymentStatus.FAILED));
    }

    // ── FIN-PAY-006: initiatePayment – BANK_TRANSFER without Razorpay → PENDING

    @Test
    void initiatePayment_bankTransferGatewayDisabled_remainsPending() {
        PaymentService svc = new PaymentService(
                paymentRepository, financeMapper, razorpayClient, notificationClient,
                ticketingClient, venueBookingClient, invoiceAssetService,
                new RazorpayProperties(false, "", "", "EventZen", "Event registration payment")
        );
        AuthenticatedUser actor = new AuthenticatedUser(UUID.randomUUID(), "org@test.local",
                java.util.Set.of("ORGANIZER"), java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ORGANIZER")));

        when(razorpayClient.enabled()).thenReturn(false); // used in usesRazorpay()
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toPaymentResponse(any(Payment.class))).thenAnswer(inv -> toResponse(inv.getArgument(0)));

        CreatePaymentRequest request = new CreatePaymentRequest(
                UUID.randomUUID(), "Bank Event", null, null,
                new BigDecimal("5000.00"), "INR", com.eventzen.finance.model.PaymentMethod.BANK_TRANSFER,
                "org@test.local", "Venue booking", false
        );

        PaymentResponse response = svc.initiatePayment(request, actor);
        assertEquals(PaymentStatus.PENDING, response.status());
    }

    // ── FIN-PAY-007: verifyRazorpayPayment – payment not found ───────────────

    @Test
    void verifyRazorpayPayment_paymentNotFound_throwsFin4042() {
        when(paymentRepository.findByGatewayOrderId("order_missing")).thenReturn(java.util.Optional.empty());

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                paymentService.verifyRazorpayPayment(
                        new com.eventzen.finance.dto.VerifyRazorpayPaymentRequest("order_missing", "pay_x", "sig_x"),
                        false
                ));

        assertEquals("FIN-4042", ex.getCode());
        assertEquals(org.springframework.http.HttpStatus.NOT_FOUND, ex.getStatus());
    }

    // ── FIN-PAY-008: verifyRazorpayPayment – invalid signature → FAILED ──────

    @Test
    void verifyRazorpayPayment_invalidSignature_savesFailedPaymentAndThrowsFin4002() throws Exception {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setEventId(UUID.randomUUID());
        payment.setEventName("Test Event");
        payment.setAmount(new BigDecimal("299.00"));
        payment.setCurrency("INR");
        payment.setPaymentMethod(com.eventzen.finance.model.PaymentMethod.CARD);
        payment.setPaymentStatus(PaymentStatus.PENDING);
        payment.setGatewayReference("PAY-BADSIG1");
        payment.setGatewayOrderId("order_bad_sig");
        payment.setCreatedByUserId(UUID.randomUUID());
        payment.setDescription("Test");

        com.eventzen.finance.dto.VerifyRazorpayPaymentRequest request = new com.eventzen.finance.dto.VerifyRazorpayPaymentRequest(
                "order_bad_sig", "pay_bad", "definitely-wrong-signature"
        );

        when(paymentRepository.findByGatewayOrderId("order_bad_sig")).thenReturn(java.util.Optional.of(payment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                paymentService.verifyRazorpayPayment(request, false));

        assertEquals("FIN-4002", ex.getCode());
        verify(paymentRepository).save(argThat(p -> p.getPaymentStatus() == PaymentStatus.FAILED));
    }

    // ── FIN-PAY-009: verifyRazorpayPayment – local dev fallback bypasses sig ─

    @Test
    void verifyRazorpayPayment_localDevFallback_bypassesSignatureAndSucceeds() {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setEventId(UUID.randomUUID());
        payment.setEventName("Dev Event");
        payment.setRegistrationId(UUID.randomUUID());
        payment.setAmount(new BigDecimal("199.00"));
        payment.setCurrency("INR");
        payment.setPaymentMethod(com.eventzen.finance.model.PaymentMethod.CARD);
        payment.setPaymentStatus(PaymentStatus.PENDING);
        payment.setGatewayReference("PAY-DEV0001");
        payment.setGatewayOrderId("order_dev_fallback");
        payment.setCustomerEmail("dev@test.local");
        payment.setDescription("Dev ticket");
        payment.setCreatedByUserId(UUID.randomUUID());

        com.eventzen.finance.dto.VerifyRazorpayPaymentRequest request = new com.eventzen.finance.dto.VerifyRazorpayPaymentRequest(
                "order_dev_fallback", "pay_dev_001", "any-sig-allowed-in-dev"
        );

        when(paymentRepository.findByGatewayOrderId("order_dev_fallback")).thenReturn(java.util.Optional.of(payment));
        when(razorpayClient.enabled()).thenReturn(true);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toPaymentResponse(any(Payment.class))).thenAnswer(inv -> toResponse(inv.getArgument(0)));
        doNothing().when(ticketingClient).confirmRegistrationPayment(payment.getRegistrationId());

        PaymentResponse response = paymentService.verifyRazorpayPayment(request, true);  // allowLocalDevFallback=true

        assertEquals(PaymentStatus.SUCCEEDED, response.status());
    }

    // ── FIN-PAY-010: handleWebhook – payment not found ───────────────────────

    @Test
    void handleWebhook_gatewayReferenceNotFound_throwsFin4042() {
        when(paymentRepository.findByGatewayReference("REF-MISSING")).thenReturn(java.util.Optional.empty());

        FinanceServiceException ex = assertThrows(FinanceServiceException.class, () ->
                paymentService.handleWebhook(
                        new com.eventzen.finance.dto.PaymentWebhookRequest("REF-MISSING", PaymentStatus.SUCCEEDED, null)));

        assertEquals("FIN-4042", ex.getCode());
    }

    // ── FIN-PAY-011: handleWebhook – SUCCEEDED sets payment date ─────────────

    @Test
    void handleWebhook_succeededStatus_setsPaymentDateAndTransitionsStatus() {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setEventId(UUID.randomUUID());
        payment.setEventName("Webhook Event");
        payment.setAmount(new BigDecimal("499.00"));
        payment.setCurrency("INR");
        payment.setPaymentMethod(com.eventzen.finance.model.PaymentMethod.UPI);
        payment.setPaymentStatus(PaymentStatus.PENDING);
        payment.setGatewayReference("REF-WEBHOOK1");
        payment.setCreatedByUserId(UUID.randomUUID());
        payment.setDescription("UPI payment");

        com.eventzen.finance.dto.PaymentWebhookRequest request =
                new com.eventzen.finance.dto.PaymentWebhookRequest("REF-WEBHOOK1", PaymentStatus.SUCCEEDED, "{\"source\":\"webhook\"}");

        when(paymentRepository.findByGatewayReference("REF-WEBHOOK1")).thenReturn(java.util.Optional.of(payment));
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toPaymentResponse(any(Payment.class))).thenAnswer(inv -> toResponse(inv.getArgument(0)));

        PaymentResponse response = paymentService.handleWebhook(request);

        assertEquals(PaymentStatus.SUCCEEDED, response.status());
        verify(paymentRepository, atLeastOnce()).save(argThat(p ->
                p.getPaymentStatus() == PaymentStatus.SUCCEEDED && p.getPaymentDate() != null));
    }

    // ── FIN-PAY-012: listPaymentsForUser – returns ordered list ──────────────

    @Test
    void listPaymentsForUser_returnsPaymentsForCaller() {
        Payment p1 = new Payment();
        p1.setId(UUID.randomUUID());
        p1.setEventId(UUID.randomUUID());
        p1.setEventName("Event A");
        p1.setAmount(new BigDecimal("100.00"));
        p1.setCurrency("INR");
        p1.setPaymentMethod(com.eventzen.finance.model.PaymentMethod.CARD);
        p1.setPaymentStatus(PaymentStatus.SUCCEEDED);
        p1.setGatewayReference("PAY-LIST001");
        p1.setCreatedByUserId(UUID.randomUUID());
        p1.setDescription("List test");

        var actor = new com.eventzen.finance.security.AuthenticatedUser(
                p1.getCreatedByUserId(), "user@test.local",
                java.util.Set.of("ATTENDEE"), java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ATTENDEE"))
        );

        when(paymentRepository.findByCreatedByUserIdOrderByCreatedAtDesc(actor.id())).thenReturn(java.util.List.of(p1));
        when(financeMapper.toPaymentResponse(any(Payment.class))).thenAnswer(inv -> toResponse(inv.getArgument(0)));

        java.util.List<PaymentResponse> result = paymentService.listPaymentsForUser(actor);

        assertEquals(1, result.size());
        verify(paymentRepository).findByCreatedByUserIdOrderByCreatedAtDesc(actor.id());
    }

    // ── FIN-PAY-013: initiatePayment – CARD Razorpay disabled → SUCCEEDED ────

    @Test
    void initiatePayment_cardPaymentGatewayDisabled_immediatelySucceeds() {
        PaymentService svc = new PaymentService(
                paymentRepository, financeMapper, razorpayClient, notificationClient,
                ticketingClient, venueBookingClient, invoiceAssetService,
                new RazorpayProperties(false, "", "", "EventZen", "Event registration payment")
        );
        AuthenticatedUser actor = new AuthenticatedUser(UUID.randomUUID(), "attendee@test.local",
                java.util.Set.of("ATTENDEE"), java.util.List.of(new org.springframework.security.core.authority.SimpleGrantedAuthority("ROLE_ATTENDEE")));

        when(razorpayClient.enabled()).thenReturn(false);
        when(paymentRepository.save(any(Payment.class))).thenAnswer(inv -> inv.getArgument(0));
        when(financeMapper.toPaymentResponse(any(Payment.class))).thenAnswer(inv -> toResponse(inv.getArgument(0)));

        CreatePaymentRequest request = new CreatePaymentRequest(
                UUID.randomUUID(), "Card Event", UUID.randomUUID(), null,
                new BigDecimal("299.00"), "INR", com.eventzen.finance.model.PaymentMethod.CARD,
                "attendee@test.local", "General ticket", false
        );

        PaymentResponse response = svc.initiatePayment(request, actor);
        assertEquals(PaymentStatus.SUCCEEDED, response.status());
    }

    private PaymentResponse toResponse(Payment payment) {
        return new PaymentResponse(
                payment.getId(),
                payment.getEventId(),
                payment.getEventName(),
                payment.getRegistrationId(),
                payment.getVenueBookingId(),
                payment.getAmount(),
                payment.getCurrency(),
                payment.getPaymentMethod(),
                payment.getPaymentStatus(),
                payment.getGatewayReference(),
                payment.getGatewayOrderId(),
                payment.getGatewayPaymentId(),
                null,
                payment.getAmount().multiply(BigDecimal.valueOf(100)).longValue(),
                "EventZen",
                "Event registration payment",
                payment.getCustomerEmail(),
                payment.getDescription(),
                payment.getInvoiceNumber(),
                payment.getInvoiceUrl(),
                payment.getPaymentDate(),
                payment.getCreatedAt()
        );
    }

    private String hmacSha256(String secret, String payload) throws Exception {
        Mac sha256 = Mac.getInstance("HmacSHA256");
        sha256.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] digest = sha256.doFinal(payload.getBytes(StandardCharsets.UTF_8));
        StringBuilder builder = new StringBuilder(digest.length * 2);
        for (byte value : digest) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }
}
