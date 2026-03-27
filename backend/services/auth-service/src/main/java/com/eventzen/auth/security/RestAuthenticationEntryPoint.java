package com.eventzen.auth.security;

import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Instant;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response, AuthenticationException authException) throws IOException, ServletException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType("application/json");
        response.getWriter().write("""
                {"timestamp":"%s","status":401,"error":"AUTHENTICATION_ERROR","code":"AUTH-1001","message":"Invalid or expired JWT","path":"%s","traceId":"%s","details":[]}
                """.formatted(
                Instant.now(),
                request.getRequestURI(),
                request.getHeader("X-Trace-Id") == null ? UUID.randomUUID() : request.getHeader("X-Trace-Id")
        ).trim());
    }
}
