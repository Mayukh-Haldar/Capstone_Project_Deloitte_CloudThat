# Auth Service API Documentation

Spring Boot auth service for EventZen.

- Base URL: `http://localhost:8081`
- API prefix: `/api/v1`
- Auth scheme: `Authorization: Bearer <access_token>`
- Default content type: `application/json`

## Quick Start

1. Configure database and auth env vars (`.env` is supported).
2. Run:

```bash
./mvnw spring-boot:run
```

Service runs on port `8081` by default.

### Email delivery setup

Real verification/reset emails are sent only when SMTP is configured. Otherwise the service falls back to logging tokens in the auth-service console.

Add these to `backend/services/auth-service/.env` to enable real mail delivery:

```env
AUTH_SMTP_HOST=smtp.gmail.com
AUTH_SMTP_PORT=587
AUTH_SMTP_USERNAME=replace-with-smtp-username
AUTH_SMTP_PASSWORD=your-app-password
AUTH_SMTP_AUTH=true
AUTH_SMTP_STARTTLS=true
AUTH_MAIL_FROM_EMAIL=no-reply@example.com
AUTH_MAIL_FROM_NAME=EventZen
AUTH_APP_BASE_URL=http://localhost:5173
```

For Gmail, use an App Password rather than your normal Google password.

## Authentication and Authorization

