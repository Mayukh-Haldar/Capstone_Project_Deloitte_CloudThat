# Notification Service

Node.js notification service for EventZen.

- Base URL: `http://localhost:8086`
- API prefix: `/api/v1`
- OpenAPI JSON: `/openapi.json`
- Health: `/api/v1/health`
- Metrics: `/metrics`

## What it handles

- In-app notifications
- Email delivery through SMTP
- Push delivery through Firebase Admin SDK
- Template management and preview
- User notification preferences
- Push token registration
- Webhook subscriptions
- Newsletter subscriptions
- Kafka consumption and BullMQ wiring when enabled

## Run locally

Copy `.env.example` to `.env`, update the values you need, then run:

```bash
npm install
npm start
```

Use `npm run dev` if you want auto-reload during development.

## Important configuration

Core local variables from `.env.example`:

```env
PORT=8086
MONGO_URI=mongodb://localhost:27017/eventzen_notifications
AUTH_JWT_SECRET=replace-with-auth-jwt-secret
AUTH_JWT_ISSUER=eventzen-auth-service
CORS_ORIGIN=http://localhost:5173
INTERNAL_SERVICE_KEY=replace-with-internal-service-key
ENABLE_REQUEST_LOGS=true
```

SMTP delivery:

```env
NOTIFICATION_SMTP_HOST=smtp.gmail.com
NOTIFICATION_SMTP_PORT=587
NOTIFICATION_SMTP_USERNAME=replace-with-smtp-username
NOTIFICATION_SMTP_PASSWORD=replace-with-smtp-password
NOTIFICATION_SMTP_AUTH=true
NOTIFICATION_SMTP_STARTTLS=true
NOTIFICATION_MAIL_FROM_EMAIL=no-reply@example.com
NOTIFICATION_MAIL_FROM_NAME=EventZen
```

Firebase push:

```env
NOTIFICATION_FIREBASE_PROJECT_ID=replace-with-firebase-project-id
NOTIFICATION_FIREBASE_CLIENT_EMAIL=replace-with-firebase-client-email
NOTIFICATION_FIREBASE_PRIVATE_KEY=replace-with-firebase-private-key
```

Queue and messaging:

- `ENABLE_KAFKA`
- `KAFKA_BROKERS`
- `KAFKA_CLIENT_ID`
- `KAFKA_CONSUMER_GROUP`
- `KAFKA_TOPICS`
- `ENABLE_BULLMQ`
- `REDIS_URL`
- `ENABLE_SOCKET_IO`
- `SEED_DEFAULT_TEMPLATES`

If SMTP or Firebase credentials are missing, the service falls back to local-safe mock behavior for those channels.

## Main routes

### Notifications

- `POST /api/v1/notifications/send`
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/{id}`
- `PATCH /api/v1/notifications/{id}/read`
- `DELETE /api/v1/notifications/{id}`
- `GET /api/v1/notifications/delivery-logs`

### Templates and preferences

- `GET /api/v1/notifications/templates`
- `POST /api/v1/notifications/templates`
- `PUT /api/v1/notifications/templates/{id}`
- `POST /api/v1/notifications/templates/{id}/preview`
- `GET /api/v1/notifications/preferences`
- `POST /api/v1/notifications/preferences`

### Webhooks, push tokens, newsletter

- `GET /api/v1/notifications/webhook-subscriptions`
- `POST /api/v1/notifications/webhook-subscriptions`
- `DELETE /api/v1/notifications/webhook-subscriptions/{id}`
- `GET /api/v1/notifications/push-tokens`
- `POST /api/v1/notifications/push-tokens`
- `DELETE /api/v1/notifications/push-tokens/{id}`
- `POST /api/v1/notifications/newsletter`

## Auth notes

- User-facing routes accept bearer JWTs compatible with `auth-service`.
- In `development` and `test`, the service also accepts `x-user-id`, `x-user-email`, and `x-user-roles`.
- Internal trigger flows use `x-internal-service-key`.

## Tests

Run the main test suite with:

```bash
npm test
```

Useful subsets:

```bash
npm run test:unit
npm run test:integration
npm run test:system:postman
```
