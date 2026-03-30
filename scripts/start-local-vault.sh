#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOCAL_VAULT_PORTS_PATH="$REPO_ROOT/.secrets/local-vault-ports.json"

# shellcheck source=./vault/local-secret-store.sh
source "$SCRIPT_DIR/vault/local-secret-store.sh"

skip_build=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      skip_build=true
      shift
      ;;
    *)
      printf '%s\n' "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

eventzen_assert_command_available "docker" "Install Docker and rerun the script."
eventzen_assert_command_available "jq" "Install jq and rerun the script."
eventzen_assert_command_available "ss" "Install iproute2 and rerun the script."

if ! eventzen_test_local_secret_store; then
  printf '%s\n' "Encrypted local Vault secret store not found. Initializing it now..."
  "$SCRIPT_DIR/set-local-vault-secrets.sh"
fi

store_passphrase="$(eventzen_prompt_passphrase 'Enter the local Vault secret-store passphrase: ')"
local_secret_values="$(eventzen_read_local_secret_store_json "$store_passphrase")"
eventzen_assert_local_secret_values "$local_secret_values"
eventzen_set_secrets_to_process_environment "$local_secret_values"

set_default_env() {
  local name="$1"
  local value="$2"
  export "$name=${!name:-$value}"
}

port_is_available() {
  local port="$1"
  if ss -ltnH "( sport = :$port )" 2>/dev/null | grep -q .; then
    return 1
  fi
  return 0
}

find_available_port() {
  local preferred="$1"
  local fallback_start="$2"
  shift 2
  local reserved_ports=("$@")
  local candidate

  for candidate in "$preferred"; do
    if [[ " ${reserved_ports[*]} " == *" $candidate "* ]]; then
      continue
    fi
    if port_is_available "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  for ((candidate=fallback_start; candidate<=65535; candidate++)); do
    if [[ " ${reserved_ports[*]} " == *" $candidate "* ]]; then
      continue
    fi
    if port_is_available "$candidate"; then
      printf '%s\n' "$candidate"
      return 0
    fi
  done

  printf '%s\n' "Unable to find an available TCP port starting from $fallback_start" >&2
  return 1
}

localhost_url() {
  local port="$1"
  if [[ "$port" == "80" ]]; then
    printf '%s\n' "http://localhost"
  else
    printf 'http://localhost:%s\n' "$port"
  fi
}

set_default_env NGINX_PORT 80
set_default_env MYSQL_PORT 13306
set_default_env MONGODB_PORT 27018
set_default_env MINIO_API_PORT 9000
set_default_env MINIO_CONSOLE_PORT 9001
set_default_env ZOOKEEPER_PORT 2181
set_default_env KAFKA_PORT 9092
set_default_env KAFKA_UI_PORT 8091
set_default_env KAFKA_EXTERNAL_HOST localhost
set_default_env PROMETHEUS_PORT 9090
set_default_env LOKI_HOST_PORT 3301
set_default_env TEMPO_HOST_PORT 3300
set_default_env OTEL_GRPC_PORT 4317
set_default_env OTEL_HTTP_PORT 4318
set_default_env OTEL_METRICS_PORT 8888
set_default_env GRAFANA_HOST_PORT 3308
set_default_env VAULT_PORT 8200

port_settings=(
  "NGINX_PORT:80:8080:Nginx"
  "MYSQL_PORT:13306:13306:MySQL"
  "MONGODB_PORT:27018:27018:MongoDB"
  "MINIO_API_PORT:9000:19000:MinIO API"
  "MINIO_CONSOLE_PORT:9001:19001:MinIO Console"
  "ZOOKEEPER_PORT:2181:12181:Zookeeper"
  "KAFKA_PORT:9092:19092:Kafka"
  "KAFKA_UI_PORT:8091:18091:Kafka UI"
  "PROMETHEUS_PORT:9090:19090:Prometheus"
  "LOKI_HOST_PORT:3301:13301:Loki"
  "TEMPO_HOST_PORT:3300:13300:Tempo"
  "OTEL_GRPC_PORT:4317:14317:OTel gRPC"
  "OTEL_HTTP_PORT:4318:14318:OTel HTTP"
  "OTEL_METRICS_PORT:8888:18888:OTel Metrics"
  "GRAFANA_HOST_PORT:3308:13308:Grafana"
  "VAULT_PORT:8200:18200:Vault"
)

reserved_ports=()
changes=()
port_state='{}'

for setting in "${port_settings[@]}"; do
  IFS=":" read -r key default_port fallback_start label <<<"$setting"
  current_port="${!key:-$default_port}"
  resolved_port="$(find_available_port "$current_port" "$fallback_start" "${reserved_ports[@]}")"
  reserved_ports+=("$resolved_port")
  export "$key=$resolved_port"
  port_state="$(jq --arg key "$key" --argjson value "$resolved_port" '. + {($key): $value}' <<<"$port_state")"
  if [[ "$resolved_port" != "$current_port" ]]; then
    changes+=("$label: $current_port -> $resolved_port")
  fi
done

minio_bucket="${MINIO_BUCKET:-eventzen-media}"
public_base_url="$(localhost_url "$NGINX_PORT")"
minio_public_base_url="$(localhost_url "$MINIO_API_PORT")/$minio_bucket"

export FRONTEND_ORIGIN="$public_base_url"
export AUTH_APP_BASE_URL="$public_base_url"
export VITE_SITE_URL="$public_base_url"
export MINIO_PUBLIC_BASE_URL="$minio_public_base_url"

mkdir -p "$(dirname "$LOCAL_VAULT_PORTS_PATH")"
printf '%s\n' "$port_state" >"$LOCAL_VAULT_PORTS_PATH"

if [[ ${#changes[@]} -gt 0 ]]; then
  printf '%s\n' "Updated environment with safe host ports:"
  printf '  %s\n' "${changes[@]}"
else
  printf '%s\n' "All configured host ports are available."
fi

compose_args=(-f "$REPO_ROOT/docker-compose.yml" -f "$REPO_ROOT/docker-compose.vault.yml" up -d)
if [[ "$skip_build" != "true" ]]; then
  compose_args+=(--build)
fi

printf '%s\n' "Starting Docker Compose stack with local HashiCorp Vault..."
docker compose "${compose_args[@]}"
printf '%s\n' "Vault UI: http://localhost:${VAULT_PORT}/ui"
printf '%s\n' "Vault-backed local stack started. Secrets were loaded from your encrypted local store, seeded into Vault, and rendered to in-memory tmpfs volumes."
