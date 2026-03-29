package com.eventzen.auth.service;

import com.eventzen.auth.dto.AssignRolesRequest;
import com.eventzen.auth.dto.PagedResponse;
import com.eventzen.auth.dto.UserResponse;
import com.eventzen.auth.entity.Role;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.entity.UserRole;
import com.eventzen.auth.security.RoleName;
import com.eventzen.auth.exception.EventZenException;
import com.eventzen.auth.repository.RefreshTokenRepository;
import com.eventzen.auth.repository.RoleRepository;
import com.eventzen.auth.repository.UserRepository;
import com.eventzen.auth.repository.UserRoleRepository;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class UserManagementService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final UserRoleRepository userRoleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final UserMapper userMapper;

    public UserManagementService(
            UserRepository userRepository,
            RoleRepository roleRepository,
            UserRoleRepository userRoleRepository,
            RefreshTokenRepository refreshTokenRepository,
            UserMapper userMapper
    ) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.userRoleRepository = userRoleRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.userMapper = userMapper;
    }

    public PagedResponse<UserResponse> listUsers(Pageable pageable) {
        var page = userRepository.findAll(pageable).map(userMapper::toUserResponse);
        return new PagedResponse<>(page.getContent(), page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }

    @Transactional
    public UserResponse assignRoles(UUID actorId, UUID userId, AssignRolesRequest request) {
        assertAdminIsNotManagingOwnAccount(actorId, userId);
        User user = findUser(userId);
        List<Role> roles = roleRepository.findAllByNameIn(request.roles());
        if (roles.size() != request.roles().size()) {
            throw new EventZenException(HttpStatus.BAD_REQUEST, "BUSINESS_ERROR", "AUTH-1008", "One or more requested roles are invalid");
        }

        userRoleRepository.deleteAllByUser_Id(userId);
        for (Role role : roles) {
            userRoleRepository.save(UserRole.of(user, role, userId));
        }
        return userMapper.toUserResponse(user);
    }

    @Transactional
    public UserResponse grantVendorAccess(UUID actorId, UUID userId) {
        return assignRoles(actorId, userId, new AssignRolesRequest(Set.of(RoleName.ORGANIZER, RoleName.VENDOR)));
    }

    @Transactional
    public void deactivateUser(UUID actorId, UUID userId) {
        assertAdminIsNotManagingOwnAccount(actorId, userId);
        User user = findUser(userId);
        user.deactivate();
        userRepository.save(user);
        refreshTokenRepository.findAllByUser_Id(userId).forEach(token -> {
            token.revoke();
            refreshTokenRepository.save(token);
        });
    }

    @Transactional
    public void reactivateUser(UUID actorId, UUID userId) {
        assertAdminIsNotManagingOwnAccount(actorId, userId);
        User user = findUser(userId);
        if (user.getDeletedAt() != null) {
            throw new EventZenException(
                    HttpStatus.BAD_REQUEST,
                    "BUSINESS_ERROR",
                    "AUTH-1012",
                    "GDPR deleted users cannot be reactivated"
            );
        }
        user.reactivate();
        userRepository.save(user);
    }

    @Transactional
    public void gdprDelete(UUID actorId, UUID userId) {
        assertAdminIsNotManagingOwnAccount(actorId, userId);
        User user = findUser(userId);
        userRoleRepository.deleteAllByUser_Id(userId);
        refreshTokenRepository.findAllByUser_Id(userId).forEach(token -> {
            token.revoke();
            refreshTokenRepository.save(token);
        });
        user.gdprDelete("deleted-" + userId + "@gdpr.eventzen.local");
        userRepository.save(user);
    }

    private User findUser(UUID userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new EventZenException(HttpStatus.NOT_FOUND, "BUSINESS_ERROR", "AUTH-1006", "User not found"));
    }

    private void assertAdminIsNotManagingOwnAccount(UUID actorId, UUID userId) {
        if (actorId != null && actorId.equals(userId)) {
            throw new EventZenException(
                    HttpStatus.BAD_REQUEST,
                    "BUSINESS_ERROR",
                    "AUTH-1013",
                    "Admins cannot change their own account status or roles"
            );
        }
    }
}
