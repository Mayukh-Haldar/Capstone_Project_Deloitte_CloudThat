#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# shellcheck source=./vault/local-secret-store.sh
source "$SCRIPT_DIR/vault/local-secret-store.sh"

rotate_generated_secrets=false
reveal_bootstrap_password=false
list_stored_keys=false
import_all_from_env_file=false
import_from_env_file=""
change_passphrase=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotate-generated-secrets)
      rotate_generated_secrets=true
      shift
      ;;
    --reveal-bootstrap-password)
      reveal_bootstrap_password=true
      shift
      ;;
    --import-from-env-file)
      import_from_env_file="${2:-}"
      shift 2
      ;;
    --import-all-from-env-file)
      import_all_from_env_file=true
      shift
      ;;
    --list-stored-keys)
      list_stored_keys=true
      shift
      ;;
    --change-passphrase)
      change_passphrase=true
      shift
      ;;
    *)
      printf '%s\n' "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

eventzen_assert_command_available "openssl" "Install OpenSSL and rerun the script."
eventzen_assert_command_available "jq" "Install jq and rerun the script."
eventzen_assert_command_available "python3" "Install Python 3 and rerun the script."

if [[ "$change_passphrase" == "true" ]]; then
  if ! eventzen_test_local_secret_store; then
    printf '%s\n' "Encrypted local Vault secret store not found at '$(eventzen_local_secret_store_path)'." >&2
    exit 1
  fi

  current_passphrase="${EVENTZEN_LOCAL_VAULT_PASSPHRASE:-}"
  if [[ -z "$current_passphrase" ]]; then
    current_passphrase="$(eventzen_prompt_passphrase 'Enter the current local Vault secret-store passphrase: ')"
  fi

  existing_values="$(eventzen_read_local_secret_store_json "$current_passphrase")"
  eventzen_assert_local_secret_values "$existing_values"

  new_passphrase="${EVENTZEN_LOCAL_VAULT_NEW_PASSPHRASE:-}"
  if [[ -z "$new_passphrase" ]]; then
    read -r -s -p "Choose the new local Vault secret-store passphrase: " new_passphrase
    printf '\n'
    read -r -s -p "Confirm the new passphrase: " confirm_passphrase
    printf '\n'
    if [[ "$new_passphrase" != "$confirm_passphrase" ]]; then
      printf '%s\n' "Passphrases did not match." >&2
      exit 1
    fi
  fi

  if [[ -z "$new_passphrase" ]]; then
    printf '%s\n' "A non-empty new passphrase is required." >&2
    exit 1
  fi

  eventzen_write_local_secret_store "$existing_values" "$new_passphrase"
  printf '%s\n' "Encrypted local Vault secret store passphrase updated."
  printf '%s\n' "Store path: $(eventzen_local_secret_store_path)"
  printf '%s\n' "Use EVENTZEN_LOCAL_VAULT_PASSPHRASE with the new passphrase on future commands."
  exit 0
fi

if [[ "$list_stored_keys" == "true" ]]; then
  if ! eventzen_test_local_secret_store; then
    printf '%s\n' "Encrypted local Vault secret store not found at '$(eventzen_local_secret_store_path)'." >&2
    exit 1
  fi
  store_passphrase="$(eventzen_prompt_passphrase 'Enter the local Vault secret-store passphrase: ')"
  stored_values="$(eventzen_read_local_secret_store_json "$store_passphrase")"
  if [[ "$(jq 'length' <<<"$stored_values")" -eq 0 ]]; then
    printf '%s\n' "No env keys are currently stored in the encrypted local Vault secret store."
    exit 0
  fi
  printf '%s\n' "Stored env keys in encrypted local Vault secret store:"
  jq -r 'keys[]' <<<"$stored_values"
  exit 0
fi

explicit_overrides='{}'
if [[ -n "$import_from_env_file" ]]; then
  resolved_import_path="$(eventzen_resolve_env_file_path "$import_from_env_file")"
  if [[ "$import_all_from_env_file" == "true" ]]; then
    explicit_overrides="$(eventzen_env_file_entries_json "$resolved_import_path")"
  else
    explicit_overrides="$(eventzen_env_file_secret_overrides_json "$resolved_import_path")"
  fi
fi

existing_store_passphrase=""
existing_values='{}'
if [[ "$rotate_generated_secrets" != "true" ]] && eventzen_test_local_secret_store; then
  existing_store_passphrase="$(eventzen_prompt_passphrase 'Enter the existing local Vault secret-store passphrase: ')"
  existing_values="$(eventzen_read_local_secret_store_json "$existing_store_passphrase")"
fi

prepared_json="$(
  eventzen_merge_json_objects \
    <(eventzen_secret_defaults_json) \
    <(printf '%s\n' "$existing_values") \
    <(eventzen_environment_secret_overrides_json) \
    <(printf '%s\n' "$explicit_overrides")
)"
eventzen_assert_local_secret_values "$prepared_json"

new_passphrase="${EVENTZEN_LOCAL_VAULT_PASSPHRASE:-$existing_store_passphrase}"
if [[ -z "$new_passphrase" ]]; then
  read -r -s -p "Choose a local Vault secret-store passphrase: " new_passphrase
  printf '\n'
  read -r -s -p "Confirm the passphrase: " confirm_passphrase
  printf '\n'
  if [[ "$new_passphrase" != "$confirm_passphrase" ]]; then
    printf '%s\n' "Passphrases did not match." >&2
    exit 1
  fi
fi

eventzen_write_local_secret_store "$prepared_json" "$new_passphrase"

printf '%s\n' "Encrypted local Vault secret store updated."
printf '%s\n' "Store path: $(eventzen_local_secret_store_path)"
printf '%s\n' "Committed example path: $(eventzen_local_secret_store_example_path)"
printf '%s\n' "Linux mode uses OpenSSL AES-256 encryption. Set EVENTZEN_LOCAL_VAULT_PASSPHRASE to avoid repeat prompts."
printf '%s\n' "Values are only loaded into process memory when scripts/start-local-vault.sh runs."
printf '%s\n' "Bootstrap admin email: $(jq -r '.AUTH_BOOTSTRAP_ADMIN_EMAIL' <<<"$prepared_json")"

if [[ "$reveal_bootstrap_password" == "true" ]]; then
  printf '%s\n' "Bootstrap admin password: $(jq -r '.AUTH_BOOTSTRAP_ADMIN_PASSWORD' <<<"$prepared_json")"
else
  printf '%s\n' "Bootstrap admin password is stored in the encrypted local store and was not printed. Use --reveal-bootstrap-password when you need to view it."
fi

if [[ "$(jq -r '.AUTH_SMTP_PASSWORD // ""' <<<"$prepared_json")" == "" && "$(jq -r '.NOTIFICATION_SMTP_PASSWORD // ""' <<<"$prepared_json")" == "" && "$(jq -r '.NOTIFICATION_FIREBASE_PRIVATE_KEY // ""' <<<"$prepared_json")" == "" && "$(jq -r '.FINANCE_RAZORPAY_KEY_SECRET // ""' <<<"$prepared_json")" == "" ]]; then
  printf '%s\n' "Optional third-party secrets are currently blank. Export them in your shell before rerunning this script if you need them."
fi
