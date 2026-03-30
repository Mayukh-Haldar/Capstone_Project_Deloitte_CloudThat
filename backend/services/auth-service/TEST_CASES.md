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

Additional Postman system tests added in v2 (AUTH-ST-012 to AUTH-ST-026) are described below.

---

## Controller Layer Tests (HTTP Integration)

These tests run with `@SpringBootTest` + `MockMvc` + H2 in-memory DB. They exercise the full HTTP request/response cycle for every endpoint.

**File locations:**
- `src/test/java/com/eventzen/auth/controller/AuthControllerTest.java` (30 tests)
- `src/test/java/com/eventzen/auth/controller/UserControllerTest.java` (15 tests)
- `src/test/java/com/eventzen/auth/controller/AccountRequestControllerTest.java` (20 tests)

| Test ID | Class | Method | Endpoint | Scenario | Expected HTTP Status |
|---------|-------|--------|----------|----------|---------------------|
| AUTH-CT-001 | AuthControllerTest | registerWithValidPayloadReturns200WithTokens | POST /api/v1/auth/register | Valid registration | 200 + accessToken |
| AUTH-CT-002 | AuthControllerTest | registerWithDuplicateEmailReturns409 | POST /api/v1/auth/register | Duplicate email | 409 Conflict |
| AUTH-CT-003 | AuthControllerTest | registerWithMissingFieldsReturns400 | POST /api/v1/auth/register | Missing required fields | 400 + VALIDATION_ERROR + details array |
| AUTH-CT-004 | AuthControllerTest | registerWithInvalidEmailReturns400FieldError | POST /api/v1/auth/register | Invalid email format | 400 + details field error for 'email' |
| AUTH-CT-005 | AuthControllerTest | loginWithCorrectCredentialsReturns200 | POST /api/v1/auth/login | Valid credentials | 200 + tokens |
| AUTH-CT-006 | AuthControllerTest | loginWithWrongPasswordReturns401 | POST /api/v1/auth/login | Wrong password | 401 |
| AUTH-CT-007 | AuthControllerTest | loginWithUnknownEmailReturns401 | POST /api/v1/auth/login | Non-existent user | 401 |
| AUTH-CT-008 | AuthControllerTest | loginWithMissingEmailFieldReturns400 | POST /api/v1/auth/login | Missing email field | 400 + VALIDATION_ERROR |
| AUTH-CT-009 | AuthControllerTest | googleLoginWithDebugTokenCreatesUserAndReturns200 | POST /api/v1/auth/google/login | Debug Google token | 200 + tokens |
| AUTH-CT-010 | AuthControllerTest | googleLoginWithMissingTokenReturns400 | POST /api/v1/auth/google/login | Missing idToken | 400 |
| AUTH-CT-011 | AuthControllerTest | refreshWithValidTokenReturns200AndRotatesTokens | POST /api/v1/auth/refresh | Valid refresh token | 200 + rotated tokens |
| AUTH-CT-012 | AuthControllerTest | refreshWithUnknownTokenReturns401 | POST /api/v1/auth/refresh | Invalid/unknown token | 401 |
| AUTH-CT-013 | AuthControllerTest | refreshWithMissingFieldReturns400 | POST /api/v1/auth/refresh | Missing refreshToken | 400 |
| AUTH-CT-014 | AuthControllerTest | logoutWithValidRefreshTokenReturns200 | POST /api/v1/auth/logout | Valid logout + token revocation check | 200 + "Logout successful" |
| AUTH-CT-015 | AuthControllerTest | logoutWithMissingBodyReturns400 | POST /api/v1/auth/logout | No Authorization header | 401 |
| AUTH-CT-016 | AuthControllerTest | getMeWithValidTokenReturns200WithProfile | GET /api/v1/auth/me | Authenticated | 200 + user profile |
| AUTH-CT-017 | AuthControllerTest | getMeWithoutTokenReturns401 | GET /api/v1/auth/me | Unauthenticated | 401 |
| AUTH-CT-018 | AuthControllerTest | setupMfaWithValidTokenReturns200WithSecretAndUri | POST /api/v1/auth/mfa/setup | Authenticated | 200 + secret + otpauthUri |
| AUTH-CT-019 | AuthControllerTest | setupMfaWithoutTokenReturns401 | POST /api/v1/auth/mfa/setup | Unauthenticated | 401 |
| AUTH-CT-020 | AuthControllerTest | verifyMfaWithInvalidCodeReturns401 | POST /api/v1/auth/mfa/verify | Invalid TOTP code | 4xx |
| AUTH-CT-021 | AuthControllerTest | verifyMfaWithoutTokenReturns401 | POST /api/v1/auth/mfa/verify | Unauthenticated | 401 |
| AUTH-CT-022 | AuthControllerTest | forgotPasswordForExistingUserReturns200WithDebugHeader | POST /api/v1/auth/forgot-password | Existing email | 200 + X-Debug-Password-Reset-Token header |
| AUTH-CT-023 | AuthControllerTest | forgotPasswordForNonExistentEmailReturns200 | POST /api/v1/auth/forgot-password | Non-existent email (no enumeration) | 200 |
| AUTH-CT-024 | AuthControllerTest | resetPasswordWithValidTokenUpdatesPasswordAndAllowsReLogin | POST /api/v1/auth/reset-password | Valid debug token | 200 + re-login succeeds |
| AUTH-CT-025 | AuthControllerTest | resetPasswordWithBadTokenReturns401 | POST /api/v1/auth/reset-password | Invalid token | 4xx |
| AUTH-CT-026 | AuthControllerTest | resendEmailVerificationReturns200WithDebugHeader | POST /api/v1/auth/email-verification/resend | Registered email | 200 + X-Debug-Email-Verification-Token |
| AUTH-CT-027 | AuthControllerTest | confirmEmailVerificationWithValidTokenReturns200 | POST /api/v1/auth/email-verification/confirm | Valid debug token | 200 + "Email verified" |
| AUTH-CT-028 | AuthControllerTest | confirmEmailVerificationWithBadTokenReturnsError | POST /api/v1/auth/email-verification/confirm | Invalid token | 4xx |
| AUTH-CT-029 | AuthControllerTest | updateProfileWithValidPayloadReturns200 | PATCH /api/v1/auth/me/profile | Authenticated | 200 + updated profile |
| AUTH-CT-030 | AuthControllerTest | updateProfileWithoutTokenReturns401 | PATCH /api/v1/auth/me/profile | Unauthenticated | 401 |
| AUTH-CT-031 | UserControllerTest | listUsersAsAdminReturns200WithPage | GET /api/v1/users | Admin JWT | 200 + paginated list |
| AUTH-CT-032 | UserControllerTest | listUsersAsNonAdminReturns403 | GET /api/v1/users | Non-admin JWT | 403 |
| AUTH-CT-033 | UserControllerTest | listUsersUnauthenticatedReturns401 | GET /api/v1/users | No JWT | 401 |
| AUTH-CT-034 | UserControllerTest | assignRoleAsAdminReturns200WithUpdatedUser | PUT /api/v1/users/{id}/roles | Admin | 200 + updated roles |
| AUTH-CT-035 | UserControllerTest | assignRoleAsNonAdminReturns403 | PUT /api/v1/users/{id}/roles | Non-admin | 403 |
| AUTH-CT-036 | UserControllerTest | assignRoleForUnknownUserReturns404 | PUT /api/v1/users/{id}/roles | Unknown user UUID | 404 |
| AUTH-CT-037 | UserControllerTest | deactivateUserAsAdminReturns200 | DELETE /api/v1/users/{id} | Admin | 200 + message |
| AUTH-CT-038 | UserControllerTest | deactivateUserAsNonAdminReturns403 | DELETE /api/v1/users/{id} | Non-admin | 403 |
| AUTH-CT-039 | UserControllerTest | deactivateNonExistentUserReturns404 | DELETE /api/v1/users/{id} | Unknown UUID | 404 |
| AUTH-CT-040 | UserControllerTest | reactivateUserAsAdminReturns200 | PATCH /api/v1/users/{id}/reactivate | Admin | 200 + message |
| AUTH-CT-041 | UserControllerTest | reactivateUserAsNonAdminReturns403 | PATCH /api/v1/users/{id}/reactivate | Non-admin | 403 |
| AUTH-CT-042 | UserControllerTest | reactivateNonExistentUserReturns404 | PATCH /api/v1/users/{id}/reactivate | Unknown UUID | 404 |
| AUTH-CT-043 | UserControllerTest | gdprDeleteUserAsAdminReturns200 | DELETE /api/v1/users/{id}/gdpr/delete | Admin | 200 + message |
| AUTH-CT-044 | UserControllerTest | gdprDeleteUserAsNonAdminReturns403 | DELETE /api/v1/users/{id}/gdpr/delete | Non-admin | 403 |
| AUTH-CT-045 | UserControllerTest | gdprDeleteNonExistentUserReturns404 | DELETE /api/v1/users/{id}/gdpr/delete | Unknown UUID | 404 |
| AUTH-CT-046 | AccountRequestControllerTest | submitAccountRequestAsAuthenticatedUserReturns200PendingStatus | POST /api/v1/account-requests | Authenticated | 200 + PENDING status |
| AUTH-CT-047 | AccountRequestControllerTest | submitAccountRequestUnauthenticatedReturns401 | POST /api/v1/account-requests | Unauthenticated | 401 |
| AUTH-CT-048 | AccountRequestControllerTest | submitAccountRequestMissingTypeReturns400 | POST /api/v1/account-requests | Missing type field | 400 + VALIDATION_ERROR |
| AUTH-CT-049 | AccountRequestControllerTest | listMyRequestsAsAuthenticatedUserReturns200List | GET /api/v1/account-requests/me | Authenticated | 200 + array |
| AUTH-CT-050 | AccountRequestControllerTest | listMyRequestsUnauthenticatedReturns401 | GET /api/v1/account-requests/me | Unauthenticated | 401 |
| AUTH-CT-051 | AccountRequestControllerTest | publicReactivationForAnyEmailReturns200 | POST /api/v1/account-requests/public/reactivation | Unknown email | 200 (no enumeration) |
| AUTH-CT-052 | AccountRequestControllerTest | publicReactivationForActiveUserReturns200 | POST /api/v1/account-requests/public/reactivation | Active user | 200 (silent) |
| AUTH-CT-053 | AccountRequestControllerTest | publicReactivationWithMissingEmailReturns400 | POST /api/v1/account-requests/public/reactivation | Missing email | 400 + VALIDATION_ERROR |
| AUTH-CT-054 | AccountRequestControllerTest | publicStatusForUnknownEmailReturns200FalseFlags | GET /api/v1/account-requests/public/reactivation/status | Unknown email | 200 + both flags false |
| AUTH-CT-055 | AccountRequestControllerTest | publicStatusForActiveUserReturns200BothFlagsFalse | GET /api/v1/account-requests/public/reactivation/status | Active user | 200 + accountInactive=false |
| AUTH-CT-056 | AccountRequestControllerTest | cancelMyPendingRequestReturns200Canceled | DELETE /api/v1/account-requests/{id} | Owner cancels | 200 + "Request canceled" |
| AUTH-CT-057 | AccountRequestControllerTest | cancelRequestUnauthenticatedReturns401 | DELETE /api/v1/account-requests/{id} | Unauthenticated | 401 |
| AUTH-CT-058 | AccountRequestControllerTest | cancelOtherUsersRequestReturns403Or404 | DELETE /api/v1/account-requests/{id} | Wrong owner | 403 or 404 |
| AUTH-CT-059 | AccountRequestControllerTest | listRequestsAsAdminReturns200Array | GET /api/v1/account-requests/admin | Admin | 200 + array |
| AUTH-CT-060 | AccountRequestControllerTest | listRequestsAsAdminWithStatusFilterReturns200 | GET /api/v1/account-requests/admin?status=PENDING | Admin + filter | 200 + array |
| AUTH-CT-061 | AccountRequestControllerTest | listRequestsAsNonAdminReturns403 | GET /api/v1/account-requests/admin | Non-admin | 403 |
| AUTH-CT-062 | AccountRequestControllerTest | approveAccountRequestAsAdminReturns200ApprovedStatus | PATCH /api/v1/account-requests/admin/{id}/approve | Admin | 200 + APPROVED |
| AUTH-CT-063 | AccountRequestControllerTest | approveAccountRequestAsNonAdminReturns403 | PATCH /api/v1/account-requests/admin/{id}/approve | Non-admin | 403 |
| AUTH-CT-064 | AccountRequestControllerTest | rejectAccountRequestAsAdminReturns200RejectedStatus | PATCH /api/v1/account-requests/admin/{id}/reject | Admin | 200 + REJECTED |
| AUTH-CT-065 | AccountRequestControllerTest | rejectAccountRequestAsNonAdminReturns403 | PATCH /api/v1/account-requests/admin/{id}/reject | Non-admin | 403 |

