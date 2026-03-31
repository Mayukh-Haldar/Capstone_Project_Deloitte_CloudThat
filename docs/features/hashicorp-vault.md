[← Features Overview](./README.md) · [← Novelty & Advanced Features](../../README.md#-novelty--advanced-features)

---

# 🔑 HashiCorp Vault

**Role:** Secrets Management  
**Category:** Advanced Infrastructure

---

## Overview

EventZen uses **HashiCorp Vault** to eliminate secrets from source code, environment files, and Docker images entirely. Every service credential - database passwords, API keys, JWT signing keys, Razorpay secrets, Firebase credentials - is injected at container startup by a **Vault Agent sidecar** and never written to disk in plaintext.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  docker-compose.vault.yml                            │
│                                                      │
│  ┌─────────────┐   AppRole    ┌──────────────────┐   │
│  │ Vault Agent │ ──────────▶  │  Vault Server    │   │
│  │  (sidecar)  │              │  (KV v2 store)   │   │
│  └──────┬──────┘              └──────────────────┘   │
│         │ rendered .env                              │
│         ▼                                            │
│  ┌─────────────┐                                     │
│  │  Service    │  (reads env vars at startup)        │
│  │  Container  │                                     │
│  └─────────────┘                                     │
└──────────────────────────────────────────────────────┘
```

## Key Concepts

| Concept | Implementation |
|---------|----------------|
| **Secret Engine** | KV v2 - versioned key-value store, one path per service |
| **Auth Method** | AppRole - each service has a `role_id` + `secret_id`; no human credentials |
| **Vault Agent** | Runs as a sidecar in `docker-compose.vault.yml`; authenticates, fetches secrets, renders `.env` templates |
| **Template Rendering** | HCL templates in `vault/agent/` define which secrets map to which env vars |
| **Zero Secret at Rest** | No `.env` files with real values are committed; only `.env.example` templates exist |

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/start-local-vault.ps1` / `.sh` | Start Vault in dev mode for local development |
| `scripts/set-local-vault-secrets.ps1` / `.sh` | Populate Vault KV store with local dev secrets |
| `scripts/bootstrap-local-vault-machine.ps1` / `.sh` | Full first-time machine setup including Vault CLI |
| `scripts/rebuild-local-vault.ps1` / `.sh` | Tear down and reinitialise Vault with fresh secrets |

## Vault Secret Paths

```
secret/eventzen/auth-service        → DB, JWT, MFA, SMTP credentials
secret/eventzen/event-service       → DB, MinIO credentials
secret/eventzen/finance-service     → DB, Razorpay keys, MinIO credentials
secret/eventzen/ticketing-service   → DB, JWT, Firebase, MinIO credentials
secret/eventzen/venue-vendor-service → DB, JWT credentials
secret/eventzen/notification-service → DB, Kafka, SMTP, Firebase, Redis credentials
```
