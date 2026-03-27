# Ticketing Service Test Cases

## Coverage

- Unit tests for JWT compatibility and ticketing workflows
- Frontend integration verification through production build
- Postman collection for manual/system validation

## Automated Tests

Project: `tests/EventZen.Ticketing.Tests`

### Unit Cases

1. `JwtTokenService` parses auth-service compatible `ROLE_*` claims and `uid`.
2. Registration creates attendee, ticket, and registration while decrementing inventory.
3. Duplicate registration for the same user and event is rejected with `TKT-3002`.
4. Canceling a registration promotes the next waitlisted attendee when capacity becomes available.
5. Duplicate check-in scan is rejected with `TKT-3012`.

## Manual / System Cases

1. Admin or organizer creates ticket tiers for an existing event.
2. Attendee registers using `POST /api/v1/registrations` with `Idempotency-Key`.
3. Attendee can see the ticket in `/my/tickets` and the registration in `/my/registrations`.
4. Sold-out tier sends a user to the waitlist path.
5. Canceling a registration increments inventory and can promote waitlist entry.
6. Staff/admin checks in attendee with `POST /api/v1/checkin/scan`.
7. Organizer/admin reads live check-in stats for the event.
8. Admin uploads a CSV attendee file and sees import counts + row errors.

## Suggested Commands

```powershell
dotnet test .\tests\EventZen.Ticketing.Tests
dotnet build .\src\EventZen.Ticketing.Api
```

## Frontend Verification

```powershell
cd frontend
npm.cmd run build
```