---

## System Tests: Postman Collection v2 (AUTH-ST-012 to AUTH-ST-026)

**Collection file:** `src/test/postman/auth-service-postman-collection.json`
**Environment file:** `src/test/postman/auth-service-postman-environment.json`

These extend the original 11 manual system tests with fully automated Postman tests covering all 26 endpoints. Run in order (each test may build on variables set by previous requests).

| Test ID | Type | Scenario | Request | Expected |
|---------|------|----------|---------|----------|
| AUTH-ST-012 | System | Auth — Update profile | PATCH /api/v1/auth/me/profile | 200 + updated lastName |
| AUTH-ST-013 | System | Auth — MFA setup | POST /api/v1/auth/mfa/setup | 200 + secret + otpauthUri |
| AUTH-ST-014 | System | Auth — Logout | POST /api/v1/auth/logout | 200 + "Logout successful" |
| AUTH-ST-015 | System | Admin — Bootstrap token | POST /api/v1/auth/login (admin) | 200 + adminAccessToken captured |
| AUTH-ST-016 | System | Admin — List users | GET /api/v1/users | 200 + paged content |
| AUTH-ST-016b | System | Users — Non-admin access rejected | GET /api/v1/users (non-admin) | 403 |
| AUTH-ST-017 | System | Admin — Assign role | PUT /api/v1/users/{id}/roles | 200 + updated roles |
| AUTH-ST-018 | System | Admin — Deactivate user | DELETE /api/v1/users/{id} | 200 + message |
| AUTH-ST-019 | System | Admin — Reactivate user | PATCH /api/v1/users/{id}/reactivate | 200 + message |
| AUTH-ST-020 | System | Admin — GDPR delete | DELETE /api/v1/users/{id}/gdpr/delete | 200 + message |
| AUTH-ST-021 | System | Account Requests — Submit vendor request | POST /api/v1/account-requests | 200 + PENDING |
| AUTH-ST-022 | System | Account Requests — List mine | GET /api/v1/account-requests/me | 200 + array |
| AUTH-ST-023 | System | Account Requests — Public reactivation status | GET /api/v1/account-requests/public/reactivation/status | 200 + boolean flags |
| AUTH-ST-024 | System | Account Requests — Public reactivation request | POST /api/v1/account-requests/public/reactivation | 200 + message |
| AUTH-ST-025 | System | Account Requests — Admin list (filtered) | GET /api/v1/account-requests/admin?status=PENDING | 200 + array |
| AUTH-ST-026 | System | Account Requests — Admin approve | PATCH /api/v1/account-requests/admin/{id}/approve | 200 + APPROVED |

**Run with Newman (CLI):**

```bash
newman run src/test/postman/auth-service-postman-collection.json \
  -e src/test/postman/auth-service-postman-environment.json \
  --reporters cli,json
```

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
