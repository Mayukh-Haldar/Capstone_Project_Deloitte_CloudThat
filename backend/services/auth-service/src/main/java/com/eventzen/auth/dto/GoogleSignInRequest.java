package com.eventzen.auth.dto;

import com.eventzen.auth.security.RoleName;
import jakarta.validation.constraints.NotBlank;

public record GoogleSignInRequest(
        @NotBlank String idToken,
        RoleName requestedRole,
        String otpCode
) {
}
