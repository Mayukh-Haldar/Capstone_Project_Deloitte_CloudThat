# Auth Service Test Cases

## Scope

This document defines the recommended unit, integration, and system test coverage for the EventZen auth service.

Base URL for system tests:

`http://localhost:8081`

## Unit Test Cases

| Test ID | Layer | Component | Scenario | Preconditions | Input | Expected Result |
| --- | --- | --- | --- | --- | --- | --- |
| AUTH-UT-001 | Unit | `AuthenticationService` | Register succeeds for a new attendee | Email does not exist | Valid `RegisterRequest` | User is persisted, attendee role assigned, tokens returned |
| AUTH-UT-002 | Unit | `AuthenticationService` | Register rejects duplicate email | Existing user with same email | Valid `RegisterRequest` | `EventZenException`, HTTP 409 |
| AUTH-UT-003 | Unit | `AuthenticationService` | Login succeeds without MFA | Active user, correct password, MFA disabled | Valid `LoginRequest` | Access token and refresh token returned |
| AUTH-UT-004 | Unit | `AuthenticationService` | Login rejects invalid password | Existing user | Wrong password | `EventZenException`, HTTP 401 |
| AUTH-UT-005 | Unit | `AuthenticationService` | Login rejects inactive user | User exists but `is_active=false` | Valid credentials | `EventZenException`, HTTP 403 |
| AUTH-UT-006 | Unit | `AuthenticationService` | Login requires OTP when MFA enabled | MFA-enabled user | Missing or bad `otpCode` | `EventZenException`, HTTP 401 |
| AUTH-UT-007 | Unit | `AuthenticationService` | Refresh rotates token family member | Valid stored refresh token | Valid `RefreshTokenRequest` | Old token revoked, new tokens returned |
| AUTH-UT-008 | Unit | `AuthenticationService` | Refresh rejects unknown token | No stored token hash | Any refresh token | `EventZenException`, HTTP 401 |
| AUTH-UT-009 | Unit | `AuthenticationService` | Setup MFA encrypts secret before persistence | Existing user | User id | Plain secret returned in response, encrypted value stored |
| AUTH-UT-010 | Unit | `AuthenticationService` | Verify MFA enables MFA | Existing user with stored secret | Valid current TOTP code | `is_mfa_enabled=true` |
| AUTH-UT-011 | Unit | `UserManagementService` | Assign roles replaces existing roles | Existing user and valid roles | `AssignRolesRequest` | Old roles removed, requested roles persisted |
| AUTH-UT-012 | Unit | `UserManagementService` | Deactivate user revokes refresh tokens | Existing active user with refresh tokens | User id | `is_active=false`, tokens revoked |
| AUTH-UT-013 | Unit | `UserManagementService` | Reactivate user restores active flag | Existing inactive user | User id | `is_active=true` |
| AUTH-UT-014 | Unit | `UserManagementService` | GDPR delete anonymizes user | Existing user | User id | Email replaced, password cleared, user inactive |
| AUTH-UT-015 | Unit | `JwtService` | Access token has access type claim | Valid principal | Principal | Token parses, `type=access` |
| AUTH-UT-016 | Unit | `JwtService` | Refresh token has refresh type claim | Valid principal | Principal, family id | Token parses, `type=refresh` |
| AUTH-UT-017 | Unit | `JwtService` | Invalid token fails validation safely | Invalid token string | Invalid token | `isAccessToken=false`, `isRefreshToken=false`, `extractSubject=null` |
| AUTH-UT-018 | Unit | `FieldEncryptionService` | Encrypt and decrypt roundtrip | Valid crypto secret | Plain text | Decrypted value equals original |
| AUTH-UT-019 | Unit | `FieldEncryptionService` | Backward compatibility for plain value | Existing plain DB value | Plain text | `decryptIfNeeded` returns original string |
| AUTH-UT-020 | Unit | `TotpService` | Generated secret can validate current code | Generated secret | Current TOTP code | `verifyCode=true` |
| AUTH-UT-021 | Unit | `AuthenticationService` | Forgot password generates reset token | Existing active user | Valid email | Reset token hash and expiry persisted, notification triggered |
| AUTH-UT-022 | Unit | `AuthenticationService` | Reset password updates password and revokes refresh tokens | User has valid reset token | Valid `ResetPasswordRequest` | Password hash replaced, reset token cleared, existing refresh tokens revoked |
| AUTH-UT-023 | Unit | `AuthenticationService` | Verify email marks user as verified | User has valid verification token | Valid token | `email_verified=true`, verification token cleared |
| AUTH-UT-024 | Unit | `AuthenticationService` | Google Sign In creates new attendee when no local user exists | Valid Google identity and configured client id | Valid `GoogleSignInRequest` | New user persisted, attendee role assigned, JWTs returned |
| AUTH-UT-025 | Unit | `AuthenticationService` | Update profile changes email and triggers re-verification | Existing verified user | Valid `UpdateProfileRequest` with new email | Profile updated, `email_verified=false`, new verification token generated |

## Integration Test Cases

