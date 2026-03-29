package com.eventzen.auth.controller;

import com.eventzen.auth.dto.ApiMessageResponse;
import com.eventzen.auth.dto.AssignRolesRequest;
import com.eventzen.auth.dto.PagedResponse;
import com.eventzen.auth.dto.UserResponse;
import com.eventzen.auth.security.CurrentUserPrincipal;
import com.eventzen.auth.service.UserManagementService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserManagementService userManagementService;

    public UserController(UserManagementService userManagementService) {
        this.userManagementService = userManagementService;
    }

    @GetMapping
    public ResponseEntity<PagedResponse<UserResponse>> listUsers(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size
    ) {
        return ResponseEntity.ok(userManagementService.listUsers(PageRequest.of(page, size)));
    }

    @PutMapping("/{id}/roles")
    public ResponseEntity<UserResponse> assignRoles(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable UUID id,
            @Valid @RequestBody AssignRolesRequest request
    ) {
        return ResponseEntity.ok(userManagementService.assignRoles(principal.getUser().getId(), id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiMessageResponse> deactivate(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable UUID id
    ) {
        userManagementService.deactivateUser(principal.getUser().getId(), id);
        return ResponseEntity.ok(new ApiMessageResponse("User deactivated"));
    }

    @PatchMapping("/{id}/reactivate")
    public ResponseEntity<ApiMessageResponse> reactivate(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable UUID id
    ) {
        userManagementService.reactivateUser(principal.getUser().getId(), id);
        return ResponseEntity.ok(new ApiMessageResponse("User reactivated"));
    }

    @DeleteMapping("/{id}/gdpr/delete")
    public ResponseEntity<ApiMessageResponse> gdprDelete(
            @AuthenticationPrincipal CurrentUserPrincipal principal,
            @PathVariable UUID id
    ) {
        userManagementService.gdprDelete(principal.getUser().getId(), id);
        return ResponseEntity.ok(new ApiMessageResponse("User deleted for GDPR request"));
    }
}
