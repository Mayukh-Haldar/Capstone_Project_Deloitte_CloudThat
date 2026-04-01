# Venue & Vendor Service

Node.js service for venue, booking, vendor, and contract management.

- Base URL: `http://localhost:8083`
- API prefix: `/api/v1`
- OpenAPI JSON: `/openapi.json`
- Health: `/api/v1/health`
- Metrics: `/metrics`

## What it handles

- Venue CRUD
- Hall and amenities data
- Availability checks
- Venue booking create, confirm, cancel, and delete flows
- Vendor catalog and vendor creation
- Event-vendor assignment
- Vendor contracts
- Vendor reviews

## Run locally

Copy `.env.example` to `.env`, update the values you need, then run:

```bash
npm install
npm run dev
```

Use `npm start` for a normal non-watch run.

## Important configuration

Common local variables from `.env.example`:

```env
PORT=8083
MONGO_URI=mongodb://localhost:27017/eventzen_venue_vendor
AUTH_JWT_SECRET=replace-with-auth-jwt-secret
AUTH_JWT_ISSUER=eventzen-auth-service
NOTIFICATION_SERVICE_BASE_URL=http://localhost:8086
NOTIFICATION_INTERNAL_SERVICE_KEY=replace-with-internal-service-key
CORS_ORIGIN=*
ENABLE_REQUEST_LOGS=true
```

The service also reads:

- `EVENT_SERVICE_BASE_URL`
- `VENUE_VENDOR_INTERNAL_SERVICE_KEY`

## Main routes

### Venues and bookings

- `POST /api/v1/venues`
- `GET /api/v1/venues`
- `GET /api/v1/venues/{id}`
- `PUT /api/v1/venues/{id}`
- `DELETE /api/v1/venues/{id}`
- `GET /api/v1/venues/{id}/availability`
- `POST /api/v1/venues/{id}/book`
- `POST /api/v1/venues/internal/bookings/{bookingId}/confirm-payment`
- `POST /api/v1/venues/{id}/bookings/{bookingId}/cancel`
- `DELETE /api/v1/venues/{id}/bookings/{bookingId}`

### Vendors and contracts

- `GET /api/v1/vendors`
- `POST /api/v1/vendors`
- `GET /api/v1/vendors/{id}`
- `POST /api/v1/vendors/{id}/reviews`
- `POST /api/v1/events/{id}/vendors`
- `PATCH /api/v1/contracts/{id}/status`

### Service route

- `GET /api/v1/health`

## Auth notes

- The service verifies bearer JWTs using `AUTH_JWT_SECRET` and `AUTH_JWT_ISSUER`.
- Expected roles come from the `authorities` claim produced by `auth-service`.
- In development, you can bypass token checks with `x-user-id` and `x-user-roles`.

## Tests

Main test suite:

```bash
npm test
```

Useful subsets:

```bash
npm run test:unit
npm run test:integration
npm run test:system:postman
npm run test:system:postman:negative
```
