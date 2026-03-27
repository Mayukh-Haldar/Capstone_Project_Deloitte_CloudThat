package com.eventzen.auth.service;

public record GoogleIdentity(
        String subject,
        String email,
        boolean emailVerified,
        String givenName,
        String familyName
) {
}
