package com.eventzen.finance.controller;

import com.eventzen.finance.dto.CreatePaymentRequest;
import com.eventzen.finance.dto.PaymentResponse;
import com.eventzen.finance.dto.PaymentWebhookRequest;
import com.eventzen.finance.dto.VerifyRazorpayPaymentRequest;
import com.eventzen.finance.security.AuthenticatedUser;
import java.util.List;
import java.util.UUID;
import com.eventzen.finance.service.PaymentService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/payments")
public class PaymentController {

    private final PaymentService paymentService;

    public PaymentController(PaymentService paymentService) {
        this.paymentService = paymentService;
    }

    @PostMapping({"", "/"})
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("isAuthenticated()")
    PaymentResponse initiatePayment(@Valid @RequestBody CreatePaymentRequest request, @AuthenticationPrincipal AuthenticatedUser actor) {
        return paymentService.initiatePayment(request, actor);
    }

    @GetMapping({"/me", "/me/"})
    @PreAuthorize("isAuthenticated()")
    List<PaymentResponse> myPayments(@AuthenticationPrincipal AuthenticatedUser actor) {
        return paymentService.listPaymentsForUser(actor);
    }

    @GetMapping({"/{paymentId}/invoice", "/{paymentId}/invoice/"})
    @PreAuthorize("isAuthenticated()")
    ResponseEntity<byte[]> downloadInvoice(
            @PathVariable UUID paymentId,
            @AuthenticationPrincipal AuthenticatedUser actor
    ) {
        byte[] pdfBytes = paymentService.getInvoicePdf(paymentId, actor);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline()
                        .filename("invoice-" + paymentId + ".pdf")
                        .build()
                        .toString())
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdfBytes);
    }

    @PostMapping({"/webhook", "/webhook/"})
    PaymentResponse webhook(@Valid @RequestBody PaymentWebhookRequest request) {
        return paymentService.handleWebhook(request);
    }

    @PostMapping({"/verify", "/verify/"})
    @PreAuthorize("isAuthenticated()")
    PaymentResponse verify(@Valid @RequestBody VerifyRazorpayPaymentRequest request, HttpServletRequest httpRequest) {
        return paymentService.verifyRazorpayPayment(request, isLocalhostRequest(httpRequest));
    }

    private boolean isLocalhostRequest(HttpServletRequest request) {
        String serverName = request.getServerName();
        if ("localhost".equalsIgnoreCase(serverName) || "127.0.0.1".equals(serverName) || "::1".equals(serverName)) {
            return true;
        }

        String remoteAddr = request.getRemoteAddr();
        return "127.0.0.1".equals(remoteAddr) || "::1".equals(remoteAddr) || "0:0:0:0:0:0:0:1".equals(remoteAddr);
    }
}
