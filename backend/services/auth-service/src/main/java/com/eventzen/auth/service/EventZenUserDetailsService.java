package com.eventzen.auth.service;

import com.eventzen.auth.entity.Permission;
import com.eventzen.auth.entity.Role;
import com.eventzen.auth.entity.RolePermission;
import com.eventzen.auth.entity.User;
import com.eventzen.auth.entity.UserRole;
import com.eventzen.auth.repository.RolePermissionRepository;
import com.eventzen.auth.repository.UserRepository;
import com.eventzen.auth.repository.UserRoleRepository;
import com.eventzen.auth.security.CurrentUserPrincipal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

@Service
public class EventZenUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;
    private final UserRoleRepository userRoleRepository;
    private final RolePermissionRepository rolePermissionRepository;

    public EventZenUserDetailsService(
            UserRepository userRepository,
            UserRoleRepository userRoleRepository,
            RolePermissionRepository rolePermissionRepository
    ) {
        this.userRepository = userRepository;
        this.userRoleRepository = userRoleRepository;
        this.rolePermissionRepository = rolePermissionRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        return loadCurrentUserByUsername(username);
    }

    public CurrentUserPrincipal loadCurrentUserByUsername(String username) {
        User user = userRepository.findByEmailIgnoreCase(username)
                .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        return toPrincipal(user);
    }

    public CurrentUserPrincipal toPrincipal(User user) {
        List<UserRole> userRoles = userRoleRepository.findAllByUser_Id(user.getId());
        Set<GrantedAuthority> authorities = new HashSet<>();
        for (UserRole userRole : userRoles) {
            Role role = userRole.getRole();
            authorities.add(new SimpleGrantedAuthority("ROLE_" + role.getName().name()));
            for (RolePermission rolePermission : rolePermissionRepository.findAllByRole_Id(role.getId())) {
                Permission permission = rolePermission.getPermission();
                authorities.add(new SimpleGrantedAuthority(permission.getName()));
            }
        }
        return new CurrentUserPrincipal(user, authorities);
    }
}
