[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🔐 Google OAuth Sign-In

## Overview

EventZen supports Google social login as an alternative to password-based authentication. Users can sign in with their existing Google account - no separate EventZen password required. The entire flow is built inside the **Auth Service** (Spring Boot) and integrates seamlessly with the existing JWT + refresh token session model.

---

## Key Source Files

| File | Path |
|------|------|
| `GoogleSignInRequest.java` | `auth-service/.../dto/GoogleSignInRequest.java` |
| `GoogleTokenVerifier.java` | `auth-service/.../service/GoogleTokenVerifier.java` |
| `GoogleTokenInfoVerifier.java` | `auth-service/.../service/GoogleTokenInfoVerifier.java` |
| `GoogleIdentity.java` | `auth-service/.../service/GoogleIdentity.java` |

---

## How It Works

### 1. Frontend sends the Google ID Token

The React frontend uses the Google Identity Services library. When a user clicks "Sign in with Google" and authenticates, Google returns a **JWT ID token** to the browser. The frontend POSTs this token to the Auth Service:

```
POST /api/v1/auth/google/sign-in
{ "idToken": "<google_jwt_id_token>" }
```

### 2. Auth Service verifies the token with Google

`GoogleTokenInfoVerifier` makes an outbound call to Google's token verification endpoint:

```
GET https://oauth2.googleapis.com/tokeninfo?id_token=<token>
```

The response is validated for:
- **Non-null `sub` and `email`** - token is not empty
- **Audience (`aud`) matches** `GOOGLE_CLIENT_ID` configured in the service - prevents tokens issued to other apps from being accepted

```java
if (!authFeatureProperties.googleClientId().equals(response.aud())) {
    throw new EventZenException(HttpStatus.UNAUTHORIZED, "AUTHENTICATION_ERROR",
        "AUTH-1014", "Google token audience is invalid");
}
```

### 3. Identity is mapped to an EventZen account

After successful verification, the service receives a `GoogleIdentity`:

```java
record GoogleIdentity(String sub, String email, boolean emailVerified,
                      String givenName, String familyName) {}
```

- If an existing account is linked to this Google `sub`, the user is logged in.
- If an existing account has the same email (password account), the Google identity is linked to it on first use.
- If no account exists, a new `ATTENDEE` account is auto-provisioned.

### 4. Session is issued

The Auth Service issues the same JWT access token + HTTP-only refresh token cookie as regular sign-in. The Google flow is invisible to all downstream services - everything beyond the auth handshake uses the standard JWT.

---

## Debug Mode

For local development without a real Google Client ID, the service supports a debug token format:

```
idToken: "debug-google:user@example.com"
```

This bypasses the Google API call and injects a synthetic `GoogleIdentity`. It is only active when `auth.feature.allow-debug-google-tokens=true` (controlled via Vault/env config).

---

## Configuration

| Environment Variable | Description |
|---|---|
| `AUTH_FEATURES_GOOGLE_CLIENT_ID` | Google OAuth 2.0 Client ID (from Google Cloud Console) |
| `AUTH_FEATURES_ALLOW_DEBUG_GOOGLE_TOKENS` | `true` to allow `debug-google:` tokens (dev only) |

---

## Security Properties

- Token verification is delegated to Google's own tokeninfo endpoint - the service never parses the JWT itself.
- Audience (`aud`) is validated to prevent token reuse from other OAuth clients.
- Debug tokens are gated behind a separate feature flag that defaults to `false`.
- Email addresses from Google are treated as verified (`emailVerified: true`) and do not require separate email verification.
