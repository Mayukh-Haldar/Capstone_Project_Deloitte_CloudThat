package com.eventzen.auth.dto;

import jakarta.validation.constraints.Size;

public record ReviewAccountRequestRequest(@Size(max = 1000) String adminComment) {
}
