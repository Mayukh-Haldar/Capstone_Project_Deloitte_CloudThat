# EventZen ECS Target Group Mapping

This document lists the exact ALB target groups and route ownership for the EventZen ECS deployment.

## Target Groups To Create

| Target Group Name | ECS Service | Container Port | Route Patterns |
| --- | --- | --- | --- |
| `eventzen-frontend-tg` | `eventzen-frontend` | `80` | `/` and SPA fallback paths |
| `eventzen-auth-tg` | `eventzen-auth-service` | `8081` | `/api/v1/auth*`, `/api/v1/account-requests*`, `/api/v1/users*`, `/actuator/*` |
| `eventzen-event-tg` | `eventzen-event-service` | `8082` | `/api/v1/events*`, `/api/v1/categories*` |
| `eventzen-venue-tg` | `eventzen-venue-vendor-service` | `8083` | `/api/v1/venues*`, `/api/v1/vendors*`, `/api/v1/contracts*` |
| `eventzen-ticketing-tg` | `eventzen-ticketing-service` | `8084` | `/api/v1/tickets*`, `/api/v1/checkin*`, `/api/v1/attendees*`, `/api/v1/registrations*`, `/api/v1/events/{id}/ticket-types*`, `/api/v1/events/{id}/registrations*`, `/api/v1/events/{id}/checkin/stats*`, `/api/v1/events/{id}/waitlist*` |
| `eventzen-finance-tg` | `eventzen-finance-service` | `8085` | `/api/v1/payments*`, `/api/v1/expenses*`, `/api/v1/budgets*`, `/api/v1/events/{id}/budget*`, `/api/v1/events/{id}/reports/financial*` |
| `eventzen-notification-tg` | `eventzen-notification-service` | `8086` | `/api/v1/notifications*`, `/socket.io/*` |

## Notes

- The ALB replaces the old production Nginx routing layer.
- The frontend target group should be the default listener action for `/`.
- API route ownership should mirror the route ownership currently defined in `nginx/nginx.generated.conf`.
- WebSocket traffic for `/socket.io/*` should be routed to `eventzen-notification-tg`.
