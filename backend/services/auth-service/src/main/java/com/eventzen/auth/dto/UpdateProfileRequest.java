package com.eventzen.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record UpdateProfileRequest(
        @Size(max = 100) String firstName,
        @Size(max = 100) String lastName,
        @Email String email,
        @Pattern(regexp = "^[0-9+\\-() ]{7,20}$", message = "Phone number format is invalid") String phone
) {
}
