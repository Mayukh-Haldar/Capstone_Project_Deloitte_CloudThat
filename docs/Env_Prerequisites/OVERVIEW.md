# Environment Overview

[Back to README section](../../README.md#env-file-example-and-prerequisites-for-hashi-corp-vault)

This folder explains how to prepare `.env` for EventZen and how to move sensitive values into the local HashiCorp Vault workflow used by this repository.

## Start here

1. Copy [`../../.env.example`](../../.env.example) to `.env`.
2. Fill in provider-specific values for Google OAuth, Firebase, Gmail SMTP, and Razorpay.
3. Review the Vault guide in [`hashicorp-vault-prerequisites.md`](hashicorp-vault-prerequisites.md).
4. Import managed secrets into the encrypted local secret store before starting the stack.
5. Start the stack with the Vault helper scripts from the main README.

## What belongs in `.env`

`.env.example` contains three kinds of configuration:

| Category | Examples | Notes |
|---|---|---|
| Public or low-sensitivity runtime config | `FRONTEND_ORIGIN`, `VITE_SITE_URL`, `FRONTEND_PORT`, `KAFKA_TOPICS` | Safe to keep in `.env.example` as placeholders. |
| Secret values managed by the local Vault workflow | `MYSQL_ROOT_PASSWORD`, `AUTH_SMTP_PASSWORD`, `FINANCE_RAZORPAY_KEY_SECRET`, `NOTIFICATION_FIREBASE_PRIVATE_KEY` | Import these into the encrypted local secret store before starting the Vault-backed stack. |
| External-provider identifiers | `VITE_GOOGLE_CLIENT_ID`, `VITE_FIREBASE_PROJECT_ID`, `NOTIFICATION_FIREBASE_CLIENT_EMAIL` | Usually copied from Google, Firebase, Razorpay, or Atlas dashboards. |

## Provider-specific guides

- [HashiCorp Vault prerequisites](hashicorp-vault-prerequisites.md)
- [Firebase setup](firebase.md)
- [Google OAuth client ID](google-oauth-client-id.md)
- [Gmail SMTP app password](gmail-smtp-app-password.md)
- [Razorpay setup](razorpay.md)
- [MongoDB connection strings](mongodb-connection-strings.md)
- [General env variable reference](env-variable-reference.md)

## Variable groups used in this repository

| Group | Main variables |
|---|---|
| Frontend base URLs | `APP_ROOT`, `FRONTEND_ORIGIN`, `AUTH_APP_BASE_URL`, `VITE_SITE_URL`, `VITE_*_SERVICE_URL` |
| Google sign-in | `VITE_GOOGLE_CLIENT_ID`, `AUTH_GOOGLE_CLIENT_ID` |
| Firebase web app | `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_VAPID_KEY` |
| SMTP | `AUTH_SMTP_*`, `NOTIFICATION_SMTP_*`, `AUTH_MAIL_FROM_*`, `NOTIFICATION_MAIL_FROM_*` |
| Razorpay | `FINANCE_RAZORPAY_ENABLED`, `FINANCE_RAZORPAY_KEY_ID`, `FINANCE_RAZORPAY_KEY_SECRET`, `FINANCE_RAZORPAY_CHECKOUT_*` |
| Firebase Admin / FCM server | `NOTIFICATION_FIREBASE_PROJECT_ID`, `NOTIFICATION_FIREBASE_CLIENT_EMAIL`, `NOTIFICATION_FIREBASE_PRIVATE_KEY` |
| MongoDB | `VENUE_VENDOR_MONGO_URI`, `TICKETING_MONGO_CONNECTION_STRING`, `TICKETING_MONGO_DATABASE`, `NOTIFICATION_MONGO_URI` |
| MySQL | `MYSQL_ROOT_PASSWORD`, `AUTH_DB_*`, `EVENT_DB_*`, `FINANCE_DB_*` |
| Shared auth & service keys | `AUTH_JWT_SECRET`, `AUTH_CRYPTO_SECRET`, `NOTIFICATION_INTERNAL_SERVICE_KEY`, `TICKETING_INTERNAL_SERVICE_KEY`, `VENUE_VENDOR_INTERNAL_SERVICE_KEY` |
| Infra and local ops | `MINIO_*`, `GRAFANA_*`, `KAFKA_*`, ports, rate limits, autoscaler values |

## Managed secret keys imported into the local secret store

The local secret store example at [../../.secrets/local-vault-secrets.dpapi.example.json](../../.secrets/local-vault-secrets.dpapi.example.json) and the PowerShell helper in [../../scripts/vault/local-secret-store.ps1](../../scripts/vault/local-secret-store.ps1) indicate that the following values are treated as managed secrets by the local Vault flow:

- `VAULT_DEV_ROOT_TOKEN_ID`
- `MYSQL_ROOT_PASSWORD`
- `MINIO_ROOT_PASSWORD`
- `GRAFANA_ADMIN_PASSWORD`
- `AUTH_DB_PASSWORD`
- `EVENT_DB_PASSWORD`
- `FINANCE_DB_PASSWORD`
- `AUTH_JWT_SECRET`
- `AUTH_CRYPTO_SECRET`
- `AUTH_BOOTSTRAP_ADMIN_EMAIL`
- `AUTH_BOOTSTRAP_ADMIN_PASSWORD`
- `NOTIFICATION_INTERNAL_SERVICE_KEY`
- `TICKETING_INTERNAL_SERVICE_KEY`
- `VENUE_VENDOR_INTERNAL_SERVICE_KEY`
- `AUTH_SMTP_USERNAME`
- `AUTH_SMTP_PASSWORD`
- `NOTIFICATION_SMTP_USERNAME`
- `NOTIFICATION_SMTP_PASSWORD`
- `NOTIFICATION_FIREBASE_PROJECT_ID`
- `NOTIFICATION_FIREBASE_CLIENT_EMAIL`
- `NOTIFICATION_FIREBASE_PRIVATE_KEY`
- `FINANCE_RAZORPAY_KEY_ID`
- `FINANCE_RAZORPAY_KEY_SECRET`

## Recommended setup order

1. Fill the Google and Firebase values first because both login and push notifications depend on them.
2. Configure Gmail SMTP next so auth emails and notification emails work immediately.
3. Configure Razorpay if you want end-to-end payment testing.
4. Decide whether MongoDB should point to local Docker containers or MongoDB Atlas.
5. Import secrets into the local Vault store.
6. Start the stack with the Vault helper scripts from the main README.
