package com.eventzen.auth.controller;

import com.eventzen.auth.dto.AccountRequestResponse;
import com.eventzen.auth.dto.ApiMessageResponse;
import com.eventzen.auth.dto.CreateAccountRequestRequest;
import com.eventzen.auth.dto.PublicReactivationRequest;
import com.eventzen.auth.dto.PublicReactivationStatusResponse;
import com.eventzen.auth.dto.ReviewAccountRequestRequest;
import com.eventzen.auth.entity.AccountRequestStatus;
import com.eventzen.auth.security.CurrentUserPrincipal;
import com.eventzen.auth.service.AccountRequestService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/account-requests")
public class AccountRequestController {

    private final AccountRequestService accountRequestService;

    public AccountRequestController(AccountRequestService accountRequestService) {
        this.accountRequestService = accountRequestService;
    }

    @PostMapping
    public ResponseEntity<AccountRequestResponse> submit(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @Valid @RequestBody CreateAccountRequestRequest request
    ) {
        return ResponseEntity.ok(accountRequestService.submitRequest(principal.getUser().getId(), request));
    }

    @GetMapping("/me")
    public ResponseEntity<List<AccountRequestResponse>> listMine(@AuthenticationPrincipal CurrentUserPrincipal principal) {
        return ResponseEntity.ok(accountRequestService.listMyRequests(principal.getUser().getId()));
    }

    @PostMapping("/public/reactivation")
    public ResponseEntity<ApiMessageResponse> requestPublicReactivation(@Valid @RequestBody PublicReactivationRequest request) {
        accountRequestService.submitPublicReactivationRequest(request);
        return ResponseEntity.ok(new ApiMessageResponse("If the account is eligible for reactivation, your request has been submitted"));
    }

    @GetMapping("/public/reactivation/status")
    public ResponseEntity<PublicReactivationStatusResponse> publicReactivationStatus(@RequestParam String email) {
        return ResponseEntity.ok(accountRequestService.getPublicReactivationStatus(email));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiMessageResponse> cancelMine(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable UUID id
    ) {
        accountRequestService.cancelMyRequest(principal.getUser().getId(), id);
        return ResponseEntity.ok(new ApiMessageResponse("Request canceled"));
    }

    @GetMapping("/admin")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AccountRequestResponse>> listForAdmin(
            @RequestParam(required = false) AccountRequestStatus status
    ) {
        return ResponseEntity.ok(accountRequestService.listRequests(status));
    }

    @PatchMapping("/admin/{id}/approve")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AccountRequestResponse> approve(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody ReviewAccountRequestRequest request
    ) {
        return ResponseEntity.ok(accountRequestService.approveRequest(id, principal.getUser().getId(), request));
    }

    @PatchMapping("/admin/{id}/reject")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<AccountRequestResponse> reject(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody ReviewAccountRequestRequest request
    ) {
        return ResponseEntity.ok(accountRequestService.rejectRequest(id, principal.getUser().getId(), request));
    }
}
