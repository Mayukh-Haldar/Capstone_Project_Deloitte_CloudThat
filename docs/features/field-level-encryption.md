[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🔒 Field-Level Encryption

## Overview

EventZen's Auth Service encrypts **sensitive personal data fields at rest** in the MySQL database using **AES-256-GCM**. This means that even if the database is compromised, personal data is unreadable without the encryption key. Each encrypted value is tagged with its own randomly generated IV (Initialization Vector), making brute-force and replay attacks infeasible.

---

## Algorithm Details

| Property | Value |
|---|---|
| Algorithm | AES / GCM / NoPadding |
| Key derivation | SHA-256 hash of the configured secret |
| Key size | 256 bits (32 bytes) |
| IV size | 12 bytes (96 bits) - GCM standard |
| Auth tag length | 128 bits |
| Encoding | `enc:` prefix + Base64 |

---

## Encryption Flow

```
Plaintext: "john.doe@example.com"
      │
      ▼
Generate 12-byte random IV (SecureRandom)
      │
      ▼
AES-GCM encrypt with derived SecretKey  →  [IV (12 bytes)] + [Ciphertext + Auth Tag]
      │
      ▼
Base64-encode the combined bytes
      │
      ▼
Stored in DB: "enc:aGVsbG8gd29ybGQ..."
```

Decryption checks for the `enc:` prefix before attempting decryption, which means **unencrypted legacy values are returned as-is** (backward compatibility).

---

## Key Source Files

| File | Purpose |
|---|---|
| `FieldEncryptionService.java` | Core service - `encrypt(String)`, `decryptIfNeeded(String)` |
| `CryptoProperties.java` | Spring `@ConfigurationProperties` binding `auth.crypto.secret` |
| `FieldEncryptionServiceTest.java` | Unit tests - roundtrip, null/blank passthrough, tamper detection |

---

## Implementation

```java
// Encrypt a field before persisting
String encrypted = fieldEncryptionService.encrypt(user.getPhoneNumber());

// Decrypt transparently when reading
String plain = fieldEncryptionService.decryptIfNeeded(encrypted);
// Returns plaintext for "enc:..." values, returns input unchanged otherwise
```

---

## Configuration

```yaml
# application.yml
auth:
  crypto:
    secret: ${FIELD_ENCRYPTION_SECRET}   # Injected from HashiCorp Vault
```

HashiCorp Vault secret path: `secret/auth-service` → `crypto.secret`

> The secret is hashed with SHA-256 to derive a 256-bit AES key, so the raw secret can be any length.

---

## Which Fields Are Encrypted

Fields marked as sensitive in the User entity are passed through `FieldEncryptionService` before being written to the DB and decrypted on read. Typical examples include:

- Phone numbers
- National ID / document numbers (if collected)
- Any PII added in future without schema changes

Email is **not** encrypted because it is used as the login identifier and must be queried directly.

---

## Security Properties

- **Authenticated encryption** - GCM mode provides both confidentiality and integrity; tampered ciphertext throws an exception
- **Unique IV per value** - even identical plaintexts produce different ciphertexts
- **No key-in-code** - secret is always loaded from Vault at runtime, never committed
- **Tamper detection** - if ciphertext is modified, `GeneralSecurityException` is caught and re-thrown as `SYS-9001`
