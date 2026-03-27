# EventZen ECS Service Creation Mapping

This document lists the exact ECS services to create for the EventZen production deployment.

## ECS Services To Create

| ECS Service Name | Container Name | Task Definition Template | Container Port | Public Through ALB |
| --- | --- | --- | --- | --- |
| `eventzen-frontend` | `frontend` | `task-definitions/frontend-task-definition.json` | `80` | Yes |
| `eventzen-auth-service` | `auth-service` | `task-definitions/auth-service-task-definition.json` | `8081` | Yes |
| `eventzen-event-service` | `event-service` | `task-definitions/event-service-task-definition.json` | `8082` | Yes |
| `eventzen-venue-vendor-service` | `venue-vendor-service` | `task-definitions/venue-vendor-service-task-definition.json` | `8083` | Yes |
| `eventzen-ticketing-service` | `ticketing-service` | `task-definitions/ticketing-service-task-definition.json` | `8084` | Yes |
| `eventzen-finance-service` | `finance-service` | `task-definitions/finance-service-task-definition.json` | `8085` | Yes |
| `eventzen-notification-service` | `notification-service` | `task-definitions/notification-service-task-definition.json` | `8086` | Yes |

## Notes

- Create one ECS service per deployable application container.
- Keep the container ports exactly as defined in the task definitions.
- Fill all deployment-time placeholders before registering the task definitions.
- For internal service-to-service URLs, use ECS Service Connect or Cloud Map naming, not Docker Compose hostnames.

## Recommended Deployment Order

1. `eventzen-notification-service`
2. `eventzen-auth-service`
3. `eventzen-venue-vendor-service`
4. `eventzen-event-service`
5. `eventzen-ticketing-service`
6. `eventzen-finance-service`
7. `eventzen-frontend`
