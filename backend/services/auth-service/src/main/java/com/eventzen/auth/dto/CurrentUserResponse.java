package com.eventzen.auth.dto;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

public record CurrentUserResponse(
        UUID id,
        String firstName,
        String lastName,
        String email,
        String phone,
        boolean active,
        boolean emailVerified,
        boolean mfaEnabled,
        Set<String> roles,
        Set<String> permissions,
        Instant createdAt
) {
}
