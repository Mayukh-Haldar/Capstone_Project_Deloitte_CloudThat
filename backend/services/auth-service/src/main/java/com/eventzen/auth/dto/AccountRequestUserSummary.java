package com.eventzen.auth.dto;

import java.util.UUID;

public record AccountRequestUserSummary(
        UUID id,
        String firstName,
        String lastName,
        String email,
        boolean active
) {
}
