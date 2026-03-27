package com.eventzen.auth.service;

import com.eventzen.auth.dto.AssignRolesRequest;
import com.eventzen.auth.dto.UserResponse;
import com.eventzen.auth.entity.RefreshToken;
import com.eventzen.auth.entity.Role;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.exception.EventZenException;
import com.eventzen.auth.repository.RefreshTokenRepository;
import com.eventzen.auth.repository.RoleRepository;
import com.eventzen.auth.repository.UserRepository;
import com.eventzen.auth.repository.UserRoleRepository;
import com.eventzen.auth.security.RoleName;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserManagementServiceTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private UserRoleRepository userRoleRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private UserMapper userMapper;

    private UserManagementService userManagementService;

    @BeforeEach
    void setUp() {
        userManagementService = new UserManagementService(
                userRepository,
                roleRepository,
                userRoleRepository,
                refreshTokenRepository,
                userMapper
        );
    }

    @Test
    void assignRolesReplacesExistingRoles() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        Role adminRole = Role.create(RoleName.ADMIN, "admin");
        AssignRolesRequest request = new AssignRolesRequest(Set.of(RoleName.ADMIN));

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(roleRepository.findAllByNameIn(Set.of(RoleName.ADMIN))).thenReturn(List.of(adminRole));
        when(userMapper.toUserResponse(user)).thenReturn(
                new UserResponse(user.getId(), "Mayuk", "Tester", "mayuk@example.com", null, true, false, false, Set.of("ADMIN"), Instant.now(), null)
        );

        UserResponse response = userManagementService.assignRoles(user.getId(), request);

        assertThat(response.roles()).containsExactly("ADMIN");
        verify(userRoleRepository).deleteAllByUser_Id(user.getId());
        verify(userRoleRepository).save(any());
    }

    @Test
    void deactivateUserMarksInactiveAndRevokesTokens() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        RefreshToken token = RefreshToken.of(user, "hash", Instant.now().plusSeconds(60), UUID.randomUUID(), "127.0.0.1");

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(refreshTokenRepository.findAllByUser_Id(user.getId())).thenReturn(List.of(token));

        userManagementService.deactivateUser(user.getId());

        assertThat(user.isActive()).isFalse();
        verify(userRepository).save(user);
        verify(refreshTokenRepository).save(token);
    }

    @Test
    void reactivateUserMarksUserActive() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        user.deactivate();
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        userManagementService.reactivateUser(user.getId());

        assertThat(user.isActive()).isTrue();
        verify(userRepository).save(user);
    }

    @Test
    void gdprDeleteAnonymizesUser() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", "+911234567890");
        RefreshToken token = RefreshToken.of(user, "hash", Instant.now().plusSeconds(60), UUID.randomUUID(), "127.0.0.1");
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(refreshTokenRepository.findAllByUser_Id(user.getId())).thenReturn(List.of(token));

        userManagementService.gdprDelete(user.getId());

        assertThat(user.isActive()).isFalse();
        assertThat(user.getEmail()).startsWith("deleted-");
        verify(userRoleRepository).deleteAllByUser_Id(user.getId());
        verify(userRepository).save(user);
    }

    @Test
    void assignRolesRejectsUnknownRoleNames() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded", null);
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(roleRepository.findAllByNameIn(Set.of(RoleName.ADMIN, RoleName.ORGANIZER))).thenReturn(List.of(Role.create(RoleName.ADMIN, "admin")));

        assertThatThrownBy(() -> userManagementService.assignRoles(
                user.getId(),
                new AssignRolesRequest(Set.of(RoleName.ADMIN, RoleName.ORGANIZER))
        )).isInstanceOf(EventZenException.class);
    }
}
