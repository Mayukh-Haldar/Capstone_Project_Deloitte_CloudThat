# Event Service

Spring Boot 4 + JDK 21 event lifecycle service for EventZen.

## Features

- Event CRUD with status transitions
- Agenda ordering and session scheduling
- JWT auth compatible with the existing auth service
- Venue availability and booking integration with `venue-vendor-service`
- MySQL for runtime, H2 for tests

## Run

```bash
./mvnw spring-boot:run
```

Defaults:

- Port: `8082`
- DB: `eventzen_events`
- Venue vendor base URL: `http://localhost:8083`

## Key Endpoints

- `GET /api/v1/categories`
- `GET /api/v1/events`
- `GET /api/v1/events/{id}`
- `POST /api/v1/events`
- `PUT /api/v1/events/{id}`
- `PATCH /api/v1/events/{id}/status`
- `DELETE /api/v1/events/{id}`
- `POST /api/v1/events/{id}/sessions`
- `GET /api/v1/events/{id}/agenda`
- `PUT /api/v1/events/{id}/agenda/reorder`
- `GET /api/v1/events/search?q=ai`
