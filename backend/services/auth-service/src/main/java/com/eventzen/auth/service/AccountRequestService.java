package com.eventzen.auth.service;

import com.eventzen.auth.dto.AccountRequestResponse;
import com.eventzen.auth.dto.CreateAccountRequestRequest;
import com.eventzen.auth.dto.PublicReactivationRequest;
import com.eventzen.auth.dto.PublicReactivationStatusResponse;
import com.eventzen.auth.dto.ReviewAccountRequestRequest;
import com.eventzen.auth.entity.AccountRequest;
import com.eventzen.auth.entity.AccountRequestStatus;
import com.eventzen.auth.entity.AccountRequestType;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.exception.EventZenException;
import com.eventzen.auth.repository.AccountRequestRepository;
import com.eventzen.auth.repository.UserRoleRepository;
import com.eventzen.auth.security.RoleName;
import com.eventzen.auth.repository.UserRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AccountRequestService {

    private final AccountRequestRepository accountRequestRepository;
    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final UserManagementService userManagementService;
    private final NotificationClient notificationClient;
    private final AccountRequestMapper accountRequestMapper;

    public AccountRequestService(
            AccountRequestRepository accountRequestRepository,
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            UserManagementService userManagementService,
            NotificationClient notificationClient,
            AccountRequestMapper accountRequestMapper
    ) {
        this.accountRequestRepository = accountRequestRepository;
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.userManagementService = userManagementService;
        this.notificationClient = notificationClient;
        this.accountRequestMapper = accountRequestMapper;
    }

    @Transactional
    public AccountRequestResponse submitRequest(UUID userId, CreateAccountRequestRequest request) {
        User user = findUser(userId);
        validateSubmission(user, request.type());

        if (accountRequestRepository.existsByUser_IdAndTypeAndStatus(userId, request.type(), AccountRequestStatus.PENDING)) {
            throw new EventZenException(HttpStatus.CONFLICT, "BUSINESS_ERROR", "AUTH-2001", "You already have a pending request of this type");
        }

        AccountRequest saved = accountRequestRepository.save(AccountRequest.submit(user, request.type(), request.reason()));
        return accountRequestMapper.toResponse(saved);
    }

    @Transactional(readOnly = true)
    public List<AccountRequestResponse> listMyRequests(UUID userId) {
        return accountRequestRepository.findAllByUser_IdOrderByCreatedAtDesc(userId).stream()
                .map(accountRequestMapper::toResponse)
                .toList();
    }

    @Transactional
    public void submitPublicReactivationRequest(PublicReactivationRequest request) {
        userRepository.findByEmailIgnoreCase(request.email().trim())
                .filter(user -> !user.isActive())
                .filter(user -> user.getDeletedAt() == null)
                .ifPresent(user -> {
                    if (!accountRequestRepository.existsByUser_IdAndTypeAndStatus(user.getId(), AccountRequestType.REACTIVATE, AccountRequestStatus.PENDING)) {
                        accountRequestRepository.save(AccountRequest.submit(user, AccountRequestType.REACTIVATE, request.reason()));
                    }
                });
    }

    @Transactional(readOnly = true)
    public PublicReactivationStatusResponse getPublicReactivationStatus(String email) {
        return userRepository.findByEmailIgnoreCase(email.trim())
                .filter(user -> user.getDeletedAt() == null)
                .map(user -> {
                    boolean inactive = !user.isActive();
                    boolean hasPendingRequest = inactive && accountRequestRepository.existsByUser_IdAndTypeAndStatus(
                            user.getId(),
                            AccountRequestType.REACTIVATE,
                            AccountRequestStatus.PENDING
                    );
                    return new PublicReactivationStatusResponse(inactive, hasPendingRequest);
                })
                .orElse(new PublicReactivationStatusResponse(false, false));
    }

    @Transactional
    public void cancelMyRequest(UUID userId, UUID requestId) {
        AccountRequest request = accountRequestRepository.findByIdAndUser_Id(requestId, userId)
                .orElseThrow(() -> new EventZenException(HttpStatus.NOT_FOUND, "BUSINESS_ERROR", "AUTH-2002", "Request not found"));
        ensurePending(request);
        request.cancel();
        accountRequestRepository.save(request);
    }

    @Transactional(readOnly = true)
    public List<AccountRequestResponse> listRequests(AccountRequestStatus status) {
        List<AccountRequest> requests = status == null
                ? accountRequestRepository.findAllByOrderByCreatedAtDesc()
                : accountRequestRepository.findAllByStatusOrderByCreatedAtAsc(status);
        return requests.stream().map(accountRequestMapper::toResponse).toList();
    }

    @Transactional
    public AccountRequestResponse approveRequest(UUID requestId, UUID adminUserId, ReviewAccountRequestRequest request) {
        AccountRequest accountRequest = findRequest(requestId);
        ensurePending(accountRequest);

        switch (accountRequest.getType()) {
            case DEACTIVATE -> userManagementService.deactivateUser(accountRequest.getUser().getId());
            case REACTIVATE -> userManagementService.reactivateUser(accountRequest.getUser().getId());
            case GDPR_DELETE -> userManagementService.gdprDelete(accountRequest.getUser().getId());
            case VENDOR_ACCESS -> userManagementService.grantVendorAccess(accountRequest.getUser().getId());
        }

        accountRequest.approve(adminUserId, request.adminComment());
        AccountRequest saved = accountRequestRepository.save(accountRequest);
        sendReviewNotification(saved, true);
        return accountRequestMapper.toResponse(saved);
    }

    @Transactional
    public AccountRequestResponse rejectRequest(UUID requestId, UUID adminUserId, ReviewAccountRequestRequest request) {
        AccountRequest accountRequest = findRequest(requestId);
        ensurePending(accountRequest);
        accountRequest.reject(adminUserId, request.adminComment());
        AccountRequest saved = accountRequestRepository.save(accountRequest);
        sendReviewNotification(saved, false);
        return accountRequestMapper.toResponse(saved);
    }

    private void sendReviewNotification(AccountRequest request, boolean approved) {
        User user = request.getUser();
        if (user == null || user.getEmail() == null || user.getEmail().isBlank()) {
            return;
        }

        String action = approved ? "approved" : "rejected";
        String requestLabel = getRequestLabel(request.getType());
        String title = capitalize(requestLabel) + " request " + action;
        String body = "Your " + requestLabel + " request was " + action + ".";
        if (request.getAdminComment() != null && !request.getAdminComment().isBlank()) {
            body += " Admin note: " + request.getAdminComment();
        }

        LinkedHashMap<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("requestId", request.getId());
        metadata.put("requestType", request.getType().name());
        metadata.put("requestStatus", request.getStatus().name());
        metadata.put("adminComment", request.getAdminComment());
        metadata.put("reviewedAt", request.getReviewedAt());
        metadata.put("reviewedBy", request.getReviewedBy());

        notificationClient.sendInAppNotification(
                user.getId(),
                user.getEmail(),
                approved ? "account-request.approved" : "account-request.rejected",
                title,
                body,
                metadata
        );
    }

    private String getRequestLabel(AccountRequestType type) {
        return switch (type) {
            case DEACTIVATE -> "account deactivation";
            case REACTIVATE -> "account reactivation";
            case GDPR_DELETE -> "gdpr deletion";
            case VENDOR_ACCESS -> "vendor access";
        };
    }

    private String capitalize(String value) {
        if (value == null || value.isBlank()) {
            return "Account";
        }
        return Character.toUpperCase(value.charAt(0)) + value.substring(1);
    }

    private void validateSubmission(User user, AccountRequestType type) {
        if (user.getDeletedAt() != null) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-2003", "This account has already been deleted");
        }
        if (type == AccountRequestType.DEACTIVATE && !user.isActive()) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-2004", "Your account is already inactive");
        }
        if (type == AccountRequestType.REACTIVATE && user.isActive()) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-2005", "Your account is already active");
        }
        if (type == AccountRequestType.VENDOR_ACCESS) {
            boolean alreadyVendor = userRoleRepository.findAllByUser_Id(user.getId()).stream()
                    .anyMatch(userRole -> userRole.getRole().getName() == RoleName.VENDOR || userRole.getRole().getName() == RoleName.ORGANIZER);
            boolean alreadyAdmin = userRoleRepository.findAllByUser_Id(user.getId()).stream()
                    .anyMatch(userRole -> userRole.getRole().getName() == RoleName.ADMIN);
            if (alreadyVendor || alreadyAdmin) {
                throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-2007", "Your account already has elevated access");
            }
        }
    }

    private void ensurePending(AccountRequest request) {
        if (request.getStatus() != AccountRequestStatus.PENDING) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-2006", "Only pending requests can be reviewed");
        }
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new EventZenException(HttpStatus.NOT_FOUND, "BUSINESS_ERROR", "AUTH-1006", "User not found"));
    }

    private AccountRequest findRequest(UUID requestId) {
        return accountRequestRepository.findById(requestId)
                .orElseThrow(() -> new EventZenException(HttpStatus.NOT_FOUND, "BUSINESS_ERROR", "AUTH-2002", "Request not found"));
    }
}
