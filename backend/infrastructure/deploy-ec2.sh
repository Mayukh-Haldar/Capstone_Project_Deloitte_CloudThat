#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="${APP_ROOT:-/opt/eventzen}"
COMPOSE_DIR="$APP_ROOT/compose"
ENV_DIR="$APP_ROOT/env"
NGINX_DIR="$APP_ROOT/nginx"
BIN_DIR="$APP_ROOT/bin"
LOG_DIR="$APP_ROOT/logs"
COMPOSE_FILE="$COMPOSE_DIR/docker-compose.prod.yml"
ENV_FILE="$ENV_DIR/.env.prod"
NGINX_TEMPLATE_FILE="$NGINX_DIR/nginx.prod.template.conf"
NGINX_RENDERED_FILE="$NGINX_DIR/nginx.generated.conf"
RENDER_SCRIPT="$BIN_DIR/render-nginx-prod.sh"
AUTOSCALER_SCRIPT="$BIN_DIR/eventzen-autoscaler.sh"
AUTOSCALER_UNIT_SRC="$BIN_DIR/eventzen-autoscaler.service"
AUTOSCALER_UNIT_DST="/etc/systemd/system/eventzen-autoscaler.service"

log() {
  echo "[eventzen-deploy] $*"
}

require_file() {
  local file_path="$1"
  if [[ ! -f "$file_path" ]]; then
    echo "Required file missing: $file_path"
    exit 1
  fi
}

prepare_layout() {
  mkdir -p "$COMPOSE_DIR" "$ENV_DIR" "$NGINX_DIR" "$BIN_DIR" "$LOG_DIR"
}

sync_repo_files() {
  local repo_root
  repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

  log "Syncing compose and nginx config into $APP_ROOT"
  cp "$repo_root/docker-compose.prod.yml" "$COMPOSE_FILE"
  cp "$repo_root/backend/docker/nginx/nginx.prod.template.conf" "$NGINX_TEMPLATE_FILE"
  cp "$repo_root/backend/infrastructure/render-nginx-prod.sh" "$RENDER_SCRIPT"
  cp "$repo_root/backend/infrastructure/eventzen-autoscaler.sh" "$AUTOSCALER_SCRIPT"
  cp "$repo_root/backend/infrastructure/eventzen-autoscaler.service" "$AUTOSCALER_UNIT_SRC"
  chmod +x "$RENDER_SCRIPT" "$AUTOSCALER_SCRIPT"
}

write_env_permissions() {
  chmod 600 "$ENV_FILE"
}

login_ghcr() {
  if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
    log "Logging into GHCR"
    echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
  else
    log "Skipping GHCR login because GHCR credentials are not set"
  fi
}

pull_images() {
  log "Pulling latest images where available"
  docker compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" pull || true
}

render_nginx_config() {
  log "Rendering Nginx config"
  APP_ROOT="$APP_ROOT" COMPOSE_FILE="$COMPOSE_FILE" ENV_FILE="$ENV_FILE" TEMPLATE_FILE="$NGINX_TEMPLATE_FILE" OUTPUT_FILE="$NGINX_RENDERED_FILE" "$RENDER_SCRIPT"
}

build_images() {
  log "Building application images on host"
  (set -a && source "$ENV_FILE" && set +a && docker compose -f "$COMPOSE_FILE" build)
}

start_stack() {
  log "Starting EventZen stack"
  (set -a && source "$ENV_FILE" && set +a && docker compose -f "$COMPOSE_FILE" up -d)
}

reload_nginx() {
  log "Reloading Nginx with updated upstreams"
  render_nginx_config
  (set -a && source "$ENV_FILE" && set +a && docker compose -f "$COMPOSE_FILE" exec -T nginx nginx -s reload) || true
}

install_autoscaler_service() {
  log "Installing autoscaler systemd unit"
  sudo cp "$AUTOSCALER_UNIT_SRC" "$AUTOSCALER_UNIT_DST"
  sudo systemctl daemon-reload
  sudo systemctl enable --now eventzen-autoscaler.service
}

cleanup_images() {
  log "Pruning dangling Docker images"
  docker image prune -f || true
}

main() {
  prepare_layout
  sync_repo_files
  require_file "$COMPOSE_FILE"
  require_file "$ENV_FILE"
  require_file "$NGINX_TEMPLATE_FILE"
  write_env_permissions
  login_ghcr
  render_nginx_config
  pull_images
  build_images
  start_stack
  reload_nginx
  install_autoscaler_service
  cleanup_images
  log "Deployment complete"
}

main "$@"
