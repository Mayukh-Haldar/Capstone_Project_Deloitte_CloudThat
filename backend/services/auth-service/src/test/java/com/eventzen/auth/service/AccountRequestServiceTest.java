package com.eventzen.auth.service;

import com.eventzen.auth.dto.CreateAccountRequestRequest;
import com.eventzen.auth.dto.ReviewAccountRequestRequest;
import com.eventzen.auth.entity.AccountRequest;
import com.eventzen.auth.entity.AccountRequestStatus;
import com.eventzen.auth.entity.AccountRequestType;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.exception.EventZenException;
import com.eventzen.auth.repository.AccountRequestRepository;
import com.eventzen.auth.repository.UserRepository;
import com.eventzen.auth.repository.UserRoleRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AccountRequestServiceTest {

    @Mock
    private AccountRequestRepository accountRequestRepository;
    @Mock
    private UserRepository userRepository;
    @Mock
    private UserRoleRepository userRoleRepository;
    @Mock
    private UserManagementService userManagementService;
    @Mock
    private NotificationClient notificationClient;

    private AccountRequestService accountRequestService;

    @BeforeEach
    void setUp() {
        accountRequestService = new AccountRequestService(
                accountRequestRepository,
                userRepository,
                userRoleRepository,
                userManagementService,
                notificationClient,
                new AccountRequestMapper()
        );
    }

    @Test
    void submitRequestCreatesPendingRequest() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(accountRequestRepository.existsByUser_IdAndTypeAndStatus(user.getId(), AccountRequestType.DEACTIVATE, AccountRequestStatus.PENDING))
                .thenReturn(false);
        when(accountRequestRepository.save(any(AccountRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = accountRequestService.submitRequest(
                user.getId(),
                new CreateAccountRequestRequest(AccountRequestType.DEACTIVATE, "Need a temporary pause")
        );

        assertThat(response.status()).isEqualTo(AccountRequestStatus.PENDING);
        assertThat(response.type()).isEqualTo(AccountRequestType.DEACTIVATE);
        assertThat(response.reason()).isEqualTo("Need a temporary pause");
    }

    @Test
    void submitRequestRejectsDuplicatePendingType() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(accountRequestRepository.existsByUser_IdAndTypeAndStatus(user.getId(), AccountRequestType.DEACTIVATE, AccountRequestStatus.PENDING))
                .thenReturn(true);

        assertThatThrownBy(() -> accountRequestService.submitRequest(
                user.getId(),
                new CreateAccountRequestRequest(AccountRequestType.DEACTIVATE, null)
        )).isInstanceOf(EventZenException.class);

        verify(accountRequestRepository, never()).save(any(AccountRequest.class));
    }

    @Test
    void approveRequestExecutesUnderlyingUserAction() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        AccountRequest request = AccountRequest.submit(user, AccountRequestType.GDPR_DELETE, "Please erase my data");
        UUID requestId = UUID.randomUUID();
        UUID adminUserId = UUID.randomUUID();

        when(accountRequestRepository.findById(requestId)).thenReturn(Optional.of(request));
        when(accountRequestRepository.save(any(AccountRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = accountRequestService.approveRequest(
                requestId,
                adminUserId,
                new ReviewAccountRequestRequest("Approved for compliance")
        );

        assertThat(response.status()).isEqualTo(AccountRequestStatus.APPROVED);
        assertThat(response.adminComment()).isEqualTo("Approved for compliance");
        verify(userManagementService).gdprDelete(user.getId());
        verify(notificationClient).sendInAppNotification(any(), any(String.class), any(String.class), any(String.class), any(String.class), any());
    }

    @Test
    void rejectRequestMarksRequestRejected() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        AccountRequest request = AccountRequest.submit(user, AccountRequestType.DEACTIVATE, null);
        UUID requestId = UUID.randomUUID();
        UUID adminUserId = UUID.randomUUID();

        when(accountRequestRepository.findById(requestId)).thenReturn(Optional.of(request));
        when(accountRequestRepository.save(any(AccountRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = accountRequestService.rejectRequest(
                requestId,
                adminUserId,
                new ReviewAccountRequestRequest("Business need requires active account")
        );

        assertThat(response.status()).isEqualTo(AccountRequestStatus.REJECTED);
        assertThat(response.adminComment()).isEqualTo("Business need requires active account");
        verify(userManagementService, never()).deactivateUser(any(UUID.class));
        verify(notificationClient).sendInAppNotification(any(), any(String.class), any(String.class), any(String.class), any(String.class), any());
    }

    @Test
    void cancelMyRequestOnlyWorksForPendingRequests() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        AccountRequest request = AccountRequest.submit(user, AccountRequestType.DEACTIVATE, null);
        UUID requestId = UUID.randomUUID();

        when(accountRequestRepository.findByIdAndUser_Id(requestId, user.getId())).thenReturn(Optional.of(request));

        accountRequestService.cancelMyRequest(user.getId(), requestId);

        ArgumentCaptor<AccountRequest> captor = ArgumentCaptor.forClass(AccountRequest.class);
        verify(accountRequestRepository).save(captor.capture());
        assertThat(captor.getValue().getStatus()).isEqualTo(AccountRequestStatus.CANCELED);
    }

    @Test
    void publicReactivationRequestCreatesPendingRequestForInactiveUser() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        user.deactivate();

        when(userRepository.findByEmailIgnoreCase("mayuk@example.com")).thenReturn(Optional.of(user));
        when(accountRequestRepository.existsByUser_IdAndTypeAndStatus(user.getId(), AccountRequestType.REACTIVATE, AccountRequestStatus.PENDING))
                .thenReturn(false);

        accountRequestService.submitPublicReactivationRequest(
                new com.eventzen.auth.dto.PublicReactivationRequest("mayuk@example.com", "Please restore access")
        );

        verify(accountRequestRepository).save(any(AccountRequest.class));
    }

    @Test
    void publicReactivationStatusReportsPendingRequestForInactiveUser() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        user.deactivate();

        when(userRepository.findByEmailIgnoreCase("mayuk@example.com")).thenReturn(Optional.of(user));
        when(accountRequestRepository.existsByUser_IdAndTypeAndStatus(user.getId(), AccountRequestType.REACTIVATE, AccountRequestStatus.PENDING))
                .thenReturn(true);

        var response = accountRequestService.getPublicReactivationStatus("mayuk@example.com");

        assertThat(response.accountInactive()).isTrue();
        assertThat(response.hasPendingRequest()).isTrue();
    }

    @Test
    void approveVendorAccessGrantsVendorRoleSet() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        AccountRequest request = AccountRequest.submit(user, AccountRequestType.VENDOR_ACCESS, "I want to host events");
        UUID requestId = UUID.randomUUID();
        UUID adminUserId = UUID.randomUUID();

        when(accountRequestRepository.findById(requestId)).thenReturn(Optional.of(request));
        when(accountRequestRepository.save(any(AccountRequest.class))).thenAnswer(invocation -> invocation.getArgument(0));

        var response = accountRequestService.approveRequest(
                requestId,
                adminUserId,
                new ReviewAccountRequestRequest("Approved for vendor onboarding")
        );

        assertThat(response.status()).isEqualTo(AccountRequestStatus.APPROVED);
        verify(userManagementService).grantVendorAccess(user.getId());
        verify(notificationClient).sendInAppNotification(any(), any(String.class), any(String.class), any(String.class), any(String.class), any());
    }
}
