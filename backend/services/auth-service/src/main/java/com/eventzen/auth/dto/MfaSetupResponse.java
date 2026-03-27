package com.eventzen.auth.dto;

public record MfaSetupResponse(String secret, String otpauthUri) {
}
