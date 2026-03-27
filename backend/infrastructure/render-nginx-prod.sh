#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/eventzen}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_ROOT/compose/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/env/.env.prod}"
TEMPLATE_FILE="${TEMPLATE_FILE:-$APP_ROOT/nginx/nginx.prod.template.conf}"
OUTPUT_FILE="${OUTPUT_FILE:-$APP_ROOT/nginx/nginx.generated.conf}"
NGINX_SERVICE="${NGINX_SERVICE:-nginx}"
AUTH_RATE_LIMIT_RPS="${AUTH_RATE_LIMIT_RPS:-10}"
AUTH_RATE_LIMIT_BURST="${AUTH_RATE_LIMIT_BURST:-20}"
API_RATE_LIMIT_RPS="${API_RATE_LIMIT_RPS:-30}"
API_RATE_LIMIT_BURST="${API_RATE_LIMIT_BURST:-60}"
SERVICES=(
  "auth-service:8081:AUTH_UPSTREAM"
  "event-service:8082:EVENT_UPSTREAM"
  "venue-vendor-service:8083:VENUE_VENDOR_UPSTREAM"
  "ticketing-service:8084:TICKETING_UPSTREAM"
  "finance-service:8085:FINANCE_UPSTREAM"
  "notification-service:8086:NOTIFICATION_UPSTREAM"
)

log() {
  echo "[render-nginx-prod] $*"
}

require_file() {
  local file_path="$1"
  if [[ ! -f "$file_path" ]]; then
    echo "Required file missing: $file_path"
    exit 1
  fi
}

load_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$ENV_FILE" && set +a
  fi
}

get_project_name() {
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$NGINX_SERVICE" >/dev/null 2>&1 || true
  local nginx_id
  nginx_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$NGINX_SERVICE" | head -n 1 || true)"
  if [[ -n "$nginx_id" ]]; then
    docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$nginx_id"
    return
  fi

  local compose_dir
  compose_dir="$(dirname "$COMPOSE_FILE")"
  basename "$compose_dir"
}

get_compose_network() {
  local project_name="$1"
  local nginx_id
  nginx_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q "$NGINX_SERVICE" | head -n 1 || true)"
  if [[ -n "$nginx_id" ]]; then
    docker inspect -f '{{range $name, $_ := .NetworkSettings.Networks}}{{printf "%s\n" $name}}{{end}}' "$nginx_id" | head -n 1
    return
  fi

  echo "${project_name}_default"
}

get_upstream_block() {
  local project_name="$1"
  local network_name="$2"
  local service_name="$3"
  local service_port="$4"
  # Use Docker DNS service names instead of container IPs.
  # Container IPs change across restarts and can leave nginx with stale upstreams.
  printf '    server %s:%s max_fails=3 fail_timeout=30s;\n' "$service_name" "$service_port"
}

render_template() {
  local project_name network_name content service_name service_port placeholder upstream_block
  project_name="$(get_project_name)"
  network_name="$(get_compose_network "$project_name")"
  content="$(cat "$TEMPLATE_FILE")"

  for spec in "${SERVICES[@]}"; do
    IFS=':' read -r service_name service_port placeholder <<< "$spec"
    upstream_block="$(get_upstream_block "$project_name" "$network_name" "$service_name" "$service_port")"
    content="${content//__${placeholder}__/$upstream_block}"
  done

  content="${content//__AUTH_RATE_LIMIT_RPS__/$AUTH_RATE_LIMIT_RPS}"
  content="${content//__AUTH_RATE_LIMIT_BURST__/$AUTH_RATE_LIMIT_BURST}"
  content="${content//__API_RATE_LIMIT_RPS__/$API_RATE_LIMIT_RPS}"
  content="${content//__API_RATE_LIMIT_BURST__/$API_RATE_LIMIT_BURST}"

  printf '%s\n' "$content" > "$OUTPUT_FILE"
  log "Wrote $OUTPUT_FILE"
}

main() {
  require_file "$COMPOSE_FILE"
  require_file "$TEMPLATE_FILE"
  load_env_file
  render_template
}

main "$@"
