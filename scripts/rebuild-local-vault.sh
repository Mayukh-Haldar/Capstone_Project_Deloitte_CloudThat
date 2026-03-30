#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_VAULT_PORTS_PATH="$REPO_ROOT/.secrets/local-vault-ports.json"

# shellcheck source=./vault/local-secret-store.sh
source "$SCRIPT_DIR/vault/local-secret-store.sh"

skip_build=false
services=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      skip_build=true
      shift
      ;;
    --services)
      shift
      while [[ $# -gt 0 && "$1" != --* ]]; do
        services+=("$1")
        shift
      done
      ;;
    *)
      printf '%s\n' "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

eventzen_assert_command_available "docker" "Install Docker and rerun the script."
eventzen_assert_command_available "jq" "Install jq and rerun the script."

if [[ ! -f "$LOCAL_VAULT_PORTS_PATH" ]]; then
  printf '%s\n' "Saved Vault port state not found at '$LOCAL_VAULT_PORTS_PATH'. Run ./scripts/start-local-vault.sh first." >&2
  exit 1
fi

if ! eventzen_test_local_secret_store; then
  printf '%s\n' "Encrypted local Vault secret store not found at '$(eventzen_local_secret_store_path)'. Run ./scripts/set-local-vault-secrets.sh first." >&2
  exit 1
fi

store_passphrase="$(eventzen_prompt_passphrase 'Enter the local Vault secret-store passphrase: ')"
local_secret_values="$(eventzen_read_local_secret_store_json "$store_passphrase")"
eventzen_assert_local_secret_values "$local_secret_values"
eventzen_set_secrets_to_process_environment "$local_secret_values"

while IFS= read -r key; do
  export "$key=$(jq -r --arg key "$key" '.[$key]' "$LOCAL_VAULT_PORTS_PATH")"
done < <(jq -r 'keys[]' "$LOCAL_VAULT_PORTS_PATH")

compose_args=(-f "$REPO_ROOT/docker-compose.yml" -f "$REPO_ROOT/docker-compose.vault.yml" up -d)
if [[ "$skip_build" != "true" ]]; then
  compose_args+=(--build)
fi
if [[ ${#services[@]} -gt 0 ]]; then
  compose_args+=("${services[@]}")
fi

printf '%s\n' "Rebuilding Vault-backed local Docker Compose stack using saved Vault port mappings..."
docker compose "${compose_args[@]}"
