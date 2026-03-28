package com.eventzen.finance.service;

import com.eventzen.finance.dto.CreatePaymentRequest;
import com.eventzen.finance.dto.PaymentResponse;
import com.eventzen.finance.dto.PaymentWebhookRequest;
import com.eventzen.finance.dto.VerifyRazorpayPaymentRequest;
import com.eventzen.finance.exception.FinanceServiceException;
import com.eventzen.finance.model.Payment;
import com.eventzen.finance.model.PaymentMethod;
import com.eventzen.finance.model.PaymentStatus;
import com.eventzen.finance.repository.PaymentRepository;
import com.eventzen.finance.security.AuthenticatedUser;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);

    private final PaymentRepository paymentRepository;
    private final FinanceMapper financeMapper;
    private final RazorpayClient razorpayClient;
    private final NotificationClient notificationClient;
    private final TicketingClient ticketingClient;
    private final VenueBookingClient venueBookingClient;
    private final InvoiceAssetService invoiceAssetService;
    private final com.eventzen.finance.config.RazorpayProperties razorpayProperties;

    public PaymentService(
            PaymentRepository paymentRepository,
            FinanceMapper financeMapper,
            RazorpayClient razorpayClient,
            NotificationClient notificationClient,
            TicketingClient ticketingClient,
            VenueBookingClient venueBookingClient,
            InvoiceAssetService invoiceAssetService,
            com.eventzen.finance.config.RazorpayProperties razorpayProperties
    ) {
        this.paymentRepository = paymentRepository;
        this.financeMapper = financeMapper;
        this.razorpayClient = razorpayClient;
        this.notificationClient = notificationClient;
        this.ticketingClient = ticketingClient;
        this.venueBookingClient = venueBookingClient;
        this.invoiceAssetService = invoiceAssetService;
        this.razorpayProperties = razorpayProperties;
    }

    @Transactional
    public PaymentResponse initiatePayment(CreatePaymentRequest request, AuthenticatedUser actor) {
        Payment payment = new Payment();
        payment.setId(UUID.randomUUID());
        payment.setEventId(request.eventId());
        payment.setEventName(request.eventName());
        payment.setRegistrationId(request.registrationId());
        payment.setVenueBookingId(request.venueBookingId());
        payment.setAmount(request.amount());
        payment.setCurrency(request.currency().toUpperCase(Locale.ROOT));
        payment.setPaymentMethod(request.paymentMethod());
        payment.setCustomerEmail(request.customerEmail());
        payment.setDescription(request.description());
        payment.setCreatedByUserId(actor.id());
        payment.setGatewayReference("PAY-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT));

        if (request.shouldSimulateFailure()) {
            payment.setPaymentStatus(PaymentStatus.FAILED);
            payment.setGatewayPayload("{\"simulated\":true,\"result\":\"failed\"}");
            paymentRepository.save(payment);
            throw new FinanceServiceException(HttpStatus.PAYMENT_REQUIRED, "FIN-4002", "Payment gateway declined transaction");
        }

        if (usesRazorpay(request)) {
            RazorpayClient.RazorpayOrderResponse order = razorpayClient.createOrder(
                    request.amount(),
                    request.currency().toUpperCase(Locale.ROOT),
                    payment.getGatewayReference()
            );
            payment.setPaymentStatus(PaymentStatus.PENDING);
            payment.setGatewayOrderId(order.id());
            payment.setGatewayPayload("{\"razorpayOrderStatus\":\"" + order.status() + "\"}");
        } else {
            payment.setPaymentStatus(request.paymentMethod().name().equals("BANK_TRANSFER") ? PaymentStatus.PENDING : PaymentStatus.SUCCEEDED);
            if (payment.getPaymentStatus() == PaymentStatus.SUCCEEDED) {
                payment.setPaymentDate(OffsetDateTime.now());
                payment.setGatewayPayload("{\"simulated\":true,\"result\":\"captured\"}");
            } else {
                payment.setGatewayPayload("{\"simulated\":true,\"result\":\"pending_settlement\"}");
            }
        }
        Payment savedPayment = paymentRepository.save(payment);
        if (savedPayment.getPaymentStatus() == PaymentStatus.SUCCEEDED) {
            savedPayment = ensureInvoiceStored(savedPayment);
            savedPayment = normalizeStoredInvoiceUrl(savedPayment);
            confirmLinkedResource(savedPayment);
            sendPaymentSuccessNotification(savedPayment);
        }
        return financeMapper.toPaymentResponse(savedPayment);
    }

    @Transactional
    public PaymentResponse verifyRazorpayPayment(VerifyRazorpayPaymentRequest request, boolean allowLocalDevFallback) {
        Payment payment = paymentRepository.findByGatewayOrderId(request.razorpayOrderId())
                .orElseThrow(() -> new FinanceServiceException(HttpStatus.NOT_FOUND, "FIN-4042", "Payment not found"));
        if (!verifySignature(request, allowLocalDevFallback)) {
            payment.setPaymentStatus(PaymentStatus.FAILED);
            payment.setGatewayPayload("{\"verification\":\"failed\"}");
            paymentRepository.save(payment);
            throw new FinanceServiceException(HttpStatus.PAYMENT_REQUIRED, "FIN-4002", "Razorpay signature verification failed");
        }
        PaymentStatus previousStatus = payment.getPaymentStatus();
        payment.setPaymentStatus(PaymentStatus.SUCCEEDED);
        payment.setGatewayPaymentId(request.razorpayPaymentId());
        payment.setGatewaySignature(request.razorpaySignature());
        reconcilePaymentMethod(payment, request.razorpayPaymentId());
        payment.setPaymentDate(OffsetDateTime.now());
        payment.setGatewayPayload("{\"verification\":\"passed\"}");
        Payment savedPayment = paymentRepository.save(payment);
        if (previousStatus != PaymentStatus.SUCCEEDED) {
            savedPayment = ensureInvoiceStored(savedPayment);
            savedPayment = normalizeStoredInvoiceUrl(savedPayment);
            confirmLinkedResource(savedPayment);
            sendPaymentSuccessNotification(savedPayment);
        }
        return financeMapper.toPaymentResponse(savedPayment);
    }

    @Transactional
    public PaymentResponse handleWebhook(PaymentWebhookRequest request) {
        Payment payment = paymentRepository.findByGatewayReference(request.gatewayReference())
                .orElseThrow(() -> new FinanceServiceException(HttpStatus.NOT_FOUND, "FIN-4042", "Payment not found"));
        PaymentStatus previousStatus = payment.getPaymentStatus();
        payment.setPaymentStatus(request.status());
        payment.setGatewayPayload(request.gatewayPayload());
        if (request.status() == PaymentStatus.SUCCEEDED) {
            payment.setPaymentDate(OffsetDateTime.now());
        }
        Payment savedPayment = paymentRepository.save(payment);
        if (request.status() == PaymentStatus.SUCCEEDED && previousStatus != PaymentStatus.SUCCEEDED) {
            savedPayment = ensureInvoiceStored(savedPayment);
            savedPayment = normalizeStoredInvoiceUrl(savedPayment);
            confirmLinkedResource(savedPayment);
            sendPaymentSuccessNotification(savedPayment);
        }
        return financeMapper.toPaymentResponse(savedPayment);
    }

    @Transactional
    public List<PaymentResponse> listPaymentsForUser(AuthenticatedUser actor) {
        return paymentRepository.findByCreatedByUserIdOrderByCreatedAtDesc(actor.id())
                .stream()
                .map(this::normalizeStoredInvoiceUrl)
                .map(financeMapper::toPaymentResponse)
                .toList();
    }

    @Transactional
    public byte[] getInvoicePdf(UUID paymentId, AuthenticatedUser actor) {
        Payment payment = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new FinanceServiceException(HttpStatus.NOT_FOUND, "FIN-4042", "Payment not found"));

        if (actor == null || actor.id() == null || payment.getCreatedByUserId() == null || !payment.getCreatedByUserId().equals(actor.id())) {
            throw new FinanceServiceException(HttpStatus.FORBIDDEN, "FIN-4030", "You do not have access to this invoice");
        }

        if (payment.getPaymentStatus() == PaymentStatus.SUCCEEDED && payment.getInvoiceObjectKey() == null) {
            payment = ensureInvoiceStored(payment);
            payment = normalizeStoredInvoiceUrl(payment);
        }

        byte[] invoicePdf = invoiceAssetService.downloadInvoice(payment);
        if (invoicePdf == null || invoicePdf.length == 0) {
            throw new FinanceServiceException(HttpStatus.NOT_FOUND, "FIN-4043", "Invoice PDF not found");
        }

        return invoicePdf;
    }

    private void confirmLinkedResource(Payment payment) {
        if (payment.getRegistrationId() != null) {
            ticketingClient.confirmRegistrationPayment(payment.getRegistrationId());
        }
        if (payment.getVenueBookingId() != null) {
            venueBookingClient.confirmVenueBookingPayment(payment);
        }
    }

    private void sendPaymentSuccessNotification(Payment payment) {
        if (payment.getCreatedByUserId() == null || payment.getCustomerEmail() == null || payment.getCustomerEmail().isBlank()) {
            return;
        }

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("paymentId", payment.getId());
        metadata.put("eventId", payment.getEventId());
        metadata.put("eventName", payment.getEventName());
        metadata.put("registrationId", payment.getRegistrationId());
        metadata.put("venueBookingId", payment.getVenueBookingId());
        metadata.put("amount", payment.getAmount());
        metadata.put("currency", payment.getCurrency());
        metadata.put("gatewayReference", payment.getGatewayReference());
        metadata.put("invoiceNumber", payment.getInvoiceNumber());
        metadata.put("invoiceUrl", payment.getInvoiceUrl());

        String subjectPrefix = payment.getVenueBookingId() != null ? "Venue payment received - " : "Thank you for your purchase - ";
        String bodyPrefix = payment.getVenueBookingId() != null
                ? "We have received your venue booking payment for "
                : "Thank you for your purchase. We have received your payment for ";

        notificationClient.sendInAppNotification(
                payment.getCreatedByUserId(),
                payment.getCustomerEmail(),
                "payment.received",
                                subjectPrefix + payment.getEventName(),
                                bodyPrefix + payment.getEventName()
                                                + ". Payment reference: " + payment.getGatewayReference() + ".",
                                buildPaymentSuccessHtml(payment),
                metadata
        );
    }

    private Payment ensureInvoiceStored(Payment payment) {
        if (payment.getPaymentStatus() != PaymentStatus.SUCCEEDED || payment.getInvoiceUrl() != null) {
            return payment;
        }

        InvoiceAssetService.StoredInvoice storedInvoice = invoiceAssetService.uploadInvoice(payment);
        if (storedInvoice == null) {
            return payment;
        }

        payment.setInvoiceNumber(storedInvoice.invoiceNumber());
        payment.setInvoiceObjectKey(storedInvoice.objectKey());
        payment.setInvoiceUrl(storedInvoice.publicUrl());
        return paymentRepository.save(payment);
    }

    private Payment normalizeStoredInvoiceUrl(Payment payment) {
        String resolvedInvoiceUrl = invoiceAssetService.resolvePublicUrl(payment);
        if (resolvedInvoiceUrl == null || resolvedInvoiceUrl.equals(payment.getInvoiceUrl())) {
            return payment;
        }
        payment.setInvoiceUrl(resolvedInvoiceUrl);
        return paymentRepository.save(payment);
    }

    private String buildPaymentSuccessHtml(Payment payment) {
        String eventName = escapeHtml(payment.getEventName() != null ? payment.getEventName() : "your event");
        String reference = escapeHtml(payment.getGatewayReference() != null ? payment.getGatewayReference() : "N/A");
        String amount = escapeHtml(String.valueOf(payment.getAmount()));
        String currency = escapeHtml(payment.getCurrency() != null ? payment.getCurrency() : "");
        String paidOn = payment.getPaymentDate() != null
                ? escapeHtml(payment.getPaymentDate().toString())
                : escapeHtml(OffsetDateTime.now().toString());

        return String.format(
                """
                <!doctype html>
                <html lang="en">
                <head>
                    <meta charset="utf-8" />
                    <meta name="viewport" content="width=device-width, initial-scale=1" />
                    <title>Payment Confirmation</title>
                </head>
                <body style="margin:0;padding:0;background:#f3f6fb;font-family:Segoe UI,Arial,sans-serif;color:#0f172a;">
                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="background:#f3f6fb;padding:28px 12px;">
                        <tr>
                            <td align="center">
                                <table role="presentation" width="640" cellspacing="0" cellpadding="0" style="max-width:640px;width:100%%;background:#ffffff;border:1px solid #dbe4f0;border-radius:14px;overflow:hidden;">
                                    <tr>
                                        <td style="background:#0b1f6d;padding:22px 24px;color:#ffffff;">
                                            <p style="margin:0;font-size:12px;letter-spacing:.08em;text-transform:uppercase;opacity:.9;">EventZen Payments</p>
                                            <h1 style="margin:10px 0 0 0;font-size:24px;line-height:1.2;">Thank you for your purchase</h1>
                                        </td>
                                    </tr>
                                    <tr>
                                        <td style="padding:24px;">
                                            <p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;">Your payment has been successfully received for <strong>%s</strong>.</p>
                                            <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;">
                                                <tr>
                                                    <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">Amount Paid</td>
                                                    <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;text-align:right;">%s %s</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#475569;">Payment Reference</td>
                                                    <td style="padding:12px 14px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;text-align:right;">%s</td>
                                                </tr>
                                                <tr>
                                                    <td style="padding:12px 14px;font-size:13px;color:#475569;">Paid On</td>
                                                    <td style="padding:12px 14px;font-size:13px;font-weight:700;text-align:right;">%s</td>
                                                </tr>
                                            </table>
                                            <p style="margin:14px 0 0 0;font-size:12px;line-height:1.5;color:#64748b;">Please keep this email for your records. If you did not make this purchase, contact support immediately.</p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </body>
                </html>
                """,
                eventName,
                amount,
                currency,
                reference,
                paidOn
        );
    }

    private String escapeHtml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private boolean usesRazorpay(CreatePaymentRequest request) {
        return razorpayClient.enabled()
                && (request.paymentMethod().name().equals("CARD")
                || request.paymentMethod().name().equals("UPI")
                || request.paymentMethod().name().equals("NETBANKING")
                || request.paymentMethod().name().equals("BANK_TRANSFER")
                || request.paymentMethod().name().equals("WALLET")
                || request.paymentMethod().name().equals("PAY_LATER"));
    }

    private void reconcilePaymentMethod(Payment payment, String razorpayPaymentId) {
        if (!razorpayClient.enabled() || razorpayPaymentId == null || razorpayPaymentId.isBlank()) {
            return;
        }

        try {
            RazorpayClient.RazorpayPaymentResponse gatewayPayment = razorpayClient.fetchPayment(razorpayPaymentId);
            PaymentMethod resolvedMethod = mapRazorpayMethod(gatewayPayment.method());
            if (resolvedMethod != null) {
                payment.setPaymentMethod(resolvedMethod);
            }
        } catch (Exception exception) {
            log.warn("Unable to reconcile payment method from Razorpay for paymentId={}", razorpayPaymentId, exception);
        }
    }

    private PaymentMethod mapRazorpayMethod(String method) {
        if (method == null || method.isBlank()) {
            return null;
        }

        return switch (method.trim().toLowerCase(Locale.ROOT)) {
            case "upi" -> PaymentMethod.UPI;
            case "netbanking" -> PaymentMethod.NETBANKING;
            case "bank_transfer" -> PaymentMethod.BANK_TRANSFER;
            case "cash" -> PaymentMethod.CASH;
            case "wallet" -> PaymentMethod.WALLET;
            case "paylater", "pay_later" -> PaymentMethod.PAY_LATER;
            case "card", "credit_card", "debit_card", "emi" -> PaymentMethod.CARD;
            default -> null;
        };
    }

    private boolean verifySignature(VerifyRazorpayPaymentRequest request, boolean allowLocalDevFallback) {
        if (allowLocalDevFallback) {
            return true;
        }

        try {
            String payload = request.razorpayOrderId() + "|" + request.razorpayPaymentId();
            Mac sha256 = Mac.getInstance("HmacSHA256");
            sha256.init(new SecretKeySpec(razorpayProperties.keySecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] digest = sha256.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            String expected = toHex(digest);
            return expected.equals(request.razorpaySignature());
        } catch (Exception exception) {
            throw new FinanceServiceException(HttpStatus.INTERNAL_SERVER_ERROR, "FIN-500", "Unable to verify Razorpay signature");
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder builder = new StringBuilder(bytes.length * 2);
        for (byte value : bytes) {
            builder.append(String.format("%02x", value));
        }
        return builder.toString();
    }
}
