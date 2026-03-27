package com.eventzen.auth.dto;

public record AuthResponse(
        String accessToken,
        String refreshToken,
        long expiresInSeconds,
        CurrentUserResponse user
) {
}
