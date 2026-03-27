package com.eventzen.finance.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.FieldError;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(FinanceServiceException.class)
    ResponseEntity<ApiErrorResponse> handleDomain(FinanceServiceException exception, HttpServletRequest request) {
        return build(exception.getStatus(), exception.getCode(), exception.getMessage(), request, List.of());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ApiErrorResponse> handleValidation(MethodArgumentNotValidException exception, HttpServletRequest request) {
        List<ApiFieldError> details = exception.getBindingResult().getAllErrors().stream()
                .map(error -> error instanceof FieldError fieldError
                        ? new ApiFieldError(fieldError.getField(), fieldError.getDefaultMessage())
                        : new ApiFieldError(error.getObjectName(), error.getDefaultMessage()))
                .toList();
        return build(HttpStatus.BAD_REQUEST, "FIN-400", "Validation failed", request, details);
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiErrorResponse> handleUnreadable(HttpMessageNotReadableException exception, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "FIN-400", "Malformed request body", request, List.of());
    }

    @ExceptionHandler(AccessDeniedException.class)
    ResponseEntity<ApiErrorResponse> handleAccessDenied(HttpServletRequest request) {
        return build(HttpStatus.FORBIDDEN, "AUTH-403", "Insufficient permissions for resource", request, List.of());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiErrorResponse> handleUnexpected(Exception exception, HttpServletRequest request) {
        log.error("Unexpected finance-service error for {} {}", request.getMethod(), request.getRequestURI(), exception);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "FIN-500", "Unexpected server error", request, List.of());
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
