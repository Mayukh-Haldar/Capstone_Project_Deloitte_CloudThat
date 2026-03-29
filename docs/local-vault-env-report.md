# Local Vault Env Coverage Report

This report compares the current root `.env` file with the live Vault secret at `secret/eventzen/local` for the local HashiCorp Vault Docker flow.

Current comparison snapshot:

- `.env` keys: 132
- live Vault keys in `secret/eventzen/local`: 85
- keys present in `.env` but excluded from the live Vault secret: 69
- keys present in Vault but not present in `.env`: 22

## Why The Counts Differ

The current design does not try to copy the full `.env` file into Vault.

Instead, the local Vault flow does this:

1. `scripts/start-local-vault.ps1` loads the encrypted local secret store into the current PowerShell process.
2. Docker Compose uses those in-memory values for host-side interpolation, image build args, and infrastructure bootstrap.
3. `vault-init` writes only the backend runtime subset defined in `docker-compose.vault.yml` and `vault/scripts/bootstrap-local-vault.sh` into `secret/eventzen/local`.
4. Vault Agent renders that runtime subset to `/vault/secrets/eventzen.env` for the Vault-backed service containers.

That means many `.env` values are intentionally excluded from Vault because they are host-only, build-time, operational, or transformed into different runtime keys before being written to Vault.

## Excluded From Vault

### 1. Host-Published Port Variables

These are used by Docker Compose port bindings and by `scripts/start-local-vault.ps1` when it resolves safe host ports on Windows. They are not backend runtime secrets.

- `NGINX_PORT`
- `MYSQL_PORT`
- `MONGODB_PORT`
- `KAFKA_PORT`
- `KAFKA_UI_PORT`
- `MINIO_CONSOLE_PORT`
- `ZOOKEEPER_PORT`
- `PROMETHEUS_PORT`
- `LOKI_HOST_PORT`
- `TEMPO_HOST_PORT`
- `OTEL_GRPC_PORT`
- `OTEL_HTTP_PORT`
- `OTEL_METRICS_PORT`
- `GRAFANA_HOST_PORT`

### 2. Frontend Build-Time And Public Variables

These are used as frontend build args or public client-side config. They are intentionally kept outside the Vault backend runtime secret bundle.

