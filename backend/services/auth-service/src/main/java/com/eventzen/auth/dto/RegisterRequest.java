package com.eventzen.auth.dto;

import com.eventzen.auth.security.RoleName;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RegisterRequest(
        @NotBlank @Size(max = 100) String firstName,
        @NotBlank @Size(max = 100) String lastName,
        @Email @NotBlank String email,
        @NotBlank @Size(min = 8, max = 100) String password,
        @Pattern(regexp = "^[0-9+\\-() ]{7,20}$", message = "Phone number format is invalid") String phone,
        RoleName requestedRole
) {
}
