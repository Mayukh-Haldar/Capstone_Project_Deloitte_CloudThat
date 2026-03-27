package com.eventzen.auth.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response, AccessDeniedException accessDeniedException) throws IOException, ServletException {
        response.setStatus(HttpStatus.FORBIDDEN.value());
        response.setContentType("application/json");
        response.getWriter().write("""
                {"timestamp":"%s","status":403,"error":"AUTHORIZATION_ERROR","code":"AUTH-1002","message":"Insufficient permissions for resource","path":"%s","traceId":"%s","details":[]}
                """.formatted(
                Instant.now(),
                request.getRequestURI(),
                request.getHeader("X-Trace-Id") == null ? UUID.randomUUID() : request.getHeader("X-Trace-Id")
        ).trim());
    }
}
