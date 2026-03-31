[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🔓 Password Reset Flow

## Overview

EventZen provides a **secure, tokenised email-based password reset** flow. Users who forget their password request a reset link; the Auth Service generates a short-lived, single-use token; the user clicks the link in the email and submits a new password. The entire flow is handled within the Auth Service with no third-party identity provider dependency.

---

## Flow Diagram

```
User (Frontend)                Auth Service                  SMTP Server
     │                              │                              │
     │── POST /auth/forgot-password ▶│                             │
     │   { email: "user@example.com" }                             │
     │                              │ Generate secure random token │
     │                              │ Store hash(token) in DB      │
     │                              │ Set expiry (15 minutes)      │
     │                              │── sendPasswordResetEmail() ──▶│
     │                              │                              │ Email sent:
     │                              │                              │ "Reset your password"
     │◀── 200 OK (always, no enum) ─│                              │ Link: /auth?mode=signin
     │    (prevents email enumeration)                             │       &resetToken=<token>
     │                              │                              │
     │── POST /auth/reset-password ─▶│                             │
     │   { token: "...", newPassword: "..." }                      │
     │                              │ Verify token (hash match,    │
     │                              │ not expired, not used)       │
     │                              │ Hash newPassword (bcrypt)    │
     │                              │ Update user password         │
     │                              │ Invalidate token             │
     │                              │ Log AUDIT: PASSWORD_RESET    │
     │◀── 200 OK ───────────────────│                              │
```

---

## Security Design

| Property | Implementation |
|---|---|
| **Email enumeration prevention** | `POST /auth/forgot-password` always returns `200 OK` regardless of whether the email exists |
| **Token security** | Cryptographically random token; only the SHA-256 hash is stored (token itself is never persisted) |
| **Token expiry** | 15-minute TTL; expired tokens are rejected with `AUTH-1010` |
| **Single-use** | Token is invalidated immediately after successful reset; replay attempts fail |
| **Password hashing** | New password is hashed with bcrypt before storage |
| **Audit trail** | Successful reset emits `PASSWORD_RESET_COMPLETED` to `AuditService` |

---

## Email Template

The reset email is sent via `SmtpAuthNotificationService` and contains:

- Greeting with first name
- Plain-text token (copyable)
- Clickable reset link: `{APP_URL}/auth?mode=signin&resetToken={token}`
- Both plain-text and HTML versions with proper escaping

The link opens the EventZen signin page in reset mode - the token auto-populates in the reset password form.

---

## Key Source Files

| File | Purpose |
|---|---|
| `AuthController.java` | Exposes `/auth/forgot-password` and `/auth/reset-password` endpoints |
| `AuthenticationService.java` | `requestPasswordReset()` - generates and stores token; `resetPassword()` - validates and commits new password |
| `SmtpAuthNotificationService.java` | Builds and sends HTML + plain-text reset email via JavaMailSender |
| `LoggingAuthNotificationService.java` | Dev fallback - logs the reset token to console when SMTP not configured |
| `ForgotPasswordRequest.java` | DTO - `{ email }` |
| `ResetPasswordRequest.java` | DTO - `{ token, newPassword }` |

---

## Configuration

```yaml
# application.yml
spring:
  mail:
    host: ${SMTP_HOST}
    port: ${SMTP_PORT}
    username: ${SMTP_USER}
    password: ${SMTP_PASSWORD}

auth:
  mail:
    from: noreply@eventzen.app
    app-base-url: ${APP_BASE_URL}
```

If `spring.mail.host` is blank, `SmtpAuthNotificationService` is not instantiated - `LoggingAuthNotificationService` is used instead (dev only).

---

## API Endpoints

```
POST /api/v1/auth/forgot-password
{
  "email": "user@example.com"
}

POST /api/v1/auth/reset-password
{
  "token": "<reset token>",
  "newPassword": "NewSecureP@ss1"
}
```

Both endpoints are public (no auth required). Password validation enforces strength rules (min length, character requirements) via `@Valid` constraints on `ResetPasswordRequest`.
