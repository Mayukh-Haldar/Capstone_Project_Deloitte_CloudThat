# EventZen Notification Service

Node.js + Express + MongoDB notification microservice for EventZen. It follows the PRD requirements for:

- Multi-channel dispatch across `EMAIL`, `SMS`, `PUSH`, `IN_APP`, and `WEBHOOK`
- Template-driven content with Handlebars and version history
- Per-user notification preferences
- Delivery logging and admin observability
- Internal event-trigger endpoint that can later be fed by Kafka producers
- Frontend inbox/preferences integration through `/api/v1/notifications/*`

## Gmail SMTP setup

Real email delivery is supported through SMTP and works with Gmail App Passwords.

Add these to your notification-service `.env`:

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

Notes:

- Use a Gmail App Password, not your normal Gmail password.
- If these values are absent, the email channel falls back to the mock provider so local development still works.
- The service also accepts the auth-service env names like `AUTH_SMTP_HOST` as fallback, so you can share one SMTP setup across services.

## Firebase push setup

Real push delivery is supported through Firebase Cloud Messaging.

Add these to the notification-service `.env`:

```env
NOTIFICATION_FIREBASE_PROJECT_ID=your-firebase-project-id
NOTIFICATION_FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
NOTIFICATION_FIREBASE_PRIVATE_KEY=<set-via-local-secret-store>
```

The frontend also needs Firebase Web SDK config and a VAPID key so browsers can register push tokens.

If Firebase credentials are not configured, the push channel falls back to a mock provider.

## Run

```bash
npm install
npm start
```

Copy [`.env.example`](/c:/Users/mayuk/OneDrive/Desktop/Document_Folders_in_Desktop/Deloitte_Capstone_Project/backend/services/notification-service/.env.example) to `.env` and adjust values as needed.

Default local port: `8086`

## Main endpoints

- `POST /api/v1/notifications/send`
- `GET /api/v1/notifications`
- `GET /api/v1/notifications/:id`
- `PATCH /api/v1/notifications/:id/read`
- `DELETE /api/v1/notifications/:id`
- `GET /api/v1/notifications/templates`
- `POST /api/v1/notifications/templates`
- `PUT /api/v1/notifications/templates/:id`
- `POST /api/v1/notifications/templates/:id/preview`
- `GET /api/v1/notifications/preferences`
- `POST /api/v1/notifications/preferences`
- `GET /api/v1/notifications/delivery-logs`
- `GET/POST/DELETE /api/v1/notifications/webhook-subscriptions`

## Auth

- User-facing routes accept JWT bearer tokens compatible with the existing auth service.
- In `development` and `test`, you can use:
  - `x-user-id`
  - `x-user-email`
  - `x-user-roles`
- Internal trigger route uses `x-internal-service-key`.

## Delivery behavior

Current provider implementations are safe local mocks so the service works end-to-end without SES/Twilio/FCM credentials. The provider abstraction is in [channelProviders.js](/c:/Users/mayuk/OneDrive/Desktop/Document_Folders_in_Desktop/Deloitte_Capstone_Project/backend/services/notification-service/src/providers/channelProviders.js) and is ready to swap with real integrations.

## Kafka and BullMQ

- Kafka bootstrap is scaffolded behind `ENABLE_KAFKA=true`
- BullMQ/Redis config is present in env/package setup for future retry queue wiring

This keeps the service runnable in the current repo even though the existing backend services are not yet publishing Kafka events locally.
