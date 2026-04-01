# Auth Service

Spring Boot auth service for EventZen.

- Base URL: `http://localhost:8081`
- API prefix: `/api/v1`
- Swagger UI: `/swagger-ui.html`
- Health: `/actuator/health`
- Metrics: `/actuator/prometheus`

## What it handles

- Email/password registration and login
- Google sign-in
- JWT access and refresh token flow
- Email verification and password reset
- MFA setup and verification
- User profile and admin user management
- Account requests for vendor access, reactivation, and GDPR-style deletion

## Run locally

Copy `.env.example` to `.env`, fill in the values you need, then start the service:

```bash
./mvnw spring-boot:run
```

Default port is `8081`.

## Important configuration

Common local variables from `.env.example`:

```env
AUTH_DB_URL=jdbc:mysql://localhost:3306/eventzen_users?createDatabaseIfNotExist=true&serverTimezone=UTC
AUTH_DB_USERNAME=root
AUTH_DB_PASSWORD=replace-with-auth-db-password
AUTH_JWT_SECRET=replace-with-auth-jwt-secret
AUTH_JWT_ISSUER=eventzen-auth-service
AUTH_APP_BASE_URL=http://localhost:5173
AUTH_CRYPTO_SECRET=replace-with-auth-crypto-secret
AUTH_BOOTSTRAP_ADMIN_EMAIL=admin@example.com
AUTH_BOOTSTRAP_ADMIN_PASSWORD=replace-with-strong-admin-password
AUTH_GOOGLE_CLIENT_ID=
NOTIFICATION_SERVICE_BASE_URL=http://localhost:8086
```

### Email delivery

If SMTP is configured, the service sends real verification and reset emails. If not, it falls back to debug/log-based behavior.

```env
AUTH_SMTP_HOST=smtp.gmail.com
AUTH_SMTP_PORT=587
AUTH_SMTP_USERNAME=replace-with-smtp-username
AUTH_SMTP_PASSWORD=replace-with-smtp-password
AUTH_SMTP_AUTH=true
AUTH_SMTP_STARTTLS=true
AUTH_MAIL_FROM_EMAIL=no-reply@example.com
AUTH_MAIL_FROM_NAME=EventZen
```

For Gmail, use an app password rather than your normal account password.

## Roles

The service uses these role names:

- `ADMIN`
- `ORGANIZER`
- `VENDOR`
- `ATTENDEE`

Self-registration and Google sign-in do not let users create admin accounts directly. If `requestedRole` is missing or set to `ADMIN`, the service defaults the account to `ATTENDEE`.

## Main routes

### Public

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
- `POST /api/v1/account-requests/public/reactivation`
- `GET /api/v1/account-requests/public/reactivation/status`

### Authenticated user

- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `PATCH /api/v1/auth/me/profile`
- `POST /api/v1/auth/mfa/setup`
- `POST /api/v1/auth/mfa/verify`
- `POST /api/v1/account-requests`
- `GET /api/v1/account-requests/me`
- `DELETE /api/v1/account-requests/{id}`

### Admin

- `GET /api/v1/users`
- `PUT /api/v1/users/{id}/roles`
- `DELETE /api/v1/users/{id}`
- `PATCH /api/v1/users/{id}/reactivate`
- `DELETE /api/v1/users/{id}/gdpr/delete`
- `GET /api/v1/account-requests/admin`
- `PATCH /api/v1/account-requests/admin/{id}/approve`
- `PATCH /api/v1/account-requests/admin/{id}/reject`

## Notes

- Bearer JWTs are required for protected routes.
- When `auth.features.expose-debug-tokens=true`, some auth flows return debug headers for local testing.
- `DataSeeder` bootstraps roles, permissions, and the initial admin account on startup.
- The service records audit logs for sensitive account actions.

## Tests

Run the test suite with:

```bash
./mvnw test
```

There is also a Postman collection under `src/test/postman/`.
