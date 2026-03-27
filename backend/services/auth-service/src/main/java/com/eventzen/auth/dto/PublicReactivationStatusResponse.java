package com.eventzen.auth.dto;

public record PublicReactivationStatusResponse(boolean accountInactive, boolean hasPendingRequest) {
}
