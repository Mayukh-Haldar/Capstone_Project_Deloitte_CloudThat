# Local HashiCorp Vault Docker Setup

This repository now includes an optional local Docker mode that replaces `.env`-driven backend runtime secrets with a local HashiCorp Vault OSS workflow.

On Windows, the Vault startup flow reads secrets from a DPAPI-encrypted local store outside the repository instead of using `.env`.

On Linux, the repo now includes equivalent Bash scripts that use an OpenSSL-encrypted local store at `.secrets/local-vault-secrets.enc`.

## What It Does

- Starts Vault in local dev mode with in-memory storage.
- Loads secret values from a Windows DPAPI-encrypted local file tied to your user profile.
- Seeds a shared local secret bundle into Vault.
- Generates a wrapped AppRole Secret ID.
- Uses Vault Agent to unwrap and render a runtime env file into a tmpfs-backed Docker volume.
- Starts backend services only after that rendered env file exists.

## What This Replaces

- The backend services no longer require `.env` to exist when you use the Vault startup flow.
- Secrets are no longer persisted in `.env` for the Vault-based local path.
- Sensitive values are loaded into process memory only for the lifetime of the Vault startup process.

## What Still Uses Plain Compose Environment Values

- Frontend build args and public URLs are still passed as normal Docker Compose variables because they are build-time/public config, not backend secrets.
- Infrastructure images such as MySQL, MinIO, and Grafana still receive their bootstrap credentials from the startup process environment for local development.
- The startup script resolves safe host ports for the local stack, including the MinIO API port, and updates the derived local public URLs before Compose starts.

## Files Added

- `docker-compose.vault.yml`
- `scripts/bootstrap-local-vault-machine.ps1`
- `scripts/vault/local-secret-store.ps1`
- `scripts/set-local-vault-secrets.ps1`
- `scripts/stop-local-vault.ps1`
- `.secrets/local-vault-secrets.dpapi.example.json`
- `vault/scripts/bootstrap-local-vault.sh`
- `vault/agent/local-agent.hcl`
- `vault/agent/eventzen.env.ctmpl`
- `scripts/start-local-vault.ps1`

## Startup Steps

### Linux

1. Make sure Docker is installed and responding.
2. Make the new scripts executable once:

```bash
chmod +x ./scripts/*.sh ./scripts/vault/*.sh
```

3. Optional but recommended for fewer prompts:

```bash
export EVENTZEN_LOCAL_VAULT_PASSPHRASE='choose-a-strong-passphrase'
```

4. Bootstrap the Linux machine and start the stack:

```bash
./scripts/bootstrap-local-vault-machine.sh
```

5. If you want to manage the steps separately:

```bash
./scripts/set-local-vault-secrets.sh
./scripts/start-local-vault.sh
```

6. To inspect the generated bootstrap admin password:

```bash
./scripts/set-local-vault-secrets.sh --reveal-bootstrap-password
```

To re-encrypt an existing Linux secret store with a new passphrase:

```bash
./scripts/set-local-vault-secrets.sh --change-passphrase
```

Or non-interactively:

```bash
export EVENTZEN_LOCAL_VAULT_PASSPHRASE='current-passphrase'
export EVENTZEN_LOCAL_VAULT_NEW_PASSPHRASE='new-passphrase'
./scripts/set-local-vault-secrets.sh --change-passphrase
```

7. To stop or rebuild while preserving the saved port mappings:

```bash
./scripts/rebuild-local-vault.sh
./scripts/stop-local-vault.sh
./scripts/stop-local-vault.sh --remove-volumes
```

### Windows

1. Make sure Docker Desktop is running.
2. Recommended on a fresh Windows machine:

```powershell
./scripts/bootstrap-local-vault-machine.ps1
```

3. If you want to manage the steps separately, create the encrypted local secret store with:

```powershell
./scripts/set-local-vault-secrets.ps1
```

If you need to see the generated bootstrap admin password, opt in explicitly:

