# EventZen Compose to ECS Mapping Guide

This guide maps the current `docker-compose.prod.yml` structure to the ECS deployment model used in the AWS migration plan.

## Deployable Services

| Current Compose Service | ECS Status | ECS Target | Notes |
| --- | --- | --- | --- |
| `frontend` | Keep | ECS service + ALB target group | Public web app, default ALB route |
| `auth-service` | Keep | ECS service + ALB target group | Spring Boot service on `8081` |
| `event-service` | Keep | ECS service + ALB target group | Spring Boot service on `8082` |
| `venue-vendor-service` | Keep | ECS service + ALB target group | Node service on `8083` |
| `ticketing-service` | Keep | ECS service + ALB target group | ASP.NET Core service on `8084` |
| `finance-service` | Keep | ECS service + ALB target group | Spring Boot service on `8085` |
| `notification-service` | Keep | ECS service + ALB target group | Node service on `8086` |
| `nginx` | Remove from ECS plan | ALB listener rules | ALB replaces Nginx routing |

## Non-App Compose Services

| Current Compose Service | ECS Plan | Replacement |
| --- | --- | --- |
| `mysql` | Do not deploy as ECS app service | Amazon RDS MySQL endpoint |
| `mongodb` | Do not deploy as ECS app service | DocumentDB or external Mongo-compatible endpoint |
| `redis` | Do not deploy as ECS app service | ElastiCache Redis endpoint |
| `zookeeper` | Do not deploy | Managed Kafka dependency or omit if Kafka architecture changes |
| `kafka` | Do not deploy as ECS app service | Amazon MSK or another reachable Kafka cluster |
| `minio` | Do not deploy as ECS app service | Amazon S3 or S3-compatible storage |
| `minio-init` | Remove | Bucket provisioning handled outside app startup |
| `kafka-ui` | Remove from prod app deployment | Optional admin-only tool, not part of app plane |
| `prometheus` | Remove from current ECS migration scope | Separate observability stack if needed later |
| `loki` | Remove from current ECS migration scope | Separate observability stack if needed later |
| `promtail` | Remove from current ECS migration scope | Separate observability stack if needed later |
| `tempo` | Remove from current ECS migration scope | Separate observability stack if needed later |
| `otel-collector` | Optional later | Separate observability deployment if needed |
| `grafana` | Remove from current ECS migration scope | Separate observability deployment if needed |

## Route Ownership Mapping

Current public routing is implemented in [nginx/nginx.generated.conf](../../../nginx/nginx.generated.conf). For ECS, copy that ownership into ALB listener rules.

| Current Route Owner | Route Patterns | ECS / ALB Destination |
| --- | --- | --- |
| `frontend` | `/` and all SPA fallthrough paths | `eventzen-frontend-tg` |
| `auth-service` | `/api/v1/auth*`, `/api/v1/account-requests*`, `/api/v1/users*`, `/actuator/*` | `eventzen-auth-tg` |
| `event-service` | `/api/v1/events*`, `/api/v1/categories*` | `eventzen-event-tg` |
| `venue-vendor-service` | `/api/v1/venues*`, `/api/v1/vendors*`, `/api/v1/contracts*` | `eventzen-venue-tg` |
| `ticketing-service` | `/api/v1/tickets*`, `/api/v1/checkin*`, `/api/v1/attendees*`, `/api/v1/registrations*`, event-scoped ticketing routes | `eventzen-ticketing-tg` |
| `finance-service` | `/api/v1/payments*`, `/api/v1/expenses*`, `/api/v1/budgets*`, finance event report routes | `eventzen-finance-tg` |
| `notification-service` | `/api/v1/notifications*`, `/socket.io/*` | `eventzen-notification-tg` |

## Service-to-Service URL Mapping

The current task definition templates still assume Compose DNS names. Replace them with ECS service discovery names or another explicit internal routing convention.

Recommended convention:

- `http://notification-service.<namespace>:8086`
- `http://event-service.<namespace>:8082`
- `http://ticketing-service.<namespace>:8084`
- `http://venue-vendor-service.<namespace>:8083`

