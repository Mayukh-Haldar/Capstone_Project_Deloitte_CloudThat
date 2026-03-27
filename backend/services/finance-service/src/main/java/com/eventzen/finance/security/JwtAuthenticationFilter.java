package com.eventzen.finance.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.InetAddress;
import java.util.Collection;
import java.util.Collections;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;

    public JwtAuthenticationFilter(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            applyLocalHeaderFallback(request);
            filterChain.doFilter(request, response);
            return;
        }

        try {
            Claims claims = jwtService.parseAccessToken(authorization.substring(7));
            Collection<? extends GrantedAuthority> authorities = extractAuthorities(claims);
            Set<String> roles = authorities.stream()
                    .map(GrantedAuthority::getAuthority)
                    .map(value -> value.startsWith("ROLE_") ? value.substring(5) : value)
                    .collect(Collectors.toSet());
            AuthenticatedUser principal = new AuthenticatedUser(
                    UUID.fromString(claims.get("uid", String.class)),
                    claims.getSubject(),
                    roles,
                    authorities
            );

            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(principal, null, authorities);
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (RuntimeException ignored) {
            SecurityContextHolder.clearContext();
            applyLocalHeaderFallback(request);
        }

        filterChain.doFilter(request, response);
    }

    private Collection<? extends GrantedAuthority> extractAuthorities(Claims claims) {
        Object raw = claims.get("authorities");
        if (!(raw instanceof Collection<?> values)) {
            return Collections.emptyList();
        }
        return values.stream()
                .map(String::valueOf)
                .map(value -> value.startsWith("ROLE_") ? value : "ROLE_" + value)
                .map(SimpleGrantedAuthority::new)
                .toList();
    }

    private void applyLocalHeaderFallback(HttpServletRequest request) {
        if (!canUseLocalDevFallback(request)) {
            return;
        }

        String rawUserId = request.getHeader("x-user-id");
        if (rawUserId == null || rawUserId.isBlank()) {
            return;
        }

        try {
            UUID userId = UUID.fromString(rawUserId);
            String email = request.getHeader("x-user-email");
            String rawRoles = request.getHeader("x-user-roles");
            Set<String> roles = rawRoles == null || rawRoles.isBlank()
                    ? Set.of()
                    : java.util.Arrays.stream(rawRoles.split(","))
                            .map(String::trim)
                            .filter(value -> !value.isBlank())
                            .collect(Collectors.toSet());
            Collection<? extends GrantedAuthority> authorities = roles.stream()
                    .map(value -> value.startsWith("ROLE_") ? value : "ROLE_" + value)
                    .map(SimpleGrantedAuthority::new)
                    .toList();

            AuthenticatedUser principal = new AuthenticatedUser(userId, email == null ? "" : email, roles, authorities);
            UsernamePasswordAuthenticationToken authentication =
                    new UsernamePasswordAuthenticationToken(principal, null, authorities);
            authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
            SecurityContextHolder.getContext().setAuthentication(authentication);
        } catch (IllegalArgumentException ignored) {
            SecurityContextHolder.clearContext();
        }
    }

    private boolean canUseLocalDevFallback(HttpServletRequest request) {
        String serverName = request.getServerName();
        if ("localhost".equalsIgnoreCase(serverName) || "127.0.0.1".equals(serverName) || "::1".equals(serverName)) {
            return true;
        }

        String remoteAddr = request.getRemoteAddr();
        try {
            return remoteAddr != null && InetAddress.getByName(remoteAddr).isLoopbackAddress();
        } catch (Exception ignored) {
            return false;
        }
    }
}
