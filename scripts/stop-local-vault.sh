#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=./vault/local-secret-store.sh
source "$SCRIPT_DIR/vault/local-secret-store.sh"

remove_volumes=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --remove-volumes)
      remove_volumes=true
      shift
      ;;
    *)
      printf '%s\n' "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

eventzen_assert_command_available "docker" "Install Docker and rerun the script."

if ! eventzen_test_local_secret_store; then
  printf '%s\n' "Encrypted local Vault secret store not found at '$(eventzen_local_secret_store_path)'. Run ./scripts/set-local-vault-secrets.sh first, or stop the stack from a shell where the Vault env vars are already loaded." >&2
  exit 1
fi

store_passphrase="$(eventzen_prompt_passphrase 'Enter the local Vault secret-store passphrase: ')"
local_secret_values="$(eventzen_read_local_secret_store_json "$store_passphrase")"
eventzen_assert_local_secret_values "$local_secret_values"
eventzen_set_secrets_to_process_environment "$local_secret_values"

compose_args=(-f "$REPO_ROOT/docker-compose.yml" -f "$REPO_ROOT/docker-compose.vault.yml" down --remove-orphans)
if [[ "$remove_volumes" == "true" ]]; then
  compose_args+=(-v)
fi

printf '%s\n' "Stopping Vault-backed local Docker stack..."
docker compose "${compose_args[@]}"
