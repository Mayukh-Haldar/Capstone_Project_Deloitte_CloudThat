# Ticketing Service

ASP.NET Core ticketing service for EventZen.

- Base URL: `http://localhost:8084`
- API prefix: `/api/v1`
- OpenAPI JSON: `/openapi/v1.json`
- Health: `/api/v1/health`
- Metrics: `/metrics`
- SignalR hub: `/seat-hub`

## What it handles

- Ticket type management
- Registrations and waitlist flow
- Seat map reservation and release
- Payment confirmation handoff
- Ticket retrieval and ticket-pass generation
- QR check-in and check-in stats
- CSV attendee import

## Run locally

Copy `.env.example` to `.env`, update the values you need, then run:

```powershell
dotnet run --project .\src\EventZen.Ticketing.Api
```

Default port is `8084`.

## Important configuration

The service reads `appsettings.json`, `.env`, and environment variables. Common local values from `.env.example`:

```env
Urls=http://localhost:8084
Mongo__ConnectionString=mongodb://localhost:27017
Mongo__DatabaseName=eventzen_ticketing
Jwt__Secret=replace-with-auth-jwt-secret
Jwt__Issuer=eventzen-auth-service
EventService__BaseUrl=http://localhost:8082
NotificationService__BaseUrl=http://localhost:8086
NotificationService__InternalServiceKey=replace-with-internal-service-key
Cors__AllowedOrigins__0=http://localhost:5173
```

Storage-backed ticket passes use:

```env
Storage__Enabled=false
Storage__Endpoint=
Storage__AccessKey=
Storage__SecretKey=
Storage__Bucket=eventzen-media
Storage__PublicBaseUrl=
Storage__TicketPassesPrefix=ticket-passes
```

In development, the service can also read `AUTH_JWT_SECRET` from a nearby auth `.env` file as a fallback when `Jwt__Secret` is not set directly.

## Main routes

### Ticket types and seat maps

- `GET /api/v1/ticket-types?eventId={eventId}`
- `POST /api/v1/events/{eventId}/ticket-types`
- `PUT /api/v1/events/{eventId}/ticket-types/{ticketTypeId}`
- `DELETE /api/v1/events/{eventId}/ticket-types/{ticketTypeId}`
- `GET /api/v1/ticket-types/{ticketTypeId}/seat-map`
- `POST /api/v1/ticket-types/{ticketTypeId}/seats/reserve`
- `DELETE /api/v1/ticket-types/{ticketTypeId}/seats/reserve/{reservationId}`

### Registrations and tickets

- `POST /api/v1/registrations`
- `GET /api/v1/registrations/me`
- `GET /api/v1/registrations/{registrationId}/ticket-pass`
- `GET /api/v1/events/{eventId}/registrations`
- `DELETE /api/v1/registrations/{registrationId}`
- `POST /api/v1/internal/registrations/{registrationId}/confirm-payment`
- `POST /api/v1/events/{eventId}/waitlist`
- `GET /api/v1/tickets/{ticketId}`
- `GET /api/v1/tickets/me`

### Check-in and attendees

- `POST /api/v1/checkin/scan`
- `GET /api/v1/events/{eventId}/checkin/stats`
- `POST /api/v1/attendees/import`
- `GET /api/v1/health`

## Notes

- The service expects JWTs compatible with `auth-service`.
- `Idempotency-Key` is supported on registration flows.
- Real-time seat updates are exposed through SignalR at `/seat-hub`.
- Ticket pass storage is optional and controlled through the `Storage__*` settings.

## Tests

Run the .NET test project with:

```powershell
dotnet test .\tests\EventZen.Ticketing.Tests\EventZen.Ticketing.Tests.csproj
```

There is also a Postman collection under `tests/postman/`.
