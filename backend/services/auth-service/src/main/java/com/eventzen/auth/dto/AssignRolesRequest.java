package com.eventzen.auth.dto;

import com.eventzen.auth.security.RoleName;
import jakarta.validation.constraints.NotNull;
import java.util.Set;

public record AssignRolesRequest(@NotNull Set<RoleName> roles) {
}
