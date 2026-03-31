[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🔑 JWT & Refresh Token Rotation

**Role:** Stateless Authentication with Secure Token Lifecycle  
**Service:** Auth Service (`backend/services/auth-service`)  
**Category:** Advanced Infrastructure

---

## Overview

EventZen implements a **stateless JWT authentication** system with **HTTP-only cookie refresh token rotation**. Access tokens are short-lived and signed; refresh tokens are long-lived, stored as HTTP-only cookies, and rotated on each use - preventing token replay attacks and session fixation.

---

## Token Architecture

| Token | Lifetime | Storage | Purpose |
|-------|---------|---------|---------|
| **Access Token** (JWT) | 15 minutes | JavaScript memory (not localStorage) | Authenticate every API request |
| **Refresh Token** | 7 days | HTTP-only, Secure, SameSite=Strict cookie | Silently obtain a new access token |

---

## Flow

```
Login
  │  POST /auth/login { email, password }
  ▼
Auth Service validates → issues:
  ├── Access Token (JWT, 15m) → response body
  └── Refresh Token → Set-Cookie: HTTP-only
  │
  ▼
Frontend stores access token in memory only

Access token expires (15m)
  │  POST /auth/refresh  (cookie sent automatically)
  ▼
Auth Service validates refresh token → issues:
  ├── New Access Token → response body
  └── New Refresh Token → Set-Cookie (old token invalidated)
```

---

## Security Properties

| Property | Implementation |
|----------|----------------|
| **HTTP-only cookies** | Refresh token inaccessible to JavaScript - XSS-resistant |
| **Rotation on use** | Each refresh invalidates the previous token - replay window = zero |
| **Short-lived access tokens** | 15-minute window limits blast radius of a stolen access token |
| **No localStorage** | Access tokens never written to persistent browser storage |
| **Token family tracking** | Refresh token family stored server-side; reuse of a rotated token invalidates the entire family |

---

## JWT Payload

```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "roles": ["ROLE_VENDOR"],
  "iat": 1700000000,
  "exp": 1700000900
}
```

---

## Key Files

| File | Role |
|------|------|
| `auth-service/.../service/JwtService.java` | Token generation, validation, claims extraction |
| `auth-service/.../service/AuthenticationService.java` | Login, refresh, logout orchestration |
| `auth-service/.../filter/JwtAuthenticationFilter.java` | Per-request token validation filter |
| `auth-service/.../service/JwtServiceTest.java` | Unit tests for JWT logic |
