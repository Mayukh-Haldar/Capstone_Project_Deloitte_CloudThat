package com.eventzen.finance.exception;

import java.time.OffsetDateTime;
import java.util.List;

public record ApiErrorResponse(
        OffsetDateTime timestamp,
        int status,
        String error,
        String code,
        String message,
        String path,
        String traceId,
        List<ApiFieldError> details
) {
}
