package com.eventzen.auth.security;

import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;

class TotpServiceTest {

    private final TotpService totpService = new TotpService();

    @Test
    void generatedSecretCanValidateCurrentCode() throws Exception {
        String secret = totpService.generateSecret();
        Method generateCode = TotpService.class.getDeclaredMethod("generateCode", String.class, long.class);
        generateCode.setAccessible(true);
        long currentWindow = System.currentTimeMillis() / 1000 / 30;
        String code = (String) generateCode.invoke(totpService, secret, currentWindow);

        assertThat(totpService.verifyCode(secret, code)).isTrue();
    }
}