- `FRONTEND_PORT`
- `VITE_AUTH_SERVICE_URL`
- `VITE_EVENT_SERVICE_URL`
- `VITE_FINANCE_SERVICE_URL`
- `VITE_NOTIFICATION_SERVICE_URL`
- `VITE_TICKETING_SERVICE_URL`
- `VITE_VENUE_VENDOR_SERVICE_URL`
- `VITE_SITE_URL`
- `VITE_GOOGLE_CLIENT_ID`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_VAPID_KEY`

### 3. Autoscaler And Replica Tuning Variables

These are operational deployment knobs used by the autoscaler and scaling scripts, not by the Vault-backed local backend runtime secret file.

- `AUTOSCALER_COOLDOWN_SECONDS`
- `AUTOSCALER_ENABLED`
- `AUTOSCALER_INTERVAL_SECONDS`
- `AUTOSCALER_SCALE_DOWN_THRESHOLD`
- `AUTOSCALER_SCALE_UP_THRESHOLD`
- `AUTH_SERVICE_MIN_REPLICAS`
- `AUTH_SERVICE_MAX_REPLICAS`
- `EVENT_SERVICE_MIN_REPLICAS`
- `EVENT_SERVICE_MAX_REPLICAS`
- `FINANCE_SERVICE_MIN_REPLICAS`
- `FINANCE_SERVICE_MAX_REPLICAS`
- `NOTIFICATION_SERVICE_MIN_REPLICAS`
- `NOTIFICATION_SERVICE_MAX_REPLICAS`
- `TICKETING_SERVICE_MIN_REPLICAS`
- `TICKETING_SERVICE_MAX_REPLICAS`
- `VENUE_VENDOR_SERVICE_MIN_REPLICAS`
- `VENUE_VENDOR_SERVICE_MAX_REPLICAS`

### 4. Proxy And Deployment Script Variables

These are used by deployment or nginx rendering scripts rather than the local Vault runtime secret bundle.

- `APP_ROOT`
- `API_RATE_LIMIT_BURST`
- `API_RATE_LIMIT_RPS`
- `AUTH_RATE_LIMIT_BURST`
- `AUTH_RATE_LIMIT_RPS`

### 5. Infrastructure Bootstrap Variables That Are Transformed Or Used Directly By Compose

These keys are loaded into memory during startup, but they are not written into Vault under the same names.

- `MYSQL_ROOT_PASSWORD`
  Reason: used to bootstrap MySQL directly and transformed into `AUTH_DB_PASSWORD`, `EVENT_DB_PASSWORD`, and `FINANCE_DB_PASSWORD` before writing to Vault.
- `MINIO_ROOT_USER`
  Reason: used by MinIO directly and transformed into `EVENT_STORAGE_ACCESS_KEY` for the Vault secret.
- `MINIO_ROOT_PASSWORD`
  Reason: used by MinIO directly and transformed into `EVENT_STORAGE_SECRET_KEY` for the Vault secret.
- `MINIO_BUCKET`
  Reason: transformed into `EVENT_STORAGE_BUCKET` for the Vault secret.
- `MINIO_PUBLIC_BASE_URL`
  Reason: transformed into `EVENT_STORAGE_PUBLIC_BASE_URL` for the Vault secret.
- `MINIO_EVENT_BANNERS_PREFIX`
  Reason: transformed into `EVENT_STORAGE_EVENT_BANNERS_PREFIX` for the Vault secret.
- `MINIO_SPEAKER_PHOTOS_PREFIX`
  Reason: transformed into `EVENT_STORAGE_SPEAKER_PHOTOS_PREFIX` for the Vault secret.
- `GRAFANA_ADMIN_USER`
  Reason: consumed directly by the Grafana container through Compose, not by Vault-backed backend services.
- `GRAFANA_ADMIN_PASSWORD`
  Reason: consumed directly by the Grafana container through Compose, not by Vault-backed backend services.

### 6. Direct Compose, Defaulted, Or Not-Currently-Seeded Runtime Variables

These keys are excluded from the live Vault secret because the current local design either derives them elsewhere, relies on base Compose wiring, or does not seed them into Vault yet.

- `EVENT_CORS_ALLOWED_ORIGINS`
  Reason: the local Docker flow sets event CORS from `FRONTEND_ORIGIN` in the base Compose service environment instead of seeding this key into Vault.
- `FINANCE_CORS_ALLOWED_ORIGINS`
  Reason: the local Docker flow sets finance CORS from `FRONTEND_ORIGIN` in the base Compose service environment instead of seeding this key into Vault.
- `ENABLE_REQUEST_LOGS`
  Reason: used by Node services, but not currently written into the Vault runtime secret.
- `KAFKA_CLIENT_ID`
  Reason: used by `notification-service`, but not currently written into the Vault runtime secret.
- `KAFKA_CONSUMER_GROUP`
  Reason: used by `notification-service`, but not currently written into the Vault runtime secret.
- `KAFKA_TOPICS`
  Reason: used by `notification-service`, but not currently written into the Vault runtime secret.
- `KAFKA_EXTERNAL_HOST`
  Reason: host/external client setting, not part of the backend Vault secret bundle.
- `REDIS_PORT`
  Reason: not used by the current local Vault runtime secret path; Redis is consumed internally through `REDIS_URL`.

## Present In Vault But Not In `.env`

These keys exist in the live Vault secret because the local Vault path normalizes or derives backend runtime values before writing them.

- `AUTH_DB_URL`
- `EVENT_DB_URL`
- `FINANCE_DB_URL`
- `EVENT_SERVICE_BASE_URL`
- `NOTIFICATION_SERVICE_BASE_URL`
- `NOTIFICATION_SERVICE_URL`
- `TICKETING_SERVICE_BASE_URL`
- `TICKETING_SERVICE_URL`
- `VENUE_VENDOR_SERVICE_BASE_URL`
- `VENUE_VENDOR_SERVICE_URL`
- `VENUE_VENDOR_INTERNAL_SERVICE_KEY`
- `EVENT_STORAGE_ACCESS_KEY`
- `EVENT_STORAGE_BUCKET`
- `EVENT_STORAGE_ENDPOINT`
- `EVENT_STORAGE_EVENT_BANNERS_PREFIX`
- `EVENT_STORAGE_PUBLIC_BASE_URL`
- `EVENT_STORAGE_SECRET_KEY`
- `EVENT_STORAGE_SPEAKER_PHOTOS_PREFIX`
- `KAFKA_BROKERS`
- `REDIS_URL`
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `MANAGEMENT_TRACING_SAMPLING_PROBABILITY`

## What Gets Loaded In Memory

All keys that exist in the encrypted local secret store are loaded into the PowerShell startup process memory by `scripts/start-local-vault.ps1`.

That does not mean all of those keys are then written into Vault.

There are three separate stages:

1. local encrypted store to PowerShell process memory
2. PowerShell process memory to Docker Compose interpolation and build/runtime environment
3. selected runtime subset to Vault secret and then to `/vault/secrets/eventzen.env`

So the current answer is:

- all keys in the local encrypted store are loaded into startup-process memory
- only the selected runtime subset is written into Vault
- only the Vault-rendered subset is sourced from `/vault/secrets/eventzen.env`

## Will The Website Run Properly?

For the current local Docker flow, yes, the website can run properly without all 132 `.env` keys being present in Vault.

That is because most of the 69 excluded keys are one of these:

- host port mapping values
- frontend build/public values
- autoscaler or deployment script knobs
- infrastructure bootstrap credentials that are transformed into different runtime keys
- values supplied directly by Compose or defaults instead of Vault

Important caveat:

The current design still has a small set of non-Vault runtime settings that are not part of the live Vault secret, especially `ENABLE_REQUEST_LOGS`, `KAFKA_CLIENT_ID`, `KAFKA_CONSUMER_GROUP`, and `KAFKA_TOPICS` for `notification-service`.

That means the main website and core API stack can be healthy while the Vault secret still contains only 85 keys, but a fully `.env`-free local runtime is not yet a perfect one-to-one replacement for every non-secret operational variable in the repository.

In short:

- the current 85-key Vault payload is enough for the main local Vault-backed application stack to start
- the app does not need all 132 `.env` keys inside Vault
- some excluded keys remain intentionally outside Vault
- a few excluded runtime knobs still come from Compose, `.env`, or defaults rather than the Vault secret itself
