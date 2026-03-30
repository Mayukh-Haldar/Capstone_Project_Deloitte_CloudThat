package com.eventzen.event.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(EventServiceException.class)
    ResponseEntity<ApiErrorResponse> handleDomain(EventServiceException exception, HttpServletRequest request) {
        return build(exception.getStatus(), exception.getCode(), exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        List<ApiFieldError> details = exception.getBindingResult().getAllErrors().stream()
                .map(error -> error instanceof FieldError fieldError
                        ? new ApiFieldError(fieldError.getField(), fieldError.getDefaultMessage())
                        : new ApiFieldError(error.getObjectName(), error.getDefaultMessage()))
                .toList();
        return build(HttpStatus.BAD_REQUEST, "EVENT-400", "Validation failed", request, details);
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiErrorResponse> handleAccessDenied(HttpServletRequest request) {
        return build(HttpStatus.FORBIDDEN, "AUTH-403", "Insufficient permissions for resource", request, List.of());
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ApiErrorResponse> handleResponseStatus(ResponseStatusException exception, HttpServletRequest request) {
        HttpStatus status = HttpStatus.resolve(exception.getStatusCode().value());
        if (status == null) status = HttpStatus.INTERNAL_SERVER_ERROR;
        return build(status, "EVENT-" + status.value(), exception.getReason() != null ? exception.getReason() : status.getReasonPhrase(), request, List.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiErrorResponse> handleUnexpected(HttpServletRequest request) {
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "EVENT-500", "Unexpected server error", request, List.of());
    }

    private ResponseEntity<ApiErrorResponse> build(
            HttpStatus status,
            String code,
            String message,
            HttpServletRequest request,
            List<ApiFieldError> details
    ) {
        ApiErrorResponse response = new ApiErrorResponse(
                OffsetDateTime.now(),
                status.value(),
                status.getReasonPhrase(),
                code,
                message,
                request.getRequestURI(),
                UUID.randomUUID().toString(),
                details
        );
        return ResponseEntity.status(status).body(response);
    }
}
