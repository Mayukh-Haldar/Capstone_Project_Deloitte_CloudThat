package com.eventzen.auth.security;

import com.eventzen.auth.config.CryptoProperties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FieldEncryptionServiceTest {

    private final FieldEncryptionService fieldEncryptionService =
            new FieldEncryptionService(new CryptoProperties("unit-test-field-encryption-secret-32-chars"));

    @Test
    void encryptAndDecryptRoundTripSucceeds() {
        String plaintext = "BASE32MFASECRET";

        String encrypted = fieldEncryptionService.encrypt(plaintext);

        assertThat(encrypted).startsWith("enc:");
        assertThat(encrypted).isNotEqualTo(plaintext);
        assertThat(fieldEncryptionService.decryptIfNeeded(encrypted)).isEqualTo(plaintext);
    }

    @Test
    void decryptIfNeededReturnsPlaintextForLegacyValues() {
        assertThat(fieldEncryptionService.decryptIfNeeded("LEGACYPLAINTEXTSECRET"))
                .isEqualTo("LEGACYPLAINTEXTSECRET");
    }
}
