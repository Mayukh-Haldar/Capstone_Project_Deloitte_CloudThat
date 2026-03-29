# Ticketing Service

ASP.NET Core 10 ticketing microservice for EventZen.

## Scope

- Event ticket tier management
- Attendee registration with idempotency key support
- Waitlist join and auto-promotion on cancellation
- Signed ticket payload generation for wallet/check-in flows
- Real-time check-in validation and event stats
- CSV attendee import for admin workflows

## Tech Stack

- ASP.NET Core 10
- MongoDB
- JWT validation compatible with `auth-service`
- HTTP integration with `event-service`

## Default URLs

- Service: `http://localhost:8084`
- Health: `GET /api/v1/health`

## Configuration

Environment variables supported through `appsettings.json` overrides:

- `Mongo__ConnectionString`
- `Mongo__DatabaseName`
- `Jwt__Secret`
- `Jwt__Issuer`
- `EventService__BaseUrl`
- `Cors__AllowedOrigins__0`

Recommended local values:

```powershell
$env:Mongo__ConnectionString="mongodb://localhost:27017"
$env:Mongo__DatabaseName="eventzen_ticketing"
$env:Jwt__Secret="<set-via-local-secret-store>"
$env:Jwt__Issuer="eventzen-auth-service"
$env:EventService__BaseUrl="http://localhost:8082"
```

## Run

```powershell
dotnet run --project .\src\EventZen.Ticketing.Api
```

## Key Endpoints

- `GET /api/v1/ticket-types?eventId=<eventId>`
- `POST /api/v1/events/{eventId}/ticket-types`
- `POST /api/v1/registrations`
- `GET /api/v1/registrations/me`
- `GET /api/v1/events/{eventId}/registrations`
- `DELETE /api/v1/registrations/{registrationId}`
- `GET /api/v1/tickets/{ticketId}`
- `GET /api/v1/tickets/me`
- `POST /api/v1/checkin/scan`
- `GET /api/v1/events/{eventId}/checkin/stats`
- `POST /api/v1/events/{eventId}/waitlist`
- `POST /api/v1/attendees/import`

## Notes

- JWT parsing expects the same `uid`, `sub`, `type`, and `authorities` claims currently emitted by `auth-service`.
- Ticket visuals are emitted as signed SVG wallet passes, and the service validates the signed `qrPayload` during check-in.
- The frontend now consumes the new service from event details, registrations, tickets, and check-in pages.
