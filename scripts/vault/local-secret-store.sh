#!/usr/bin/env bash

set -euo pipefail

EVENTZEN_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EVENTZEN_SECRET_STORE_DIRECTORY="$EVENTZEN_REPO_ROOT/.secrets"
EVENTZEN_SECRET_STORE_PATH="$EVENTZEN_SECRET_STORE_DIRECTORY/local-vault-secrets.enc"
EVENTZEN_SECRET_STORE_EXAMPLE_PATH="$EVENTZEN_SECRET_STORE_DIRECTORY/local-vault-secrets.dpapi.example.json"

eventzen_local_secret_store_path() {
  printf '%s\n' "$EVENTZEN_SECRET_STORE_PATH"
}

eventzen_local_secret_store_example_path() {
  printf '%s\n' "$EVENTZEN_SECRET_STORE_EXAMPLE_PATH"
}

eventzen_managed_secret_keys() {
  cat <<'EOF'
VAULT_DEV_ROOT_TOKEN_ID
MYSQL_ROOT_PASSWORD
MINIO_ROOT_PASSWORD
GRAFANA_ADMIN_PASSWORD
AUTH_DB_PASSWORD
EVENT_DB_PASSWORD
FINANCE_DB_PASSWORD
AUTH_JWT_SECRET
AUTH_CRYPTO_SECRET
AUTH_BOOTSTRAP_ADMIN_EMAIL
AUTH_BOOTSTRAP_ADMIN_PASSWORD
NOTIFICATION_INTERNAL_SERVICE_KEY
TICKETING_INTERNAL_SERVICE_KEY
VENUE_VENDOR_INTERNAL_SERVICE_KEY
AUTH_SMTP_USERNAME
AUTH_SMTP_PASSWORD
NOTIFICATION_SMTP_USERNAME
NOTIFICATION_SMTP_PASSWORD
NOTIFICATION_FIREBASE_PROJECT_ID
NOTIFICATION_FIREBASE_CLIENT_EMAIL
NOTIFICATION_FIREBASE_PRIVATE_KEY
FINANCE_RAZORPAY_KEY_ID
FINANCE_RAZORPAY_KEY_SECRET
EOF
}

eventzen_required_secret_keys() {
  cat <<'EOF'
VAULT_DEV_ROOT_TOKEN_ID
MYSQL_ROOT_PASSWORD
MINIO_ROOT_PASSWORD
GRAFANA_ADMIN_PASSWORD
AUTH_DB_PASSWORD
EVENT_DB_PASSWORD
FINANCE_DB_PASSWORD
AUTH_JWT_SECRET
AUTH_CRYPTO_SECRET
AUTH_BOOTSTRAP_ADMIN_EMAIL
AUTH_BOOTSTRAP_ADMIN_PASSWORD
NOTIFICATION_INTERNAL_SERVICE_KEY
TICKETING_INTERNAL_SERVICE_KEY
VENUE_VENDOR_INTERNAL_SERVICE_KEY
EOF
}

eventzen_assert_command_available() {
  local name="$1"
  local install_hint="${2:-Install the required package and rerun the script.}"
  if ! command -v "$name" >/dev/null 2>&1; then
    printf '%s\n' "$name is not available on PATH. $install_hint" >&2
    return 1
  fi
}

eventzen_random_secret() {
  local byte_length="${1:-32}"
  openssl rand -base64 "$byte_length" | tr '+/' '-_' | tr -d '=\n'
}

eventzen_default_secret_value() {
  local key="$1"

  case "$key" in
    VAULT_DEV_ROOT_TOKEN_ID) printf 'eventzen-root-%s\n' "$(eventzen_random_secret 18)" ;;
    AUTH_JWT_SECRET|AUTH_CRYPTO_SECRET) eventzen_random_secret 48; printf '\n' ;;
    AUTH_BOOTSTRAP_ADMIN_EMAIL) printf 'admin@eventzen.local\n' ;;
    AUTH_BOOTSTRAP_ADMIN_PASSWORD) eventzen_random_secret 24; printf '\n' ;;
    AUTH_SMTP_USERNAME|AUTH_SMTP_PASSWORD|NOTIFICATION_SMTP_USERNAME|NOTIFICATION_SMTP_PASSWORD|NOTIFICATION_FIREBASE_PROJECT_ID|NOTIFICATION_FIREBASE_CLIENT_EMAIL|NOTIFICATION_FIREBASE_PRIVATE_KEY|FINANCE_RAZORPAY_KEY_ID|FINANCE_RAZORPAY_KEY_SECRET)
      printf '\n'
      ;;
    *)
      eventzen_random_secret 32
      printf '\n'
      ;;
  esac
}

