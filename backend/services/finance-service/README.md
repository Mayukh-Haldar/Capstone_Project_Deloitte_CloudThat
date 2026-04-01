# Finance Service

Spring Boot finance and payments service for EventZen.

- Base URL: `http://localhost:8085`
- API prefix: `/api/v1`
- Swagger UI: `/swagger-ui.html`
- Health: `/actuator/health`
- Metrics: `/actuator/prometheus`

## What it handles

- Budget creation and approval
- Budget line items
- Expense logging
- Payment initiation and verification
- Invoice generation
- Event-level financial reports
- Calls to ticketing, venue-vendor, notification, storage, and Razorpay

## Run locally

Copy `.env.example` to `.env`, update the values you need, then run:

```bash
./mvnw spring-boot:run
```

Default port is `8085`.

## Important configuration

Core local variables from `.env.example`:

```env
FINANCE_DB_URL=jdbc:mysql://localhost:3306/eventzen_finance?createDatabaseIfNotExist=true&serverTimezone=UTC
FINANCE_DB_USERNAME=root
FINANCE_DB_PASSWORD=replace-with-finance-db-password
AUTH_JWT_SECRET=replace-with-auth-jwt-secret
AUTH_JWT_ISSUER=eventzen-auth-service
FINANCE_CORS_ALLOWED_ORIGINS=http://localhost:5173
NOTIFICATION_SERVICE_BASE_URL=http://localhost:8086
NOTIFICATION_INTERNAL_SERVICE_KEY=replace-with-internal-service-key
```

Razorpay config:

```env
FINANCE_RAZORPAY_ENABLED=true
FINANCE_RAZORPAY_KEY_ID=replace-with-razorpay-key-id
FINANCE_RAZORPAY_KEY_SECRET=replace-with-razorpay-key-secret
FINANCE_RAZORPAY_CHECKOUT_NAME=EventZen
FINANCE_RAZORPAY_CHECKOUT_DESCRIPTION=Event registration payment
```

The service also supports:

- `TICKETING_SERVICE_BASE_URL`
- `TICKETING_INTERNAL_SERVICE_KEY`
- `VENUE_VENDOR_SERVICE_BASE_URL`
- `VENUE_VENDOR_INTERNAL_SERVICE_KEY`
- `FINANCE_STORAGE_ENABLED`
- `FINANCE_STORAGE_ENDPOINT`
- `FINANCE_STORAGE_ACCESS_KEY`
- `FINANCE_STORAGE_SECRET_KEY`
- `FINANCE_STORAGE_BUCKET`
- `FINANCE_STORAGE_PUBLIC_BASE_URL`
- `FINANCE_STORAGE_INVOICES_PREFIX`

## Main routes

### Budgets

- `POST /api/v1/events/{eventId}/budget`
- `GET /api/v1/events/{eventId}/budget`
- `PUT /api/v1/budgets/{budgetId}/approve`
- `POST /api/v1/budgets/{budgetId}/items`

### Expenses

- `POST /api/v1/expenses`

### Payments

- `POST /api/v1/payments`
- `GET /api/v1/payments/me`
- `GET /api/v1/payments/{paymentId}/invoice`
- `POST /api/v1/payments/webhook`
- `POST /api/v1/payments/verify`

### Reports

- `GET /api/v1/events/{eventId}/reports/financial`

### Service route

- `GET /`

## Notes

- Protected routes use the same JWT secret and issuer as `auth-service`.
- If Razorpay is disabled, the service can still handle non-gateway or simulated local flows.
- Invoice generation depends on storage settings when storage is enabled.
- Prometheus metrics and OpenTelemetry tracing are both wired in.

## Tests

Run the test suite with:

```bash
./mvnw test
```

There is also a Postman collection under `tests/postman/`.
