[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🔐 Novelty Feature: MFA with TOTP

**Service:** Auth Service (`backend/services/auth-service`)  
**Category:** Novelty - Security

---

## Overview

EventZen implements **Time-Based One-Time Password (TOTP)** multi-factor authentication, allowing users to secure their accounts with a second factor tied to an authenticator app (Google Authenticator, Authy, etc.). The entire MFA lifecycle - enrollment, verification, and disabling - is self-service from the account settings page.

---

## How It Works

### Enrollment Flow

1. User navigates to **Account Settings → Security → Enable MFA**
2. Auth Service generates a TOTP secret using a TOTP library and encrypts it with AES before storing it against the user record
3. A QR code is returned to the frontend, encoding an `otpauth://` URI the user scans with their authenticator app
4. User submits the 6-digit code their app generates - Auth Service verifies it against the server-side secret to confirm successful enrollment
5. `is_mfa_enabled` flag is set to `true` on the user record

### Login Flow (Post-Enrollment)

1. User submits email + password - Auth Service validates credentials
2. If `is_mfa_enabled = true`, a **partial token** (short-lived, MFA-pending) is returned instead of a full JWT
3. Frontend redirects to the MFA challenge screen
4. User enters the 6-digit TOTP code from their authenticator app
5. Auth Service validates the code with a time-window tolerance (±1 period / 30 seconds)
6. On success, full access + refresh tokens are issued

### Disabling MFA

- User must supply a valid current TOTP code to disable MFA, preventing unauthorized removal

---

## Key Files

| File | Role |
|------|------|
| `src/main/java/.../service/TotpService.java` | TOTP secret generation, QR URI construction, code verification |
| `src/main/java/.../service/FieldEncryptionService.java` | AES encryption/decryption of the stored TOTP secret |
| `src/main/java/.../controller/AuthController.java` | MFA enrollment, verification, and disable endpoints |
| `src/test/.../service/TotpServiceTest.java` | Unit tests for TOTP logic |

---

## Why It's Novel

Standard projects implement username/password auth. TOTP-MFA adds a genuine second factor that:
- Is device-bound (secret lives in the authenticator app)
- Is time-sensitive (30-second window, replay-resistant)
- Requires zero external SMS/email cost
- Is stored encrypted at rest - the raw secret never persists in plaintext