eventzen_prompt_passphrase() {
  local prompt_text="${1:-Enter the local Vault secret-store passphrase: }"
  local passphrase="${EVENTZEN_LOCAL_VAULT_PASSPHRASE:-}"

  if [[ -n "$passphrase" ]]; then
    printf '%s' "$passphrase"
    return 0
  fi

  read -r -s -p "$prompt_text" passphrase
  printf '\n' >&2
  if [[ -z "$passphrase" ]]; then
    printf '%s\n' "A non-empty passphrase is required." >&2
    return 1
  fi

  printf '%s' "$passphrase"
}

eventzen_resolve_env_file_path() {
  local input_path="$1"
  if [[ "$input_path" = /* ]]; then
    printf '%s\n' "$input_path"
  else
    printf '%s/%s\n' "$EVENTZEN_REPO_ROOT" "$input_path"
  fi
}

eventzen_env_file_entries_json() {
  local env_path="$1"
  if [[ ! -f "$env_path" ]]; then
    printf '%s\n' "Env file not found: $env_path" >&2
    return 1
  fi

  python3 - "$env_path" <<'PY'
import json
import sys

path = sys.argv[1]
entries = {}
with open(path, encoding="utf-8") as handle:
    for raw_line in handle:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in ("'", '"'):
            value = value[1:-1]
        entries[key] = value

print(json.dumps(entries))
PY
}

eventzen_merge_json_objects() {
  jq -s 'reduce .[] as $item ({}; . * $item)' "$@"
}

eventzen_secret_defaults_json() {
  local json='{}'
  local key value
  while IFS= read -r key; do
    value="$(eventzen_default_secret_value "$key")"
    json="$(jq --arg key "$key" --arg value "$value" '. + {($key): $value}' <<<"$json")"
  done < <(eventzen_managed_secret_keys)
  printf '%s\n' "$json"
}

eventzen_environment_secret_overrides_json() {
  local json='{}'
  local key value
  while IFS= read -r key; do
    if [[ ${!key+x} ]]; then
      value="${!key}"
      json="$(jq --arg key "$key" --arg value "$value" '. + {($key): $value}' <<<"$json")"
    fi
  done < <(eventzen_managed_secret_keys)
  printf '%s\n' "$json"
}

eventzen_env_file_secret_overrides_json() {
  local env_path="$1"
  local entries_json
  entries_json="$(eventzen_env_file_entries_json "$env_path")"
  jq -n \
    --argjson entries "$entries_json" \
    --argjson keys "$(eventzen_managed_secret_keys | jq -R . | jq -s .)" \
    '
      reduce $keys[] as $key
        ({};
         if $entries[$key] != null then . + {($key): $entries[$key]} else . end)
    '
}

eventzen_test_local_secret_store() {
  [[ -f "$EVENTZEN_SECRET_STORE_PATH" ]]
}

eventzen_write_local_secret_store() {
  local json_payload="$1"
  local passphrase="${2:-}"

  mkdir -p "$EVENTZEN_SECRET_STORE_DIRECTORY"
  umask 077
  printf '%s' "$json_payload" | openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:$passphrase" -out "$EVENTZEN_SECRET_STORE_PATH"
  chmod 600 "$EVENTZEN_SECRET_STORE_PATH"
}

eventzen_read_local_secret_store_json() {
  local passphrase="${1:-}"
  local output_file error_file
  if [[ ! -f "$EVENTZEN_SECRET_STORE_PATH" ]]; then
    return 1
  fi
  output_file="$(mktemp)"
  error_file="$(mktemp)"
  if ! openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:$passphrase" -in "$EVENTZEN_SECRET_STORE_PATH" -out "$output_file" 2>"$error_file"; then
    rm -f "$output_file"
    if grep -qi "bad decrypt" "$error_file"; then
      rm -f "$error_file"
      printf '%s\n' "Unable to decrypt $(eventzen_local_secret_store_path). The passphrase does not match the existing local Vault secret store." >&2
      return 1
    fi
    cat "$error_file" >&2
    rm -f "$error_file"
    return 1
  fi
  cat "$output_file"
  rm -f "$output_file" "$error_file"
}

eventzen_assert_local_secret_values() {
  local json_payload="$1"
  local missing=()
  local key value
  while IFS= read -r key; do
    value="$(jq -r --arg key "$key" '.[$key] // ""' <<<"$json_payload")"
    if [[ -z "$value" ]]; then
      missing+=("$key")
    fi
  done < <(eventzen_required_secret_keys)

  if [[ ${#missing[@]} -gt 0 ]]; then
    printf '%s\n' "Local secret store is missing required keys: ${missing[*]}" >&2
    return 1
  fi
}

eventzen_set_secrets_to_process_environment() {
  local json_payload="$1"
  local key value
  while IFS= read -r key; do
    value="$(jq -r --arg key "$key" '.[$key] // ""' <<<"$json_payload")"
    export "$key=$value"
  done < <(jq -r 'keys[]' <<<"$json_payload")
}
