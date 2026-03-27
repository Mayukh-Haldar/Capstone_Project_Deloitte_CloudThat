package com.eventzen.auth.exception;

import org.springframework.http.HttpStatus;

public class EventZenException extends RuntimeException {

    private final HttpStatus status;
    private final String error;
    private final String code;

    public EventZenException(HttpStatus status, String error, String code, String message) {
        super(message);
        this.status = status;
        this.error = error;
        this.code = code;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getError() {
        return error;
    }

    public String getCode() {
        return code;
    }
}
