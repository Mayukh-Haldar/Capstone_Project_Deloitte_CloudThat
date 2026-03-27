package com.eventzen.auth.service;

import com.eventzen.auth.dto.AuthResponse;

public record RegisterResult(
        AuthResponse response,
        String emailVerificationToken
) {
}
