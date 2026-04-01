# Event Service

Spring Boot event lifecycle service for EventZen.

- Base URL: `http://localhost:8082`
- API prefix: `/api/v1`
- Swagger UI: `/swagger-ui.html`
- Health: `/actuator/health`
- Metrics: `/actuator/prometheus`

## What it handles

- Event CRUD
- Event approval and enable/disable flows
- Sessions and agenda management
- Banner image and speaker photo uploads
- Category management
- Internal booking ownership checks for other services
- Kafka event publishing for event updates and cancellations

## Run locally

Copy `.env.example` to `.env`, update the values you need, then run:

```bash
./mvnw spring-boot:run
```

Default port is `8082`.

## Important configuration

Common local variables from `.env.example`:

```env
EVENT_DB_URL=jdbc:mysql://localhost:3306/eventzen_events?createDatabaseIfNotExist=true&serverTimezone=UTC
EVENT_DB_USERNAME=root
EVENT_DB_PASSWORD=replace-with-event-db-password
AUTH_JWT_SECRET=replace-with-auth-jwt-secret
AUTH_JWT_ISSUER=eventzen-auth-service
EVENT_CORS_ALLOWED_ORIGINS=http://localhost:5173
VENUE_VENDOR_SERVICE_URL=http://localhost:8083
```

If you want uploads to work locally, these also matter:

```env
EVENT_STORAGE_ENABLED=true
EVENT_STORAGE_ENDPOINT=http://localhost:9000
EVENT_STORAGE_ACCESS_KEY=replace-with-storage-access-key
EVENT_STORAGE_SECRET_KEY=replace-with-storage-secret-key
EVENT_STORAGE_BUCKET=eventzen-media
EVENT_STORAGE_PUBLIC_BASE_URL=http://localhost:9000
EVENT_STORAGE_EVENT_BANNERS_PREFIX=event-banners
EVENT_STORAGE_SPEAKER_PHOTOS_PREFIX=speaker-photos
```

Other integrations used by the service:

- `NOTIFICATION_SERVICE_URL`
- `TICKETING_SERVICE_URL`
- `NOTIFICATION_INTERNAL_SERVICE_KEY`
- `KAFKA_BROKERS`

## Main routes

### Events and categories

- `GET /api/v1/categories`
- `GET /api/v1/events`
- `GET /api/v1/events/{id}`
- `POST /api/v1/events`
- `PUT /api/v1/events/{id}`
- `DELETE /api/v1/events/{id}`
- `PATCH /api/v1/events/{id}/status`
- `GET /api/v1/events/search?q=...`

### Approval and enable flows

- `POST /api/v1/events/{id}/request-enable`
- `GET /api/v1/events/enable-requests`
- `POST /api/v1/events/enable-requests/{requestId}/approve`
- `POST /api/v1/events/enable-requests/{requestId}/reject`
- `POST /api/v1/events/{id}/approval/approve`
- `POST /api/v1/events/{id}/approval/request-changes`
- `POST /api/v1/events/{id}/approval/reject`
- `POST /api/v1/events/{id}/approval/resubmit`
- `POST /api/v1/events/{id}/enable`
- `POST /api/v1/events/{id}/disable`

### Sessions and uploads

- `POST /api/v1/events/{id}/sessions`
- `PUT /api/v1/events/{id}/sessions/{sessionId}`
- `DELETE /api/v1/events/{id}/sessions/{sessionId}`
- `GET /api/v1/events/{id}/agenda`
- `PUT /api/v1/events/{id}/agenda/reorder`
- `POST /api/v1/events/uploads/banner-image`
- `POST /api/v1/events/uploads/speaker-photo`

### Internal routes

- `GET /api/v1/internal/events/{id}/booking-owner`
- `POST /api/v1/events/internal/venue-bookings/{bookingId}/cancelled`

## Notes

- The service expects JWTs issued by `auth-service`.
- Prometheus metrics are exposed through Spring Actuator.
- Kafka producer failures are non-fatal to startup.
- Upload routes depend on storage configuration being enabled and valid.

## Tests

Run the test suite with:

```bash
./mvnw test
```
