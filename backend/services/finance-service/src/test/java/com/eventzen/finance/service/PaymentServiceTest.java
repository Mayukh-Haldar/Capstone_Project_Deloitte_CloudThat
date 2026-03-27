package com.eventzen.finance.service;

import com.eventzen.finance.config.RazorpayProperties;
import com.eventzen.finance.dto.PaymentResponse;
import com.eventzen.finance.dto.VerifyRazorpayPaymentRequest;
import com.eventzen.finance.model.Payment;
import com.eventzen.finance.model.PaymentMethod;
import com.eventzen.finance.model.PaymentStatus;
import com.eventzen.finance.repository.PaymentRepository;
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
import static org.mockito.ArgumentMatchers.any;
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

    private PaymentResponse toResponse(Payment payment) {
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
