# General Environment Variable Reference

[Back to README section](../../README.md#env-file-example-and-prerequisites-for-hashi-corp-vault) | [Back to env overview](./OVERVIEW.md)

This file explains the variables in `.env.example` that are not primarily about third-party account setup.

## Frontend and public URLs

| Variable | Purpose |
|---|---|
| `APP_ROOT` | Absolute path to the repository on the local machine |
| `FRONTEND_ORIGIN` | Public frontend origin used by browser-facing flows |
| `AUTH_APP_BASE_URL` | Base URL used by auth flows such as email links |
| `VITE_SITE_URL` | Frontend app URL exposed to the Vite application |
| `VITE_*_SERVICE_URL` | Per-service base URLs consumed by the frontend |

For local proxy-based setups, these service URLs may point to `/` or to Nginx-managed paths. For deployed environments, use full service URLs.

## Nginx rate limiting

| Variable | Purpose |
|---|---|
| `AUTH_RATE_LIMIT_RPS` | Requests per second allowed for auth routes |
| `AUTH_RATE_LIMIT_BURST` | Temporary auth burst size |
| `API_RATE_LIMIT_RPS` | Requests per second allowed for general API routes |
| `API_RATE_LIMIT_BURST` | Temporary general API burst size |

## Ports

The port variables let the local scripts and Docker Compose files bind services without hard-coding every host port. Examples:

- `FRONTEND_PORT`
- `NGINX_PORT`
- `MYSQL_PORT`
- `MONGODB_PORT`
- `REDIS_PORT`
- `KAFKA_PORT`
- `KAFKA_UI_PORT`
- `PROMETHEUS_PORT`
- `GRAFANA_HOST_PORT`

If you have port conflicts on your machine, adjust the host-side values before starting the stack.

## Autoscaler settings

| Variable pattern | Purpose |
|---|---|
| `AUTOSCALER_*` | Global autoscaler enablement, interval, cooldown, and thresholds |
| `*_SERVICE_MIN_REPLICAS` | Minimum number of replicas for that service |
| `*_SERVICE_MAX_REPLICAS` | Maximum number of replicas for that service |

## Shared auth and service-to-service security

| Variable | Purpose |
|---|---|
| `AUTH_JWT_SECRET` | JWT signing secret |
| `AUTH_JWT_ISSUER` | JWT issuer string |
| `AUTH_CRYPTO_SECRET` | Encryption secret for sensitive field handling |
| `NOTIFICATION_INTERNAL_SERVICE_KEY` | Internal auth key for notification-service calls |
| `TICKETING_INTERNAL_SERVICE_KEY` | Internal auth key for ticketing-service calls |
| `VENUE_VENDOR_INTERNAL_SERVICE_KEY` | Internal auth key for venue-vendor-service calls if enabled by the current script set |

Treat all of these as secrets and import them into the local Vault-backed secret store.

## MySQL variables

| Variable | Purpose |
|---|---|
| `MYSQL_ROOT_PASSWORD` | Root password for local MySQL |
| `AUTH_DB_USERNAME` / `AUTH_DB_PASSWORD` | Auth-service database credentials |
| `EVENT_DB_USERNAME` / `EVENT_DB_PASSWORD` | Event-service database credentials |
| `FINANCE_DB_USERNAME` / `FINANCE_DB_PASSWORD` | Finance-service database credentials |

## Auth bootstrap admin

| Variable | Purpose |
|---|---|
| `AUTH_BOOTSTRAP_ADMIN_EMAIL` | Seed admin email for the initial platform admin |
| `AUTH_BOOTSTRAP_ADMIN_PASSWORD` | Seed admin password |
| `AUTH_BOOTSTRAP_ADMIN_FIRST_NAME` | Seed admin first name |
| `AUTH_BOOTSTRAP_ADMIN_LAST_NAME` | Seed admin last name |

## Feature flags and retention

| Variable | Purpose |
|---|---|
| `AUTH_REQUIRE_VERIFIED_EMAIL_FOR_LOGIN` | Enforce verified-email login requirement |
| `AUTH_EXPOSE_DEBUG_TOKENS` | Auth debugging helper toggle |
| `AUTH_ALLOW_DEBUG_GOOGLE_TOKENS` | Debug Google token acceptance toggle |
| `EVENT_STORAGE_ENABLED` | Event-service object-storage toggle |
| `ENABLE_REQUEST_LOGS` | Notification-service request logging |
| `ENABLE_KAFKA` | Notification-service Kafka consumer toggle |
| `ENABLE_BULLMQ` | Queue worker toggle |
| `ENABLE_SOCKET_IO` | Real-time notification toggle |
| `SEED_DEFAULT_TEMPLATES` | Seed initial notification templates |
| `DEFAULT_NOTIFICATION_LOCALE` | Default locale for notification rendering |
| `NOTIFICATION_RETENTION_DAYS` | Retention window for notification data |

## Kafka variables

| Variable | Purpose |
|---|---|
| `KAFKA_EXTERNAL_HOST` | Host name used for Kafka access outside containers |
| `KAFKA_CLIENT_ID` | Notification-service Kafka client ID |
| `KAFKA_CONSUMER_GROUP` | Notification-service consumer group |
| `KAFKA_TOPICS` | Comma-separated topic list consumed by notification-service |

## MinIO and object storage

| Variable | Purpose |
|---|---|
| `MINIO_ROOT_USER` | MinIO admin username |
| `MINIO_ROOT_PASSWORD` | MinIO admin password |
| `MINIO_BUCKET` | Default object bucket |
| `MINIO_PUBLIC_BASE_URL` | Public base URL for served assets |
| `MINIO_EVENT_BANNERS_PREFIX` | Banner object prefix |
| `MINIO_SPEAKER_PHOTOS_PREFIX` | Speaker photo prefix |
| `MINIO_TICKET_PASSES_PREFIX` | Ticket pass prefix |
| `MINIO_INVOICES_PREFIX` | Invoice prefix |

## Grafana and monitoring

| Variable | Purpose |
|---|---|
| `GRAFANA_ADMIN_USER` | Grafana admin login |
| `GRAFANA_ADMIN_PASSWORD` | Grafana admin password |
| `LOKI_HOST_PORT` | Loki host port |
| `TEMPO_HOST_PORT` | Tempo host port |
| `OTEL_GRPC_PORT` | OpenTelemetry gRPC collector port |
| `OTEL_HTTP_PORT` | OpenTelemetry HTTP collector port |
| `OTEL_METRICS_PORT` | OpenTelemetry metrics port |

## CORS values

| Variable | Purpose |
|---|---|
| `EVENT_CORS_ALLOWED_ORIGINS` | Event-service allowed frontend origins |
| `FINANCE_CORS_ALLOWED_ORIGINS` | Finance-service allowed frontend origins |

Match these with the actual frontend host used in your environment.

## Final recommendation

Use `.env.example` as the template, keep real values local, and move all sensitive values through the repository's Vault import workflow before starting the stack.