| Test ID | Layer | Scenario | Preconditions | Input | Expected Result |
| --- | --- | --- | --- | --- | --- |
| AUTH-IT-001 | Integration | Spring context boots with test profile | H2 test DB available | Application startup | Context loads successfully |
| AUTH-IT-002 | Integration | Register persists user, role, and refresh token | Empty DB | Valid registration | User row, `user_roles`, and `refresh_tokens` created |
| AUTH-IT-003 | Integration | Login succeeds after registration | Registered user | Valid email and password | Tokens returned, audit row inserted |
| AUTH-IT-004 | Integration | Refresh rotates persisted token | Registered user with valid refresh token | Valid refresh token | Old token revoked, new token row added |
| AUTH-IT-005 | Integration | Logout revokes token family | Registered user with active refresh token | Valid refresh token | All family tokens marked revoked |
| AUTH-IT-006 | Integration | MFA setup stores encrypted DB value | Registered user | Setup MFA | Returned secret differs from persisted DB value |
| AUTH-IT-007 | Integration | MFA verify enables MFA and future login requires OTP | Registered user with setup MFA | Valid OTP | `is_mfa_enabled=true`, login without OTP fails |
| AUTH-IT-008 | Integration | Deactivated user cannot authenticate | Registered user later deactivated | Valid credentials | Login fails with authorization error |
| AUTH-IT-009 | Integration | Reactivated user can authenticate again | Previously deactivated user reactivated | Valid credentials | Login succeeds |
| AUTH-IT-010 | Integration | Admin can assign roles to another user | Seeded admin exists | Target user id and roles | Role assignments updated in DB |
| AUTH-IT-011 | Integration | Email verification flow works end to end | Registered user with outstanding verification token | Resend verification then confirm token | `email_verified=true` in DB |
| AUTH-IT-012 | Integration | Forgot/reset password flow works end to end | Registered user | Forgot password then reset with issued token | User can log in with new password |
| AUTH-IT-013 | Integration | Profile update persists new contact details | Registered user | Valid `UpdateProfileRequest` | Email and phone updated, `email_verified=false` after email change |

## System Test Cases

| Test ID | Layer | Scenario | Steps | Expected Result |
| --- | --- | --- | --- | --- |
| AUTH-ST-001 | System | End-to-end registration and profile fetch | Register, call `/api/v1/auth/me` with access token | Profile payload matches created user |
| AUTH-ST-002 | System | MFA end-to-end login | Register, login, setup MFA, verify MFA, login again with `otpCode` | MFA-protected login succeeds |
| AUTH-ST-003 | System | Refresh token lifecycle | Login, refresh token, logout, refresh old token | First refresh succeeds, later refresh fails |
| AUTH-ST-004 | System | Admin manages roles | Admin login, list users, assign admin role to another user | Target user receives new roles |
| AUTH-ST-005 | System | Admin deactivate and reactivate flow | Admin deactivates user, user login fails, admin reactivates user, login succeeds | Account state transitions work correctly |
| AUTH-ST-006 | System | Unauthorized access rejection | Non-admin calls `/api/v1/users` | HTTP 403 |
| AUTH-ST-007 | System | Bad input validation | Call register/login with invalid payload | Standardized validation error JSON returned |
| AUTH-ST-008 | System | Update my profile | Login, call `/api/v1/auth/me/profile` with changed email/phone, call `/api/v1/auth/me` | Updated values returned, `emailVerified=false` after email change |
| AUTH-ST-009 | System | Email verification confirmation | Register user, read verification token from service logs, call `/api/v1/auth/email-verification/confirm` | Email becomes verified |
| AUTH-ST-010 | System | Forgot and reset password | Register user, call forgot password, read reset token from service logs, reset password, login with new password | Login succeeds with new password |
| AUTH-ST-011 | System | Google Sign In | Obtain Google ID token for configured client id, call `/api/v1/auth/google/login` | Existing or new user receives JWTs |

## Execution Recommendation

1. Run unit tests on every local change.
2. Run integration tests before merging any auth logic change.
3. Run the system scenarios from Postman or Newman before demo or release packaging.

## Automated Local System Test Notes

The Postman collection is now fully automatable for local development when these flags are enabled:

- `AUTH_EXPOSE_DEBUG_TOKENS=true`
- `AUTH_ALLOW_DEBUG_GOOGLE_TOKENS=true`

These are already set in the local [.env](C:/Users/mayuk/OneDrive/Desktop/Document_Folders_in_Desktop/Deloitte_Capstone_Project/backend/services/auth-service/.env) file for this service.

### What the automation does

1. Register and profile-update responses expose the verification token in `X-Debug-Email-Verification-Token`.
2. Forgot-password responses expose the reset token in `X-Debug-Password-Reset-Token`.
3. The Postman collection captures those headers automatically into environment variables.
4. Google Sign In uses the debug token format `debug-google:user@example.com` in local development, so no frontend is required.

### Google Sign In

For real Google Sign In outside local debug mode:

1. Set `AUTH_GOOGLE_CLIENT_ID` in the auth-service environment before startup.
2. Obtain a real Google ID token minted for that client id from your frontend or Google OAuth playground-compatible flow.
3. Paste the token into the Postman environment variable `googleIdToken`.
4. Run `POST /api/v1/auth/google/login`.