```powershell
./scripts/set-local-vault-secrets.ps1 -RevealBootstrapPassword
```

4. Start the stack directly with:

```powershell
./scripts/start-local-vault.ps1
```

5. Wait for Docker Compose to finish starting the stack.
6. Open the Vault UI at `http://localhost:8200/ui`.
7. Use the root token stored in your encrypted local secret store if you need to inspect local secrets.

## Machine Bootstrap Automation

- `scripts/bootstrap-local-vault-machine.ps1` is the machine-setup entry point for Windows.
- It verifies that Docker is installed and responsive.
- It creates or refreshes the encrypted local secret store.
- It then starts the Vault-backed Docker stack.
- This is the script you should put in onboarding instructions for a new local machine.

## Local Secret Store

- Store location: `.secrets/local-vault-secrets.dpapi`
- Example file: `.secrets/local-vault-secrets.dpapi.example.json`
- Protection: Windows DPAPI with `CurrentUser` scope
- Access model: only the same Windows user account on the same machine can decrypt it
- Rotation: rerun `./scripts/set-local-vault-secrets.ps1 -RotateGeneratedSecrets`
- Password display: bootstrap password is not printed unless `-RevealBootstrapPassword` is supplied
- Optional overrides: set supported secret environment variables in the current PowerShell session before running `./scripts/set-local-vault-secrets.ps1` to persist them into the encrypted store
- First-run automation: `./scripts/start-local-vault.ps1` now auto-creates the secret store if it is missing

For Linux:

- Store location: `.secrets/local-vault-secrets.enc`
- Protection: OpenSSL AES-256-CBC with PBKDF2
- Access model: anyone with the encrypted file and passphrase can decrypt it, so keep both local and private
- Optional automation: export `EVENTZEN_LOCAL_VAULT_PASSPHRASE` before running the Bash scripts

## How the Secret Flow Works

1. `scripts/set-local-vault-secrets.ps1` writes an encrypted secret bundle to `.secrets/local-vault-secrets.dpapi`.
2. `scripts/start-local-vault.ps1` decrypts that bundle into the current PowerShell process only.
3. `vault` starts in local in-memory dev mode.
4. `vault-init` writes the local runtime secret bundle to `secret/eventzen/local`.
5. `vault-init` creates an AppRole and writes:
   - a role ID
   - a wrapped Secret ID token
   into the `vault_approle` tmpfs volume.
6. `vault-agent-local` authenticates with the wrapped Secret ID and renders `/vault/rendered/eventzen.env`.
7. Backend services source `/vault/secrets/eventzen.env` before launching their normal process.

## Shutdown

Stop the stack with:

```powershell
./scripts/stop-local-vault.ps1
```

This helper loads the encrypted local secret store into the current PowerShell process before calling Docker Compose, so Vault-only variables like `VAULT_DEV_ROOT_TOKEN_ID` are available for Compose interpolation during shutdown.

Remove volumes too if you want a clean local reset:

```powershell
./scripts/stop-local-vault.ps1 -RemoveVolumes
```

## Notes

- This is a local-development-only Vault workflow.
- Vault runs in dev mode and stores data in memory.
- The encrypted local secret store is separate from the repository and is not a `.env` file.
- The real `.secrets/local-vault-secrets.dpapi` file is ignored by git, while `.secrets/local-vault-secrets.dpapi.example.json` is committed as a documentation artifact.
- Generated build outputs such as `frontend/dist` and `backend/services/*/target` should remain untracked.
- Wrapped Secret IDs and rendered secret files are placed on tmpfs-backed Docker volumes for the local path.
- On Windows checkouts, `/vault/secrets/eventzen.env` can be rendered with CRLF line endings. The Linux container entrypoints strip `\r` before sourcing that file so usernames, passwords, and other secrets are not polluted by a trailing carriage return.
- If you already use `scripts/start-local.ps1`, that path remains available for the legacy `.env` workflow.
