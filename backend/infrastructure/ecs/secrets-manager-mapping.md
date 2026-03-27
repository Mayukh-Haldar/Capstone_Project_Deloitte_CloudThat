# EventZen AWS Secrets Manager Mapping

This document maps the current production configuration in `docker-compose.prod.yml` and the service config files to an ECS + AWS Secrets Manager deployment.

## Rules

- Put private runtime values in AWS Secrets Manager.
- Put non-secret service wiring in ECS `environment`.
- Put CI/CD-only values in GitHub repository secrets or variables.
- Do not store backend secrets in GitHub Actions environment variables.
- Frontend configuration is public once shipped to the browser, so do not treat it as a protected secret.

## GitHub Repository Secrets

Use GitHub secrets for deployment access only:

- `AWS_ACCOUNT_ID`
- `AWS_REGION`
- `AWS_ROLE_TO_ASSUME`
- `ECS_CLUSTER`

Use GitHub repository variables for non-secret deploy metadata:

- `ECS_ENVIRONMENT`
- `ECS_VPC_SUBNETS`
- `ECS_SECURITY_GROUPS`
- `FRONTEND_PUBLIC_GOOGLE_CLIENT_ID`
- `FRONTEND_PUBLIC_FIREBASE_API_KEY`
- `FRONTEND_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `FRONTEND_PUBLIC_FIREBASE_PROJECT_ID`
- `FRONTEND_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `FRONTEND_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `FRONTEND_PUBLIC_FIREBASE_APP_ID`
- `FRONTEND_PUBLIC_FIREBASE_VAPID_KEY`

## Shared Secret

Create one shared secret named `eventzen/prod/shared`.

Recommended JSON keys:

- `AUTH_JWT_SECRET`
- `AUTH_JWT_ISSUER`
- `NOTIFICATION_INTERNAL_SERVICE_KEY`

Optional shared keys if you want one place for common backend values:

- `FRONTEND_ORIGIN`
- `TICKETING_INTERNAL_SERVICE_KEY`

## Auth Service

Create a secret named `eventzen/prod/auth-service`.

Secrets Manager keys:

- `AUTH_DB_USERNAME`
- `AUTH_DB_PASSWORD`
- `AUTH_CRYPTO_SECRET`
- `AUTH_BOOTSTRAP_ADMIN_EMAIL`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- `AUTH_SMTP_HOST`
- `AUTH_SMTP_PORT`
- `AUTH_SMTP_USERNAME`
- `AUTH_SMTP_PASSWORD`
- `AUTH_SMTP_AUTH`
- `AUTH_SMTP_STARTTLS`
- `AUTH_MAIL_FROM_EMAIL`
- `AUTH_MAIL_FROM_NAME`
- `AUTH_GOOGLE_CLIENT_ID`

Plain ECS environment values:

- `AUTH_DB_URL`
- `NOTIFICATION_SERVICE_BASE_URL`
- `AUTH_APP_BASE_URL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `MANAGEMENT_TRACING_SAMPLING_PROBABILITY`
- `AUTH_BOOTSTRAP_ADMIN_FIRST_NAME`
- `AUTH_BOOTSTRAP_ADMIN_LAST_NAME`
- `AUTH_PASSWORD_RESET_MINUTES`
- `AUTH_EMAIL_VERIFICATION_HOURS`
- `AUTH_REQUIRE_VERIFIED_EMAIL_FOR_LOGIN`
- `AUTH_EXPOSE_DEBUG_TOKENS`
- `AUTH_ALLOW_DEBUG_GOOGLE_TOKENS`

## Event Service

Create a secret named `eventzen/prod/event-service`.

Secrets Manager keys:

- `EVENT_DB_USERNAME`
- `EVENT_DB_PASSWORD`
- `EVENT_STORAGE_ACCESS_KEY`
- `EVENT_STORAGE_SECRET_KEY`

Plain ECS environment values:

- `EVENT_DB_URL`
- `VENUE_VENDOR_SERVICE_URL`
- `EVENT_CORS_ALLOWED_ORIGINS`
- `EVENT_STORAGE_ENABLED`
- `EVENT_STORAGE_ENDPOINT`
- `EVENT_STORAGE_BUCKET`
- `EVENT_STORAGE_PUBLIC_BASE_URL`
- `EVENT_STORAGE_EVENT_BANNERS_PREFIX`
- `EVENT_STORAGE_SPEAKER_PHOTOS_PREFIX`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `MANAGEMENT_TRACING_SAMPLING_PROBABILITY`

## Venue Vendor Service

Create a secret named `eventzen/prod/venue-vendor-service`.

Secrets Manager keys:

- `MONGO_URI`

Plain ECS environment values:

- `PORT`
- `NOTIFICATION_SERVICE_BASE_URL`
- `CORS_ORIGIN`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `ENABLE_REQUEST_LOGS`

This service also reads shared secrets:

- `AUTH_JWT_SECRET`
- `AUTH_JWT_ISSUER`
- `NOTIFICATION_INTERNAL_SERVICE_KEY`

## Ticketing Service

Create a secret named `eventzen/prod/ticketing-service`.

Secrets Manager keys:

- `Mongo__ConnectionString`
- `Mongo__DatabaseName`
- `Storage__AccessKey`
- `Storage__SecretKey`