If using ECS Service Connect or Cloud Map, substitute the real namespace at deploy time. In this repo's task definition templates, these values should now be supplied through deployment-time placeholders rather than hardcoded Compose hostnames.

| Consumer | Current Compose Value | ECS Replacement Type |
| --- | --- | --- |
| `auth-service` | `http://notification-service:8086` | internal service discovery URL |
| `event-service` | `http://venue-vendor-service:8083` | internal service discovery URL |
| `ticketing-service` | `http://event-service:8082` | internal service discovery URL |
| `ticketing-service` | `http://notification-service:8086` | internal service discovery URL |
| `finance-service` | `http://notification-service:8086` | internal service discovery URL |
| `finance-service` | `http://ticketing-service:8084` | internal service discovery URL |
| `venue-vendor-service` | `http://notification-service:8086` | internal service discovery URL |

## Stateful Dependency Mapping

| App | Current Compose Dependency | Current Compose Value | ECS / AWS Replacement |
| --- | --- | --- | --- |
| `auth-service` | MySQL | `jdbc:mysql://mysql:3306/eventzen_users...` | RDS MySQL JDBC URL |
| `event-service` | MySQL | `jdbc:mysql://mysql:3306/eventzen_events...` | RDS MySQL JDBC URL |
| `finance-service` | MySQL | `jdbc:mysql://mysql:3306/eventzen_finance...` | RDS MySQL JDBC URL |
| `venue-vendor-service` | MongoDB | `mongodb://mongodb:27017/eventzen_venue_vendor` | DocumentDB or Mongo endpoint |
| `notification-service` | MongoDB | `mongodb://mongodb:27017/eventzen_notifications` | DocumentDB or Mongo endpoint |
| `ticketing-service` | MongoDB | `mongodb://mongodb:27017` | DocumentDB or Mongo endpoint |
| `notification-service` | Redis | `redis://redis:6379` | ElastiCache Redis endpoint |
| `notification-service` | Kafka | `kafka:29092` | MSK broker string |
| `event-service` | MinIO | `http://minio:9000` | S3 or compatible storage endpoint |
| `ticketing-service` | MinIO | `http://minio:9000` | S3 or compatible storage endpoint |
| `finance-service` | MinIO | `http://minio:9000` | S3 or compatible storage endpoint |

## Environment and Secret Handling

| Type | Keep in ECS `environment` | Move to Secrets Manager |
| --- | --- | --- |
| Public/frontend values | `VITE_*` build-time values | none |
| Non-secret service wiring | internal service URLs, health config, CORS origins, feature flags | none |
| Backend secrets | none | DB usernames and passwords, JWT secrets, SMTP creds, Firebase private key, Razorpay keys, storage secrets, internal service keys |

Use [secrets-manager-mapping.md](./secrets-manager-mapping.md) for exact key names.

## Compose Features That Do Not Carry Over Directly

| Compose Feature | Current Usage | ECS Equivalent |
| --- | --- | --- |
| `depends_on` | service startup ordering | deploy order, ECS health checks, app retries |
| Compose DNS | service names like `notification-service` | Cloud Map / Service Connect / explicit URLs |
| local bind volumes | Nginx config, database init scripts, monitoring config | bake into images or replace with AWS-native services |
| container restarts | `restart: unless-stopped` | ECS service desired count and task replacement |
| reverse proxy in container | `nginx` service | ALB listener rules + target groups |

## Current Task Definition Readiness

Existing task definitions in `task-definitions/` are a good base, but they still need:

- real image URIs
- real IAM role ARNs
- real AWS region values
- real Secrets Manager ARNs
- internal service discovery URL placeholders filled in with ECS-ready names
- AWS-managed infra endpoints substituted for Compose endpoints

## Recommended Migration Sequence

1. Keep local Compose for developer use.
2. Stop expanding production around the Nginx container.
3. Finalize managed AWS replacements for DB, cache, queue, and storage.
4. Fill task definition placeholders with AWS values.
5. Create ALB rules from the route ownership table above.
6. Deploy backend services one by one.
7. Deploy frontend last after API routes are healthy.
