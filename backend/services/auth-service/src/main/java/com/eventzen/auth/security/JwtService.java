package com.eventzen.auth.security;

import com.eventzen.auth.config.JwtProperties;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.time.Instant;
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import javax.crypto.SecretKey;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.stereotype.Service;

@Service
public class JwtService {

    private final JwtProperties jwtProperties;
    private final SecretKey key;

    public JwtService(JwtProperties jwtProperties) {
        this.jwtProperties = jwtProperties;
        this.key = Keys.hmacShaKeyFor(jwtProperties.secret().getBytes(StandardCharsets.UTF_8));
    }

    public String generateAccessToken(CurrentUserPrincipal principal) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(principal.getUsername())
                .issuer(jwtProperties.issuer())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(jwtProperties.accessTokenMinutes() * 60)))
                .claims(Map.of(
                        "type", "access",
                        "uid", principal.getUser().getId().toString(),
                        "authorities", principal.getAuthorities().stream().map(GrantedAuthority::getAuthority).collect(Collectors.toSet())
                ))
                .signWith(key)
                .compact();
    }

    public String generateRefreshToken(CurrentUserPrincipal principal, UUID familyId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(principal.getUsername())
                .issuer(jwtProperties.issuer())
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusSeconds(jwtProperties.refreshTokenDays() * 86400)))
                .claims(Map.of(
                        "type", "refresh",
                        "uid", principal.getUser().getId().toString(),
                        "familyId", familyId.toString()
                ))
                .signWith(key)
                .compact();
    }

    public String extractSubject(String token) {
        try {
            return parse(token).getPayload().getSubject();
        } catch (RuntimeException exception) {
            return null;
        }
    }

    public boolean isAccessToken(String token) {
        try {
            return "access".equals(parse(token).getPayload().get("type", String.class));
        } catch (RuntimeException exception) {
            return false;
        }
    }

    public boolean isRefreshToken(String token) {
        try {
            return "refresh".equals(parse(token).getPayload().get("type", String.class));
        } catch (RuntimeException exception) {
            return false;
        }
    }

    public boolean isTokenValid(String token, CurrentUserPrincipal principal) {
        try {
            Claims claims = parse(token).getPayload();
            return principal.getUsername().equals(claims.getSubject()) && claims.getExpiration().after(new Date());
        } catch (RuntimeException exception) {
            return false;
        }
    }

    public long accessTokenTtlSeconds() {
        return jwtProperties.accessTokenMinutes() * 60;
    }

    public long refreshTokenTtlSeconds() {
        return jwtProperties.refreshTokenDays() * 86400;
    }

    private io.jsonwebtoken.Jws<Claims> parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token);
    }
}