- Public endpoints (no JWT required):
  - `GET /`
  - `GET /actuator/health`
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/google/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/auth/forgot-password`
  - `POST /api/v1/auth/reset-password`
  - `POST /api/v1/auth/email-verification/resend`
  - `POST /api/v1/auth/email-verification/confirm`
- Admin only:
  - All ` /api/v1/users/**`
- All other endpoints require a valid access token.

## Roles

`RoleName` values:

- `ADMIN`
- `ORGANIZER`
- `VENDOR`
- `ATTENDEE`

Notes:
- Self-registration and Google signup do not allow creating admin accounts directly. If `requestedRole` is missing or `ADMIN`, service defaults to `ATTENDEE`.

## Endpoint Reference

### Service

#### `GET /`
- Auth: Public
- Description: Service status ping.
- Response `200`:

```json
{
  "service": "eventzen-auth-service",
  "status": "UP",
  "timestamp": "2026-03-14T17:30:00+05:30"
}
```

#### `GET /actuator/health`
- Auth: Public
- Description: Spring Boot health endpoint.

#### `GET /actuator/info`
- Auth: JWT required
- Description: Spring Boot info endpoint.

### Auth (`/api/v1/auth`)

#### `POST /api/v1/auth/register`
- Auth: Public
- Body:

```json
{
  "firstName": "Mayuk",
  "lastName": "Das",
  "email": "mayuk@example.com",
  "password": "StrongPass123!",
  "phone": "+1 555 000 1234",
  "requestedRole": "ATTENDEE"
}
```

- Response `200`: `AuthResponse`
- Optional response header (only when `auth.features.expose-debug-tokens=true`):
  - `X-Debug-Email-Verification-Token`

#### `POST /api/v1/auth/login`
- Auth: Public
- Body:

```json
{
  "email": "mayuk@example.com",
  "password": "StrongPass123!",
  "otpCode": "123456"
}
```

- `otpCode` is required when user has MFA enabled.
- Response `200`: `AuthResponse`

#### `POST /api/v1/auth/google/login`
- Auth: Public
- Body:

```json
{
  "idToken": "google-id-token",
  "requestedRole": "ATTENDEE",
  "otpCode": "123456"
}
```

- `otpCode` is required when user has MFA enabled.
- Response `200`: `AuthResponse`

#### `POST /api/v1/auth/refresh`
- Auth: Public
- Body:

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

- Response `200`: rotated `AuthResponse`

#### `POST /api/v1/auth/logout`
- Auth: JWT required
- Body:

```json
{
  "refreshToken": "jwt-refresh-token"
}
```

- Response `200`:

```json
{
  "message": "Logout successful"
}
```

#### `GET /api/v1/auth/me`
- Auth: JWT required
- Response `200`: `CurrentUserResponse`

#### `PATCH /api/v1/auth/me/profile`
- Auth: JWT required
- Body (all fields optional; if provided for first/last/email they must not be blank after trim):

```json
{
  "firstName": "Mayuk",
  "lastName": "Das",
  "email": "new-email@example.com",
  "phone": "+1 555 111 2222"
}
```

- Response `200`: updated `CurrentUserResponse`
- If email changes, account is marked unverified and verification email is re-issued.
- Optional response header (only when `auth.features.expose-debug-tokens=true`):
  - `X-Debug-Email-Verification-Token`

#### `POST /api/v1/auth/mfa/setup`
- Auth: JWT required
- Response `200`:

```json
{
  "secret": "base32secret",
  "otpauthUri": "otpauth://totp/EventZen:user@example.com?secret=..."
}
```

#### `POST /api/v1/auth/mfa/verify`
- Auth: JWT required
- Body:

```json
{
  "code": "123456"
}
```

- Response `200`:

```json
{
  "message": "MFA verified"
}
```

#### `POST /api/v1/auth/forgot-password`
- Auth: Public
- Body:

```json
{
  "email": "mayuk@example.com"
}
```

- Response `200`:

```json
{
  "message": "If the email exists, password reset instructions have been sent"
}
```

- Optional response header (only when `auth.features.expose-debug-tokens=true`):
  - `X-Debug-Password-Reset-Token`

#### `POST /api/v1/auth/reset-password`
- Auth: Public
- Body:

```json
{
  "token": "reset-token",
  "newPassword": "NewStrongPass123!"
}
```

- Response `200`:

```json
{
  "message": "Password reset successful"
}
```

#### `POST /api/v1/auth/email-verification/resend`
- Auth: Public
- Body:

```json
{
  "email": "mayuk@example.com"
}
```

- Response `200`:

```json
{
  "message": "If the email exists, verification instructions have been sent"
}
```

- Optional response header (only when `auth.features.expose-debug-tokens=true`):
  - `X-Debug-Email-Verification-Token`

#### `POST /api/v1/auth/email-verification/confirm`
- Auth: Public
- Body:

```json
{
  "token": "email-verification-token"
}
```

- Response `200`:

```json
{
  "message": "Email verified"
}
```

### User Management (`/api/v1/users`) - Admin Only

#### `GET /api/v1/users?page=0&size=20`
- Auth: JWT required (`ROLE_ADMIN`)
- Query params:
  - `page` (default `0`)
  - `size` (default `20`)
- Response `200`: `PagedResponse<UserResponse>`

#### `PUT /api/v1/users/{id}/roles`
- Auth: JWT required (`ROLE_ADMIN`)
- Body:

```json
{
  "roles": ["ORGANIZER", "VENDOR"]
}
```

- Response `200`: updated `UserResponse`

#### `DELETE /api/v1/users/{id}`
- Auth: JWT required (`ROLE_ADMIN`)
- Description: Soft deactivates user and revokes refresh tokens.
- Response `200`:

```json
{
  "message": "User deactivated"
}
```

#### `PATCH /api/v1/users/{id}/reactivate`
- Auth: JWT required (`ROLE_ADMIN`)
- Response `200`:

```json
{
  "message": "User reactivated"
}
```

#### `DELETE /api/v1/users/{id}/gdpr/delete`
- Auth: JWT required (`ROLE_ADMIN`)
- Description: GDPR anonymization flow (roles removed, tokens revoked, account anonymized).
- Response `200`:

```json
{
  "message": "User deleted for GDPR request"
}
```

## Response Models

### `AuthResponse`

```json
{
  "accessToken": "jwt-access-token",
  "refreshToken": "jwt-refresh-token",
  "expiresInSeconds": 900,
  "user": {
    "id": "uuid",
    "firstName": "Mayuk",
    "lastName": "Das",
    "email": "mayuk@example.com",
    "phone": "+1 555 000 1234",
    "active": true,
    "emailVerified": false,
    "mfaEnabled": false,
    "roles": ["ATTENDEE"],
    "permissions": ["auth:read"],
    "createdAt": "2026-03-14T10:00:00Z"
  }
}
```

### `CurrentUserResponse`

```json
{
  "id": "uuid",
  "firstName": "Mayuk",
  "lastName": "Das",
  "email": "mayuk@example.com",
  "phone": "+1 555 000 1234",
  "active": true,
  "emailVerified": true,
  "mfaEnabled": true,
  "roles": ["ATTENDEE"],
  "permissions": ["auth:read"],
  "createdAt": "2026-03-14T10:00:00Z"
}
```

### `UserResponse`

```json
{
  "id": "uuid",
  "firstName": "Mayuk",
  "lastName": "Das",
  "email": "mayuk@example.com",
  "phone": "+1 555 000 1234",
  "active": true,
  "emailVerified": true,
  "mfaEnabled": false,
  "roles": ["ATTENDEE"],
  "createdAt": "2026-03-14T10:00:00Z"
}
```

### `PagedResponse<T>`

```json
{
  "content": [],
  "page": 0,
  "size": 20,
  "totalElements": 1,
  "totalPages": 1
}
```

### Message response

```json
{
  "message": "..."
}
```

## Error Format

All errors are JSON:

```json
{
  "timestamp": "2026-03-14T10:00:00Z",
  "status": 400,
  "error": "VALIDATION_ERROR",
  "code": "AUTH-1003",
  "message": "Request validation failed",
  "path": "/api/v1/auth/register",
  "traceId": "trace-or-generated-uuid",
  "details": [
    { "field": "email", "issue": "must be a well-formed email address" }
  ]
}
```

Common auth/business error codes used by this service include:
- `AUTH-1001` invalid credentials/JWT/refresh issues
- `AUTH-1002` insufficient permission or inactive account
- `AUTH-1003` validation failure
- `AUTH-1004` duplicate user/email conflict
- `AUTH-1005` refresh token not found
- `AUTH-1006` user not found
- `AUTH-1007` invalid MFA verification code
- `AUTH-1008` invalid role assignment
- `AUTH-1010` email not verified for login (feature-flag dependent)
- `AUTH-1011` invalid password reset token
- `AUTH-1012` invalid email verification token
- `AUTH-1013` profile field cannot be blank
- `AUTH-1014` invalid Google token
- `AUTH-1015` Google email not verified
- `AUTH-1018` Google Sign In not configured
- `AUTH-1019` invalid debug Google token format
- `SYS-9001` internal/system error

## Optional Request Headers

- `Authorization: Bearer <access_token>` for protected endpoints.
- `X-Forwarded-For`: optional; used for audit logging.
- `X-Trace-Id`: optional; echoed or generated in error responses.

## Useful Configuration

From `application.properties`:

- `server.port` (default `8081`)
- `auth.jwt.access-token-minutes` (default `15`)
- `auth.jwt.refresh-token-days` (default `7`)
- `auth.features.password-reset-minutes` (default `30`)
- `auth.features.email-verification-hours` (default `24`)
- `auth.features.require-verified-email-for-login` (default `false`)
- `auth.features.expose-debug-tokens` (default `false`)
- `auth.features.google-client-id` (required for real Google token validation)
