package com.eventzen.finance.security;

import java.util.Collection;
import java.util.Set;
import java.util.UUID;
import org.springframework.security.core.GrantedAuthority;

public record AuthenticatedUser(
        UUID id,
        String email,
        Set<String> roles,
        Collection<? extends GrantedAuthority> authorities
) {
    public boolean hasRole(String role) {
        return roles.contains(role);
    }
}
