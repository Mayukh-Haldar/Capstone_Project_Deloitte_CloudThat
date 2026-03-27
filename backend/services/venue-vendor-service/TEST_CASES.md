# Venue & Vendor Service Test Cases

This document lists all automated tests currently implemented for `venue-vendor-service`.

## Test Layers

- Unit tests
- Integration tests (Express app + MongoDB in-memory + JWT middleware)
- System tests via Postman + Newman (against running services)

## Prerequisites

For unit and integration tests:
- Node.js 20+
- `npm.cmd install` executed in this service folder

For system tests:
- `auth-service` running on `http://localhost:8081`
- `venue-vendor-service` running on `http://localhost:8083`
- Admin credentials valid in auth-service:
  - `admin@eventzen.local`
  - `replace-with-test-admin-password`

## Run Commands

```bash
npm run test:unit
npm run test:integration
npm test
npm run test:system:postman
npm run test:system:postman:negative
```

## Unit Test Cases

File: `tests/unit/auth.middleware.test.js`

1. `normalizeRole` strips `ROLE_` and uppercases role name.
2. `extractRoles` reads roles from `authorities` claim.
3. JWT shape compatibility check with auth-service claim style:
   - `type=access`
   - `uid=<uuid>`
   - `authorities=[ROLE_*]`
   - expected issuer validation

File: `tests/unit/contract.service.test.js`

4. Valid contract status transitions:
   - `PENDING -> SIGNED`
   - `SIGNED -> ACTIVE`
   - `ACTIVE -> COMPLETED`
5. Invalid contract transitions are rejected:
   - `PENDING -> ACTIVE`
   - `SIGNED -> COMPLETED`
   - `COMPLETED -> ACTIVE`

## Integration Test Cases

File: `tests/integration/venue-vendor.integration.test.js`

Positive-path:

1. ADMIN can create venue.
2. ORGANIZER cannot create venue (RBAC enforcement).
3. Overlapping venue booking is detected and blocked.
4. Vendor can be hired for event and contract can move through valid states.
5. Vendor review submission updates aggregate rating and review count.

Negative-path:

6. Missing bearer token returns `401` with `VV-1002`.
7. Token with invalid issuer returns `401` with `VV-1002`.
8. ORGANIZER calling ADMIN-only vendor creation returns `403` with `VV-1003`.
9. Duplicate vendor email returns `409` with `VV-1005`.
10. Duplicate review by same reviewer for same event returns `409` with `VV-1005`.

## Smoke Test Cases

File: `tests/app.test.js`

1. `GET /api/v1/health` returns UP.
2. Unknown route returns EventZen error payload shape (`NOT_FOUND`, `traceId`, etc.).

## System Test Cases (Postman/Newman)

Positive collection:
- File: `postman/VenueVendorSystemTests.postman_collection.json`
- Command: `npm run test:system:postman`

Cases:

1. Login via auth-service and capture JWT access token.
2. Health check.
3. Create venue.
4. Check availability.
5. Book venue.
6. Create vendor.
7. List vendors with filter.
8. Hire vendor for event.
9. Contract status change to `SIGNED`.
10. Contract status change to `ACTIVE`.
11. Contract status change to `COMPLETED`.
12. Submit vendor review.

Negative collection:
- File: `postman/VenueVendorNegativeSystemTests.postman_collection.json`
- Command: `npm run test:system:postman:negative`

Cases:

1. Missing auth header returns `401`.
2. Invalid JWT returns `401`.
3. Refresh token used as bearer token returns `401`.
4. Validation error on invalid venue payload returns `400`.
5. Duplicate vendor email returns `409`.
6. Duplicate review for same reviewer/event returns `409`.

## JWT/Auth-Service Alignment Coverage

The test suite validates compatibility with auth-service token conventions:

- Shared secret and issuer verification
- Access token acceptance (`type=access`)
- Refresh token rejection for protected APIs
- `uid` claim usage for actor identity
- `authorities` claim mapping (`ROLE_ADMIN`, `ROLE_ORGANIZER`, etc.)
