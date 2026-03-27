package com.eventzen.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record PublicReactivationRequest(
        @NotBlank @Email String email,
        @Size(max = 1000) String reason
) {
}
