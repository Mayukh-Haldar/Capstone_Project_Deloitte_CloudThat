#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/eventzen}"
COMPOSE_FILE="${COMPOSE_FILE:-$APP_ROOT/compose/docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-$APP_ROOT/env/.env.prod}"
STATE_DIR="${STATE_DIR:-$APP_ROOT/autoscaler-state}"
RENDER_SCRIPT="${RENDER_SCRIPT:-$APP_ROOT/bin/render-nginx-prod.sh}"
CHECK_INTERVAL_SECONDS="${AUTOSCALER_INTERVAL_SECONDS:-60}"
COOLDOWN_SECONDS="${AUTOSCALER_COOLDOWN_SECONDS:-180}"
SCALE_UP_THRESHOLD="${AUTOSCALER_SCALE_UP_THRESHOLD:-75}"
SCALE_DOWN_THRESHOLD="${AUTOSCALER_SCALE_DOWN_THRESHOLD:-25}"
SERVICES=(
  "auth-service:AUTH_SERVICE"
  "event-service:EVENT_SERVICE"
  "venue-vendor-service:VENUE_VENDOR_SERVICE"
  "ticketing-service:TICKETING_SERVICE"
  "finance-service:FINANCE_SERVICE"
  "notification-service:NOTIFICATION_SERVICE"
)

log() {
  echo "[eventzen-autoscaler] $*"
}

load_env_file() {
  if [[ -f "$ENV_FILE" ]]; then
    # shellcheck disable=SC1090
    set -a && source "$ENV_FILE" && set +a
  fi
}

ensure_state_dir() {
  mkdir -p "$STATE_DIR"
}

get_project_name() {
  local nginx_id
  nginx_id="$(docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" ps -q nginx | head -n 1 || true)"
  if [[ -n "$nginx_id" ]]; then
    docker inspect -f '{{ index .Config.Labels "com.docker.compose.project" }}' "$nginx_id"
    return
  fi

  local compose_dir
  compose_dir="$(dirname "$COMPOSE_FILE")"
  basename "$compose_dir"
}

get_container_ids() {
  local project_name="$1"
  local service_name="$2"
  docker ps -q \
    --filter "label=com.docker.compose.project=$project_name" \
    --filter "label=com.docker.compose.service=$service_name"
}

get_replica_count() {
  local ids="$1"
  if [[ -z "$ids" ]]; then
    echo 0
    return
  fi

  echo "$ids" | sed '/^$/d' | wc -l | tr -d ' '
}

get_average_cpu() {
  local ids="$1"
  if [[ -z "$ids" ]]; then
    echo 0
    return
  fi

  local stats_output count
  stats_output="$(docker stats --no-stream --format '{{.Container}} {{.CPUPerc}}' $(echo "$ids" | tr '\n' ' '))"
  count=0

  awk '
    {
      gsub("%", "", $2)
      sum += $2
      count += 1
    }
    END {
      if (count == 0) {
        print 0
      } else {
        printf "%.2f\n", sum / count
      }
    }
  ' <<< "$stats_output"
}

can_scale_now() {
  local state_file="$1"
  if [[ ! -f "$state_file" ]]; then
    return 0
  fi

  local last_scaled now
  last_scaled="$(cat "$state_file")"
  now="$(date +%s)"
  [[ $((now - last_scaled)) -ge $COOLDOWN_SECONDS ]]
}

mark_scaled() {
  local state_file="$1"
  date +%s > "$state_file"
}

get_min_replicas() {
  local prefix="$1"
  local var_name="${prefix}_MIN_REPLICAS"
  local value="${!var_name:-2}"
  echo "$value"
}

get_max_replicas() {
  local prefix="$1"
  local var_name="${prefix}_MAX_REPLICAS"
  local value="${!var_name:-4}"
  echo "$value"
}

scale_service() {
  local service_name="$1"
  local desired_replicas="$2"
  log "Scaling $service_name to $desired_replicas replicas"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" up -d --no-deps --scale "$service_name=$desired_replicas" "$service_name"
}

reload_nginx() {
  "$RENDER_SCRIPT"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" exec -T nginx nginx -s reload
}

autoscale_once() {
  local project_name
  project_name="$(get_project_name)"

  local service_name prefix ids replica_count avg_cpu min_replicas max_replicas desired_replicas state_file scaled_any
  scaled_any=false

  for spec in "${SERVICES[@]}"; do
    IFS=':' read -r service_name prefix <<< "$spec"
    ids="$(get_container_ids "$project_name" "$service_name")"
    replica_count="$(get_replica_count "$ids")"
    avg_cpu="$(get_average_cpu "$ids")"
    min_replicas="$(get_min_replicas "$prefix")"
    max_replicas="$(get_max_replicas "$prefix")"
    desired_replicas="$replica_count"
    state_file="$STATE_DIR/${service_name}.last_scaled"

    if (( replica_count < min_replicas )); then
      desired_replicas="$min_replicas"
    elif awk "BEGIN { exit !($avg_cpu >= $SCALE_UP_THRESHOLD) }"; then
      if (( replica_count < max_replicas )) && can_scale_now "$state_file"; then
        desired_replicas=$((replica_count + 1))
      fi
    elif awk "BEGIN { exit !($avg_cpu <= $SCALE_DOWN_THRESHOLD) }"; then
      if (( replica_count > min_replicas )) && can_scale_now "$state_file"; then
        desired_replicas=$((replica_count - 1))
      fi
    fi

    log "$service_name replicas=$replica_count avg_cpu=$avg_cpu min=$min_replicas max=$max_replicas desired=$desired_replicas"

    if [[ "$desired_replicas" != "$replica_count" ]]; then
      scale_service "$service_name" "$desired_replicas"
      mark_scaled "$state_file"
      scaled_any=true
    fi
  done

  if [[ "$scaled_any" == "true" ]]; then
    reload_nginx
  fi
}

main() {
  ensure_state_dir
  load_env_file

  if [[ "${AUTOSCALER_ENABLED:-true}" != "true" ]]; then
    log "Autoscaler disabled; exiting"
    exit 0
  fi

  while true; do
    autoscale_once
    sleep "$CHECK_INTERVAL_SECONDS"
  done
}

main "$@"