Plain ECS environment values:

- `Urls`
- `EventService__BaseUrl`
- `NotificationService__BaseUrl`
- `Cors__AllowedOrigins__0`
- `Storage__Enabled`
- `Storage__Endpoint`
- `Storage__Bucket`
- `Storage__PublicBaseUrl`
- `Storage__TicketPassesPrefix`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

This service also reads shared secrets:

- `Jwt__Secret` from `AUTH_JWT_SECRET`
- `Jwt__Issuer` from `AUTH_JWT_ISSUER`
- `NotificationService__InternalServiceKey` from `NOTIFICATION_INTERNAL_SERVICE_KEY`

## Finance Service

Create a secret named `eventzen/prod/finance-service`.

Secrets Manager keys:

- `FINANCE_DB_USERNAME`
- `FINANCE_DB_PASSWORD`
- `FINANCE_STORAGE_ACCESS_KEY`
- `FINANCE_STORAGE_SECRET_KEY`
- `FINANCE_RAZORPAY_KEY_ID`
- `FINANCE_RAZORPAY_KEY_SECRET`

Plain ECS environment values:

- `FINANCE_DB_URL`
- `NOTIFICATION_SERVICE_BASE_URL`
- `FINANCE_CORS_ALLOWED_ORIGINS`
- `TICKETING_SERVICE_BASE_URL`
- `FINANCE_STORAGE_ENABLED`
- `FINANCE_STORAGE_ENDPOINT`
- `FINANCE_STORAGE_BUCKET`
- `FINANCE_STORAGE_PUBLIC_BASE_URL`
- `FINANCE_STORAGE_INVOICES_PREFIX`
- `FINANCE_RAZORPAY_ENABLED`
- `FINANCE_RAZORPAY_CHECKOUT_NAME`
- `FINANCE_RAZORPAY_CHECKOUT_DESCRIPTION`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `MANAGEMENT_TRACING_SAMPLING_PROBABILITY`

This service also reads shared secrets:

- `AUTH_JWT_SECRET`
- `AUTH_JWT_ISSUER`
- `NOTIFICATION_INTERNAL_SERVICE_KEY`
- `TICKETING_INTERNAL_SERVICE_KEY`

For all internal service URL values above, use ECS service discovery names or another explicit internal ECS routing convention, not Docker Compose service hostnames.

## Notification Service

Create a secret named `eventzen/prod/notification-service`.

Secrets Manager keys:

- `MONGO_URI`
- `NOTIFICATION_SMTP_HOST`
- `NOTIFICATION_SMTP_PORT`
- `NOTIFICATION_SMTP_USERNAME`
- `NOTIFICATION_SMTP_PASSWORD`
- `NOTIFICATION_SMTP_AUTH`
- `NOTIFICATION_SMTP_STARTTLS`
- `NOTIFICATION_MAIL_FROM_EMAIL`
- `NOTIFICATION_MAIL_FROM_NAME`
- `NOTIFICATION_FIREBASE_PROJECT_ID`
- `NOTIFICATION_FIREBASE_CLIENT_EMAIL`
- `NOTIFICATION_FIREBASE_PRIVATE_KEY`

Plain ECS environment values:

- `PORT`
- `CORS_ORIGIN`
- `REDIS_URL`
- `KAFKA_BROKERS`
- `KAFKA_CLIENT_ID`
- `KAFKA_CONSUMER_GROUP`
- `KAFKA_TOPICS`
- `ENABLE_KAFKA`
- `ENABLE_BULLMQ`
- `ENABLE_SOCKET_IO`
- `SEED_DEFAULT_TEMPLATES`
- `DEFAULT_NOTIFICATION_LOCALE`
- `NOTIFICATION_RETENTION_DAYS`
- `OTEL_EXPORTER_OTLP_ENDPOINT`

This service also reads shared secrets:

- `AUTH_JWT_SECRET`
- `AUTH_JWT_ISSUER`
- `NOTIFICATION_INTERNAL_SERVICE_KEY`

## Frontend

The frontend should not use AWS Secrets Manager for private data.

Use plain public configuration only:

- `VITE_AUTH_SERVICE_URL`
- `VITE_EVENT_SERVICE_URL`
- `VITE_VENUE_VENDOR_SERVICE_URL`
- `VITE_TICKETING_SERVICE_URL`
- `VITE_FINANCE_SERVICE_URL`
- `VITE_NOTIFICATION_SERVICE_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_VAPID_KEY`

For this repo today, those values are baked into the image during `docker build` in `frontend/Dockerfile`.

## Suggested ALB Routing

Mirror the route ownership already defined in `backend/docker/nginx/nginx.prod.template.conf`.

- `/` -> `frontend`
- `/api/v1/auth*` -> `auth-service`
- `/api/v1/account-requests*` -> `auth-service`
- `/api/v1/users*` -> `auth-service`
- `/api/v1/events*` -> `event-service`
- `/api/v1/categories*` -> `event-service`
- `/api/v1/venues*` -> `venue-vendor-service`
- `/api/v1/vendors*` -> `venue-vendor-service`
- `/api/v1/tickets*` -> `ticketing-service`
- `/api/v1/payments*` -> `finance-service`
- `/api/v1/expenses*` -> `finance-service`
- `/api/v1/notifications*` -> `notification-service`
