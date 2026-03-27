package com.eventzen.auth.security;

import com.eventzen.auth.config.JwtProperties;
import com.eventzen.auth.entity.User;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.lang.reflect.Field;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class JwtServiceTest {

    private final JwtService jwtService = new JwtService(
            new JwtProperties(
                    "unit-test-jwt-secret-unit-test-jwt-secret-123456",
                    "eventzen-test",
                    15,
                    7
            )
    );

    @Test
    void generateAccessTokenProducesValidAccessToken() {
        CurrentUserPrincipal principal = principal();

        String token = jwtService.generateAccessToken(principal);

        assertThat(jwtService.isAccessToken(token)).isTrue();
        assertThat(jwtService.isRefreshToken(token)).isFalse();
        assertThat(jwtService.extractSubject(token)).isEqualTo(principal.getUsername());
        assertThat(jwtService.isTokenValid(token, principal)).isTrue();
    }

    @Test
    void generateRefreshTokenProducesRefreshToken() {
        CurrentUserPrincipal principal = principal();
        UUID familyId = UUID.randomUUID();

        String token = jwtService.generateRefreshToken(principal, familyId);
        String rotatedToken = jwtService.generateRefreshToken(principal, familyId);

        assertThat(jwtService.isRefreshToken(token)).isTrue();
        assertThat(jwtService.isAccessToken(token)).isFalse();
        assertThat(jwtService.extractSubject(token)).isEqualTo(principal.getUsername());
        assertThat(rotatedToken).isNotEqualTo(token);
    }

    @Test
    void invalidTokenFailsSafely() {
        assertThat(jwtService.isAccessToken("not-a-jwt")).isFalse();
        assertThat(jwtService.isRefreshToken("not-a-jwt")).isFalse();
        assertThat(jwtService.extractSubject("not-a-jwt")).isNull();
    }

    private CurrentUserPrincipal principal() {
        User user = User.register("Mayuk", "Tester", "mayuk@example.com", "encoded-password", "+911234567890");
        setId(user, UUID.randomUUID());
        return new CurrentUserPrincipal(user, Set.of(new SimpleGrantedAuthority("ROLE_ATTENDEE")));
    }

    private void setId(User user, UUID id) {
        try {
            Field field = User.class.getDeclaredField("id");
            field.setAccessible(true);
            field.set(user, id);
        } catch (ReflectiveOperationException exception) {
            throw new RuntimeException(exception);
        }
    }
}
