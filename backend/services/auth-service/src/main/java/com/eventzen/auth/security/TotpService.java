package com.eventzen.auth.security;

import com.eventzen.auth.exception.EventZenException;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.time.Instant;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

@Service
public class TotpService {

    private static final String BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
    private static final SecureRandom RANDOM = new SecureRandom();

    public String generateSecret() {
        byte[] bytes = new byte[20];
        RANDOM.nextBytes(bytes);
        return encodeBase32(bytes);
    }

    public boolean verifyCode(String secret, String code) {
        long currentWindow = Instant.now().getEpochSecond() / 30;
        for (long offset = -1; offset <= 1; offset++) {
            if (generateCode(secret, currentWindow + offset).equals(code)) {
                return true;
            }
        }
        return false;
    }

    public String buildOtpAuthUri(String email, String secret) {
        return "otpauth://totp/EventZen:" + email + "?secret=" + secret + "&issuer=EventZen&algorithm=SHA1&digits=6&period=30";
    }

    private String generateCode(String secret, long counter) {
        try {
            byte[] decoded = decodeBase32(secret);
            byte[] data = ByteBuffer.allocate(8).putLong(counter).array();
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(decoded, "HmacSHA1"));
            byte[] hash = mac.doFinal(data);
            int offset = hash[hash.length - 1] & 0x0F;
            int binary = ((hash[offset] & 0x7F) << 24)
                    | ((hash[offset + 1] & 0xFF) << 16)
                    | ((hash[offset + 2] & 0xFF) << 8)
                    | (hash[offset + 3] & 0xFF);
            int otp = binary % 1_000_000;
            return String.format("%06d", otp);
        } catch (GeneralSecurityException ex) {
            throw new EventZenException(HttpStatus.INTERNAL_SERVER_ERROR, "SYSTEM_ERROR", "SYS-9001", "Unable to generate MFA code");
        }
    }

    private static String encodeBase32(byte[] bytes) {
        StringBuilder builder = new StringBuilder();
        int value = 0;
        int bits = 0;
        for (byte current : bytes) {
            value = (value << 8) | (current & 0xFF);
            bits += 8;
            while (bits >= 5) {
                builder.append(BASE32_ALPHABET.charAt((value >> (bits - 5)) & 31));
                bits -= 5;
            }
        }
        if (bits > 0) {
            builder.append(BASE32_ALPHABET.charAt((value << (5 - bits)) & 31));
        }
        return builder.toString();
    }

    private static byte[] decodeBase32(String value) {
        int buffer = 0;
        int bitsLeft = 0;
        byte[] output = new byte[value.length() * 5 / 8];
        int index = 0;
        for (char c : value.replace("=", "").toUpperCase().toCharArray()) {
            int current = BASE32_ALPHABET.indexOf(c);
            if (current < 0) {
                continue;
            }
            buffer = (buffer << 5) | current;
            bitsLeft += 5;
            if (bitsLeft >= 8) {
                output[index++] = (byte) ((buffer >> (bitsLeft - 8)) & 0xFF);
                bitsLeft -= 8;
            }
        }
        byte[] trimmed = new byte[index];
        System.arraycopy(output, 0, trimmed, 0, index);
        return trimmed;
    }
}
