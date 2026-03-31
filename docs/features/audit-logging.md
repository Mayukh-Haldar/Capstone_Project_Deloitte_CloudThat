[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🕵️ Audit Logging

## Overview

EventZen's Auth Service maintains a **tamper-evident security audit trail** of all significant authentication and administration events. Every login, logout, password change, role assignment, and admin action is recorded with the acting user, IP address, affected resource, and a freetext detail string - providing a full forensic history for security reviews and compliance.

---

## What Gets Logged

| Action Category | Example Events |
|---|---|
| Authentication | `LOGIN_SUCCESS`, `LOGIN_FAILURE`, `LOGOUT`, `TOKEN_REFRESH` |
| Password | `PASSWORD_CHANGED`, `PASSWORD_RESET_REQUESTED`, `PASSWORD_RESET_COMPLETED` |
| Account management | `ACCOUNT_CREATED`, `ACCOUNT_DEACTIVATED`, `ACCOUNT_REACTIVATED` |
| Role / permissions | `ROLE_ASSIGNED`, `ROLE_REMOVED` |
| Admin actions | `ACCOUNT_REQUEST_APPROVED`, `ACCOUNT_REQUEST_REJECTED` |
| MFA | `TOTP_ENABLED`, `TOTP_DISABLED`, `TOTP_VERIFIED` |

---

## Data Model

```
audit_log
├── log_id        BIGINT AUTO_INCREMENT PK
├── user_id       UUID FK → users.user_id  (nullable - pre-auth events)
├── action        VARCHAR(100)   e.g. "LOGIN_SUCCESS"
├── resource_type VARCHAR(100)   e.g. "USER", "ACCOUNT_REQUEST"
├── resource_id   VARCHAR(100)   UUID of the affected resource
├── ip_address    VARCHAR(100)   Client IP from request
└── details       VARCHAR(1000)  Freetext context e.g. "Login via Google"
    created_at    TIMESTAMP      Immutable - set by @PrePersist
```

`created_at` has `updatable = false` at the JPA level - once written, the record cannot be silently modified by application code.

---

## Key Source Files

| File | Purpose |
|---|---|
| `AuditLog.java` | JPA entity (`audit_log` table) - immutable `createdAt` via `@PrePersist` |
| `AuditService.java` | Spring service - single `log()` method called throughout the auth service |
| `AuditLogRepository.java` | Spring Data JPA repository |

---

## Usage Pattern

```java
// Called throughout AuthService, UserManagementService, etc.
auditService.log(
    user,                   // acting user (nullable for pre-auth events)
    "LOGIN_SUCCESS",        // action string
    "USER",                 // resource type
    user.getId().toString(),// resource id
    ipAddress,              // from HttpServletRequest
    "Login via Google"      // freetext detail
);
```

---

## API Access

Audit logs are queryable by administrators:

```
GET /api/v1/admin/audit-logs?userId={id}&action={action}&page=0&size=20
```

Returns paginated `AuditLogResponse` entries sorted by `createdAt DESC`.

---

## Security Properties

- **Append-only by design** - `created_at` is `updatable = false`; no `UPDATE` or `DELETE` operations exist in `AuditLogRepository`
- **IP capture** - the client IP is extracted from `X-Forwarded-For` (Nginx sets this) with a safe fallback to `remoteAddr`
- **Nullable user** - failed login attempts before user resolution are still logged (`user_id` is nullable FK)
- **1000-char detail limit** - prevents log injection via excessively long strings; details are stored as-is (not executed)
