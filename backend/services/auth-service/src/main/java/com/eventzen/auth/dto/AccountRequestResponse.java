package com.eventzen.auth.dto;

import com.eventzen.auth.entity.AccountRequestStatus;
import com.eventzen.auth.entity.AccountRequestType;
import java.time.Instant;
import java.util.UUID;

public record AccountRequestResponse(
        UUID id,
        AccountRequestType type,
        AccountRequestStatus status,
        String reason,
        String adminComment,
        UUID reviewedBy,
        Instant reviewedAt,
        Instant createdAt,
        AccountRequestUserSummary user
) {
}
