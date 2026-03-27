package com.eventzen.auth.service;

import com.eventzen.auth.dto.CurrentUserResponse;

public record ProfileUpdateResult(
        CurrentUserResponse response,
        String emailVerificationToken
) {
}
