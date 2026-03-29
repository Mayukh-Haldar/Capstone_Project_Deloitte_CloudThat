# EventZen

Root-level quick start for the `EXPORT_GITHUB_DOCKER` branch.

## Prerequisites

- Docker Desktop
- Docker Compose
- A local `.env` file copied from `.env.example` only if you plan to use the legacy non-Vault flow

## HashiCorp Vault

This repository includes a Docker-based local Vault setup for backend runtime secrets.

For this project, you do not need to install Vault manually on Windows if you use the Docker flow below.

This Vault path does not require a `.env` file. Sensitive values are stored in an encrypted local Windows secret store outside the repository and are loaded into memory only when the Vault startup script runs.

### Docker-Based Vault For This Repo

Recommended one-command bootstrap on a fresh Windows machine:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-local-vault-machine.ps1
```

This will:

- verify Docker is installed and responding
- create or refresh the encrypted local secret store under `.secrets/local-vault-secrets.dpapi`
- start the Vault-backed Docker stack

Generated secrets are not written into tracked repository files. They stay in your local DPAPI-protected store unless you explicitly reveal them.

The real DPAPI blob is ignored by git. A committed example file is kept in `.secrets/local-vault-secrets.dpapi.example.json` so the expected secret keys remain visible in the repo.

You can still run the lower-level commands separately when needed.

Create or rotate the encrypted local secret store only:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set-local-vault-secrets.ps1
```

List the env key names currently stored in the encrypted store without revealing values:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set-local-vault-secrets.ps1 -ListStoredKeys
```

Import managed secret keys directly from a local `.env` file into the encrypted store:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set-local-vault-secrets.ps1 -ImportFromEnvFile .\.env
```

Only the managed secret keys are imported. Non-secret config values are ignored.

If you want the encrypted store to contain the full `.env` payload instead, use:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set-local-vault-secrets.ps1 -ImportFromEnvFile .\.env -ImportAllFromEnvFile
```

When you do that, [scripts/start-local-vault.ps1](scripts/start-local-vault.ps1) will still only mutate the port-related environment variables in memory to safe host ports and recompute the derived local URLs from those resolved ports.

Reveal the generated bootstrap admin password only when needed:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set-local-vault-secrets.ps1 -RevealBootstrapPassword
```

Start the local Vault stack directly:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-vault.ps1
```

This will:

- auto-create the Windows DPAPI-protected local secret store on first run if it does not exist
- start HashiCorp Vault OSS in Docker
- load local secrets into the startup process memory and seed them into Vault
- render backend runtime secrets from Vault Agent into in-memory volumes
- start the local Docker stack with Vault-backed secrets

On Windows checkouts, the rendered Vault env file can carry CRLF line endings. The Vault-backed service entrypoints normalize that file before sourcing it so DB credentials and other secrets do not pick up a trailing carriage return.

Important:

- rerunning `scripts/start-local-vault.ps1` while the Vault-backed stack is already running can cause the script to choose new host ports, because it probes for currently available ports before calling Docker Compose
- if you want to rebuild containers without changing the existing published ports, use `scripts/rebuild-local-vault.ps1` instead of rerunning `scripts/start-local-vault.ps1`

Vault UI will be available at:

```text
http://localhost:8200/ui
```

See [docs/local-vault-docker.md](docs/local-vault-docker.md) for the full Vault Docker workflow.

Check the mapped Vault port directly with Docker Compose if needed:

```powershell
docker compose -f docker-compose.yml -f docker-compose.vault.yml port vault 8200
```

This command is only for inspection. It reports the current host port mapping for the running container and does not rebuild or restart the stack.

Rebuild the Vault-backed stack in place without reassigning ports:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-local-vault.ps1
```

Rebuild without forcing image rebuild:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-local-vault.ps1 -SkipBuild
```

Rebuild only specific services while preserving current port mappings:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-local-vault.ps1 -Services kafka
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-local-vault.ps1 -Services kafka notification-service
```

## Backend API Docs

Swagger UI for the backend services is served through nginx at:

```text
http://localhost/docs/
http://localhost/docs/auth.html
http://localhost/docs/event.html
http://localhost/docs/finance.html
http://localhost/docs/ticketing.html
http://localhost/docs/venue-vendor.html
http://localhost/docs/notification.html
```

The raw published OpenAPI JSON files are available at:

```text
http://localhost/docs/specs/auth-service.json
http://localhost/docs/specs/event-service.json
http://localhost/docs/specs/finance-service.json
http://localhost/docs/specs/ticketing-service.json
http://localhost/docs/specs/venue-vendor-service.json
http://localhost/docs/specs/notification-service.json
```

