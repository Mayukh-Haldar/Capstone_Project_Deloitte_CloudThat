package com.eventzen.auth.service;

import com.eventzen.auth.dto.CurrentUserResponse;
import com.eventzen.auth.dto.UserResponse;
import com.eventzen.auth.entity.RolePermission;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.entity.UserRole;
import com.eventzen.auth.repository.RolePermissionRepository;
import com.eventzen.auth.repository.UserRoleRepository;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.stereotype.Component;

@Component
public class UserMapper {

    private final UserRoleRepository userRoleRepository;
    private final RolePermissionRepository rolePermissionRepository;

    public UserMapper(UserRoleRepository userRoleRepository, RolePermissionRepository rolePermissionRepository) {
        this.userRoleRepository = userRoleRepository;
        this.rolePermissionRepository = rolePermissionRepository;
    }

    public CurrentUserResponse toCurrentUserResponse(User user) {
        Set<String> roles = userRoleRepository.findAllByUser_Id(user.getId()).stream()
                .map(UserRole::getRole)
                .map(role -> role.getName().name())
                .collect(Collectors.toSet());

        Set<String> permissions = userRoleRepository.findAllByUser_Id(user.getId()).stream()
                .flatMap(userRole -> rolePermissionRepository.findAllByRole_Id(userRole.getRole().getId()).stream())
                .map(RolePermission::getPermission)
                .map(permission -> permission.getName())
                .collect(Collectors.toSet());

        return new CurrentUserResponse(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getPhone(),
                user.isActive(),
                user.isEmailVerified(),
                user.isMfaEnabled(),
                roles,
                permissions,
                user.getCreatedAt()
        );
    }

    public UserResponse toUserResponse(User user) {
        Set<String> roles = userRoleRepository.findAllByUser_Id(user.getId()).stream()
                .map(UserRole::getRole)
                .map(role -> role.getName().name())
                .collect(Collectors.toSet());

        return new UserResponse(
                user.getId(),
                user.getFirstName(),
                user.getLastName(),
                user.getEmail(),
                user.getPhone(),
                user.isActive(),
                user.isEmailVerified(),
                user.isMfaEnabled(),
                roles,
                user.getCreatedAt(),
                user.getDeletedAt()
        );
    }
}
