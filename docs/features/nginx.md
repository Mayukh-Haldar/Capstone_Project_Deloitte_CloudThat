[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🌐 Nginx Reverse Proxy

**Role:** API Gateway, Rate Limiting & Static Docs Aggregation  
**Image:** `nginx:1.27-alpine`  
**Category:** Advanced Infrastructure

---

## Overview

**Nginx** serves as the single entry point for all traffic into the EventZen platform. It acts as a reverse proxy routing requests to the correct microservice, enforces rate limiting to protect services from abuse, and hosts the aggregated OpenAPI/Swagger documentation hub - all from a single container.

---

## Routing Table

| Path Prefix | Upstream Service | Port |
|------------|----------------|------|
| `/api/v1/auth/**` | Auth Service | 8081 |
| `/api/v1/events/**` | Event Service | 8082 |
| `/api/v1/venues/**` | Venue-Vendor Service | 8083 |
| `/api/v1/vendors/**` | Venue-Vendor Service | 8083 |
| `/api/v1/tickets/**` | Ticketing Service | 8084 |
| `/api/v1/finance/**` | Finance Service | 8085 |
| `/api/v1/notifications/**` | Notification Service | 8086 |
| `/docs/**` | Static files (OpenAPI specs + Swagger UI) | - |
| `/**` | React SPA (index.html) | - |

---

## Rate Limiting

Nginx's `limit_req_zone` and `limit_req` directives enforce per-IP rate limits:

- **Auth endpoints** - stricter limits to prevent brute-force and credential stuffing
- **API endpoints** - per-IP burst and sustained rate limits
- **Static assets** - unlimited (served from Nginx directly, no upstream cost)

---

## OpenAPI Docs Aggregation

- Static path: `backend/docker/nginx/static/docs/`
- Each service writes its OpenAPI spec to `docs/specs/<service-name>.json` (via the `scripts/refresh-swagger-specs.ps1` script)
- `docs/index.html` renders the Swagger UI hub with a dropdown to switch between all 6 service specs
- Served at `http://localhost/docs/`

---

## Configuration Files

| File | Purpose |
|------|---------|
| `backend/docker/nginx/nginx.conf` | Main Nginx config - upstreams, routing, rate limits |
| `backend/docker/nginx/static/docs/index.html` | Swagger UI aggregation hub |
| `backend/docker/nginx/static/docs/specs/` | Per-service OpenAPI JSON specs |
| `infrastructure/render-nginx-prod.sh` | Renders production Nginx config with real hostnames |
