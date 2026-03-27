package com.eventzen.auth.dto;

import com.eventzen.auth.entity.AccountRequestType;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateAccountRequestRequest(
        @NotNull AccountRequestType type,
        @Size(max = 1000) String reason
) {
}
