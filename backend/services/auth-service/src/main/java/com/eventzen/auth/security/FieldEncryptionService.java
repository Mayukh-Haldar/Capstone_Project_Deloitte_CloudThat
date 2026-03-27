package com.eventzen.auth.security;

import com.eventzen.auth.config.CryptoProperties;
import com.eventzen.auth.exception.EventZenException;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.util.Base64;
import javax.crypto.Cipher;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class FieldEncryptionService {

    private static final String PREFIX = "enc:";
    private static final int IV_LENGTH = 12;
    private static final int TAG_LENGTH_BITS = 128;

    private final SecretKey secretKey;
    private final SecureRandom secureRandom = new SecureRandom();

    public FieldEncryptionService(CryptoProperties cryptoProperties) {
        this.secretKey = new SecretKeySpec(deriveKey(cryptoProperties.secret()), "AES");
    }

    public String encrypt(String plaintext) {
        if (plaintext == null || plaintext.isBlank()) {
            return plaintext;
        }
        try {
            byte[] iv = new byte[IV_LENGTH];
            secureRandom.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, secretKey, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            byte[] encrypted = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            ByteBuffer buffer = ByteBuffer.allocate(iv.length + encrypted.length);
            buffer.put(iv);
            buffer.put(encrypted);
            return PREFIX + Base64.getEncoder().encodeToString(buffer.array());
        } catch (GeneralSecurityException exception) {
            throw new EventZenException(HttpStatus.INTERNAL_SERVER_ERROR, "SYSTEM_ERROR", "SYS-9001", "Unable to encrypt sensitive field");
        }
    }

    public String decryptIfNeeded(String ciphertext) {
        if (ciphertext == null || ciphertext.isBlank() || !ciphertext.startsWith(PREFIX)) {
            return ciphertext;
        }
        try {
            byte[] raw = Base64.getDecoder().decode(ciphertext.substring(PREFIX.length()));
            ByteBuffer buffer = ByteBuffer.wrap(raw);
            byte[] iv = new byte[IV_LENGTH];
            buffer.get(iv);
            byte[] encrypted = new byte[buffer.remaining()];
            buffer.get(encrypted);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, secretKey, new GCMParameterSpec(TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException exception) {
            throw new EventZenException(HttpStatus.INTERNAL_SERVER_ERROR, "SYSTEM_ERROR", "SYS-9001", "Unable to decrypt sensitive field");
        }
    }

    private static byte[] deriveKey(String secret) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
        } catch (GeneralSecurityException exception) {
            throw new EventZenException(HttpStatus.INTERNAL_SERVER_ERROR, "SYSTEM_ERROR", "SYS-9001", "Unable to initialize encryption");
        }
    }
}
