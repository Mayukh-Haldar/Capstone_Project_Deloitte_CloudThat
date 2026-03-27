package com.eventzen.auth.security;

import com.eventzen.auth.service.EventZenUserDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.InetAddress;
import java.util.Arrays;
import java.util.Collection;
import java.util.UUID;
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
    private final EventZenUserDetailsService userDetailsService;

    public JwtAuthenticationFilter(JwtService jwtService, EventZenUserDetailsService userDetailsService) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            applyLocalHeaderFallback(request);
            filterChain.doFilter(request, response);
            return;
        }

        try {
            String token = authorization.substring(7);
            if (!jwtService.isAccessToken(token)) {
                applyLocalHeaderFallback(request);
                filterChain.doFilter(request, response);
                return;
            }

            String username = jwtService.extractSubject(token);
            if (username != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                try {
                    CurrentUserPrincipal principal = userDetailsService.loadCurrentUserByUsername(username);
                    if (jwtService.isTokenValid(token, principal)) {
                        UsernamePasswordAuthenticationToken authentication = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
                        authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authentication);
                    }
                } catch (RuntimeException ignored) {
                    SecurityContextHolder.clearContext();
                    applyLocalHeaderFallback(request);
                }
            }
        } catch (RuntimeException ignored) {
            SecurityContextHolder.clearContext();
            applyLocalHeaderFallback(request);
        }

        filterChain.doFilter(request, response);
    }

    private void applyLocalHeaderFallback(HttpServletRequest request) {
        if (!canUseLocalDevFallback(request) || SecurityContextHolder.getContext().getAuthentication() != null) {
            return;
        }

        String rawUserId = request.getHeader("x-user-id");
        if (rawUserId == null || rawUserId.isBlank()) {
            return;
        }

        try {
            UUID userId = UUID.fromString(rawUserId);
            String email = request.getHeader("x-user-email");
            String resolvedEmail = email == null || email.isBlank() ? userId + "@eventzen.local" : email;
            String rawRoles = request.getHeader("x-user-roles");
            Collection<? extends GrantedAuthority> authorities = rawRoles == null || rawRoles.isBlank()
                    ? java.util.List.of()
                    : Arrays.stream(rawRoles.split(","))
                            .map(String::trim)
                            .filter(value -> !value.isBlank())
                            .map(value -> value.startsWith("ROLE_") ? value : "ROLE_" + value)
                            .map(SimpleGrantedAuthority::new)
                            .toList();
            CurrentUserPrincipal principal = CurrentUserPrincipal.localDev(userId, resolvedEmail, authorities);
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