These spec files are published from the currently running backend containers. If you change backend controllers, validators, request models, or routes, refresh the published Swagger specs with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\refresh-swagger-specs.ps1
```

Recommended workflow after backend API changes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-local-vault.ps1 -Services auth-service
powershell -ExecutionPolicy Bypass -File .\scripts\refresh-swagger-specs.ps1
```

Replace `auth-service` with whichever backend service you changed, or rebuild multiple services first and then run the refresh script once.

Notes:

- the Swagger pages read from the published files under `backend/docker/nginx/static/docs/specs`
- if the browser still shows the older schema list after a refresh, do a hard reload on the Swagger page
- for bearer-protected endpoints, use `Bearer <access_token>` in the Swagger `Authorize` dialog

If you prefer the equivalent raw Docker Compose command instead of the helper script, first load the encrypted local secret store into the current PowerShell process and then run Compose:

```powershell
powershell -ExecutionPolicy Bypass -Command ". .\scripts\vault\local-secret-store.ps1; $s = Read-EventZenLocalSecretStore; Assert-EventZenLocalSecretValues -SecretValues $s; Set-EventZenSecretsToProcessEnvironment -SecretValues $s; docker compose -f docker-compose.yml -f docker-compose.vault.yml up -d --build"
```

Stop the local Vault stack with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-local-vault.ps1
```

For a clean reset that also removes volumes:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\stop-local-vault.ps1 -RemoveVolumes
```

If you prefer the raw Docker Compose command instead of the helper script:

```powershell
docker compose -f docker-compose.yml -f docker-compose.vault.yml down --remove-orphans
```

For a raw Docker Compose shutdown that also removes volumes:

```powershell
docker compose -f docker-compose.yml -f docker-compose.vault.yml down -v
```

### Vault Root Token

The local Vault root token is stored in the encrypted DPAPI secret store under the key `VAULT_DEV_ROOT_TOKEN_ID`.

To print it from PowerShell on Windows, use this one-liner from the repo root:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; . .\scripts\vault\local-secret-store.ps1; $secrets = Read-EventZenLocalSecretStore; $secrets["VAULT_DEV_ROOT_TOKEN_ID"]
```

Notes:

- `-Scope Process` changes execution policy only for the current PowerShell window.
- The encrypted store is local to your Windows user profile and is not committed to git.
- If the store does not exist yet, create it first with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set-local-vault-secrets.ps1
```

### Optional Native Vault CLI Install On Windows

If you want the `vault` CLI installed on your machine as well, use one of these:

```powershell
winget install Hashicorp.Vault
```

or

```powershell
choco install vault
```

Then verify it with:

```powershell
vault --version
```

## Setup

```powershell
Copy-Item .env.example .env
```

Update the values in `.env` before starting the legacy non-Vault stack.

Nginx is loaded directly from `backend/docker/nginx/nginx.conf`, so no separate root-level `nginx` folder is needed.

Important:

- Use the root `.env` file for Docker Compose.
- Containers connect to MongoDB on `mongodb:27017`.
- If you connect to MongoDB from your host machine, use `localhost:27018`.
- On Windows, Docker can fail to bind ports that fall inside excluded TCP ranges. `scripts/start-local.ps1` checks for that automatically and moves published ports to safe values when needed.

## Start The Full Stack

Recommended on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local.ps1
```

This preflight script checks published host ports, avoids Windows excluded port ranges, rewrites `.env` when it finds a blocked port, and then starts Docker Compose.

Direct Docker Compose usage is still available:

```powershell
docker compose --env-file .env -f docker-compose.yml up -d --build
```

After startup, open `http://localhost/` when `NGINX_PORT=80`, or `http://localhost:<NGINX_PORT>/` if the preflight had to move nginx to another host port.

## Stop The Full Stack

```powershell
docker compose --env-file .env -f docker-compose.yml down --remove-orphans
```

## Useful Commands

```powershell
docker compose --env-file .env -f docker-compose.yml ps
docker compose --env-file .env -f docker-compose.yml logs -f
docker compose --env-file .env -f docker-compose.yml restart
```

To inspect a single service:

```powershell
docker compose --env-file .env -f docker-compose.yml logs -f auth-service
docker compose --env-file .env -f docker-compose.yml logs -f venue-vendor-service
docker compose --env-file .env -f docker-compose.yml logs -f ticketing-service
```

## Notes

- This branch is intended to run the full platform through Docker Compose.
- The root compose file brings up the frontend, nginx, backend services, databases, monitoring, and supporting containers.
- The app is served through nginx on the host port configured by `NGINX_PORT`, so the frontend and API routes are available from `http://localhost:<NGINX_PORT>/`.
