# HashiCorp Vault Prerequisites

[Back to README section](../../README.md#env-file-example-and-prerequisites-for-hashi-corp-vault) | [Back to env overview](./OVERVIEW.md)

This repository already includes a local Vault workflow. You do not need to install a separate Vault server just to run the project.

## What the local Vault flow does

- Keeps sensitive values out of committed files.
- Imports selected `.env` keys into an encrypted local secret store.
- Loads those secrets into a Docker-based local Vault instance at runtime.
- Uses helper scripts to start, rebuild, and stop the platform with Vault-injected secrets.

## Files involved

| File | Purpose |
|---|---|
| [`../../.env.example`](../../.env.example) | Committed template for all env variables |
| [`../../.secrets/local-vault-secrets.dpapi.example.json`](../../.secrets/local-vault-secrets.dpapi.example.json) | Example manifest showing which secret keys are managed |
| [`../../scripts/set-local-vault-secrets.ps1`](../../scripts/set-local-vault-secrets.ps1) | Windows secret import helper |
| [`../../scripts/start-local-vault.ps1`](../../scripts/start-local-vault.ps1) | Windows start helper |
| [`../../scripts/rebuild-local-vault.ps1`](../../scripts/rebuild-local-vault.ps1) | Windows rebuild helper |
| [`../../scripts/stop-local-vault.ps1`](../../scripts/stop-local-vault.ps1) | Windows stop helper |
| [`../../scripts/set-local-vault-secrets.sh`](../../scripts/set-local-vault-secrets.sh) | Linux secret import helper |
| [`../../scripts/start-local-vault.sh`](../../scripts/start-local-vault.sh) | Linux start helper |

## Windows prerequisites

- Docker Desktop with Linux containers enabled
- PowerShell 5.1 or newer
- Enough RAM for the full Docker stack

## Linux prerequisites

- Docker and `docker compose`
- `openssl`
- `jq`
- `python3`
- `ss` from `iproute2`

## Step-by-step setup

### 1. Create your local `.env`

Copy the example file and replace placeholder values:

```powershell
Copy-Item .env.example .env
```

or

```bash
cp .env.example .env
```

### 2. Fill the provider credentials

Before importing to Vault, complete the provider-specific variables:

- Google OAuth: see [google-oauth-client-id.md](google-oauth-client-id.md)
- Firebase: see [firebase.md](firebase.md)
- Gmail SMTP: see [gmail-smtp-app-password.md](gmail-smtp-app-password.md)
- Razorpay: see [razorpay.md](razorpay.md)

### 3. Import the managed secret keys into the encrypted local store

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\set-local-vault-secrets.ps1 -ImportFromEnvFile .\.env
```

Linux:

```bash
export EVENTZEN_LOCAL_VAULT_PASSPHRASE='choose-a-strong-passphrase'
./scripts/set-local-vault-secrets.sh --import-from-env-file ./.env
```

The import helper reads only the managed secret keys by default.

### 4. Bootstrap the local Vault machine

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\bootstrap-local-vault-machine.ps1
```

Linux:

```bash
export EVENTZEN_LOCAL_VAULT_PASSPHRASE='choose-a-strong-passphrase'
./scripts/bootstrap-local-vault-machine.sh
```

### 5. Start the stack

Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-local-vault.ps1
```

Linux:

```bash
export EVENTZEN_LOCAL_VAULT_PASSPHRASE='choose-a-strong-passphrase'
./scripts/start-local-vault.sh
```

### 6. Use rebuild instead of re-running start

When the stack is already up, rebuild with:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\rebuild-local-vault.ps1
```

or

```bash
export EVENTZEN_LOCAL_VAULT_PASSPHRASE='choose-a-strong-passphrase'
./scripts/rebuild-local-vault.sh
```

This avoids re-probing ports and keeps the saved port snapshot consistent.

## Important notes

- The real local secret store is intentionally ignored by git.
- Keep real `.env` files and screenshots private.
- If you rotate SMTP, Firebase, or Razorpay credentials, re-import them into the local secret store before rebuilding the stack.
- The current repo scripts treat the listed managed secrets as the values that should move into the Vault-backed local store.

## Useful links

- Main README Vault workflow: [../../README.md](../../README.md)
- HashiCorp Vault KV docs: https://developer.hashicorp.com/vault/docs/secrets/kv
