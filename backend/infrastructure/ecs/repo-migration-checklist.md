# EventZen Repo-Specific ECS Migration Checklist

This checklist turns the ECS migration guides in this folder into concrete repository work items for EventZen.

## 1. Confirm Production Deployment Boundary

- Deploy only these seven app containers to ECS:
- `frontend`
- `auth-service`
- `event-service`
- `venue-vendor-service`
- `ticketing-service`
- `finance-service`
- `notification-service`

- Keep these as local-only or separately managed dependencies, not ECS app services:
- `nginx`
- `mysql`
- `mongodb`
- `redis`
- `kafka`
- `zookeeper`
- `minio`
- `minio-init`
- `kafka-ui`
- `prometheus`
- `loki`
- `promtail`
- `tempo`
- `otel-collector`
- `grafana`

## 2. Finalize Internal Service Discovery

- Standardize one internal naming convention for ECS service-to-service traffic.
- Recommended convention for this repo:
- `http://notification-service.__SERVICE_DISCOVERY_NAMESPACE__:8086`
- `http://event-service.__SERVICE_DISCOVERY_NAMESPACE__:8082`
- `http://ticketing-service.__SERVICE_DISCOVERY_NAMESPACE__:8084`
- `http://venue-vendor-service.__SERVICE_DISCOVERY_NAMESPACE__:8083`

- Fill the ECS task definition placeholders with the real Cloud Map or Service Connect names during deployment.
- Do not keep Docker Compose hostnames in ECS task definitions.

## 3. Replace Local Infrastructure Endpoints

- Replace `mysql` Compose JDBC hosts with RDS JDBC URLs for:
- `auth-service`
- `event-service`
- `finance-service`

- Replace Mongo Compose endpoints with managed Mongo-compatible endpoints for:
- `venue-vendor-service`
- `ticketing-service`
- `notification-service`

- Replace `redis://redis:6379` with the ElastiCache Redis endpoint for `notification-service`.
- Replace `kafka:29092` with the MSK broker string for `notification-service`.
- Replace `http://minio:9000` with the chosen S3-compatible endpoint for:
- `event-service`
- `ticketing-service`
- `finance-service`

- Provision buckets outside the app startup path. Do not carry `minio-init` into ECS production.

## 4. Move Runtime Secrets to AWS Secrets Manager

- Use [secrets-manager-mapping.md](/c:/Users/mayuk/OneDrive/Desktop/Document_Folders_in_Desktop/Deloitte_Capstone_Project/backend/infrastructure/ecs/secrets-manager-mapping.md) as the key-level source of truth.
- Keep backend secrets in ECS task definition `secrets`, not `.env.prod`.
- Keep only public frontend `VITE_*` values outside Secrets Manager.

## 5. Move Public Routing from Nginx to ALB

- Keep [nginx.generated.conf](/c:/Users/mayuk/OneDrive/Desktop/Document_Folders_in_Desktop/Deloitte_Capstone_Project/nginx/nginx.generated.conf) only as the route ownership reference for local Docker behavior.
- Create ALB listener rules that mirror the existing route ownership:
- `/` and SPA fallback -> `frontend`
- `/api/v1/auth*`, `/api/v1/account-requests*`, `/api/v1/users*`, `/actuator/*` -> `auth-service`
- `/api/v1/events*`, `/api/v1/categories*` -> `event-service`
- `/api/v1/venues*`, `/api/v1/vendors*`, `/api/v1/contracts*` -> `venue-vendor-service`
- `/api/v1/tickets*`, `/api/v1/checkin*`, `/api/v1/attendees*`, `/api/v1/registrations*`, event-scoped ticketing routes -> `ticketing-service`
- `/api/v1/payments*`, `/api/v1/expenses*`, `/api/v1/budgets*`, finance event report routes -> `finance-service`
- `/api/v1/notifications*`, `/socket.io/*` -> `notification-service`

## 6. Keep Frontend Config Public and ALB-Compatible

- Keep frontend `VITE_*` values as build-time configuration.
- Build the frontend so the public URLs resolve through ALB path routing.
- Do not rely on a separate production Nginx reverse proxy in front of the frontend container.

## 7. Treat Compose as Reference, Not Production Source of Truth

- Keep `docker-compose.prod.yml` for local/reference use.
- Do not copy `depends_on`, Docker DNS names, or local infra hostnames into ECS production values.
- Treat these as the ECS production source of truth:
- `backend/infrastructure/ecs/task-definitions/`
- ALB listener rules
- AWS Secrets Manager entries
- CI/CD deployment metadata

## 8. Deployment Order

Deploy in this order after infrastructure, secrets, and target groups exist:

1. `notification-service`
2. `auth-service`
3. `venue-vendor-service`
4. `event-service`
5. `ticketing-service`
6. `finance-service`
7. `frontend`
