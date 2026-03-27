#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <ec2-user> <ec2-host> [ssh-key-path]"
  echo "Example: $0 ubuntu 3.110.10.20 ~/.ssh/eventzen.pem"
  exit 1
fi

EC2_USER="$1"
EC2_HOST="$2"
SSH_KEY_PATH="${3:-}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

REMOTE_TMP_DIR="/tmp/eventzen-upload"
REMOTE_COMPOSE_DIR="/opt/eventzen/compose"
REMOTE_NGINX_DIR="/opt/eventzen/nginx"

SSH_ARGS=()
if [[ -n "$SSH_KEY_PATH" ]]; then
  SSH_ARGS+=(-i "$SSH_KEY_PATH")
fi

log() {
  echo "[eventzen-upload] $*"
}

run_ssh() {
  ssh "${SSH_ARGS[@]}" "${EC2_USER}@${EC2_HOST}" "$@"
}

run_scp() {
  scp "${SSH_ARGS[@]}" "$@"
}

log "Creating remote temporary directory"
run_ssh "mkdir -p ${REMOTE_TMP_DIR}"

log "Uploading deployment files"
run_scp \
  "$REPO_ROOT/docker-compose.prod.yml" \
  "$REPO_ROOT/backend/docker/nginx/nginx.prod.template.conf" \
  "$REPO_ROOT/backend/infrastructure/render-nginx-prod.sh" \
  "$REPO_ROOT/backend/infrastructure/eventzen-autoscaler.sh" \
  "$REPO_ROOT/backend/infrastructure/eventzen-autoscaler.service" \
  "$REPO_ROOT/backend/infrastructure/deploy-ec2.sh" \
  "${EC2_USER}@${EC2_HOST}:${REMOTE_TMP_DIR}/"

log "Installing deployment files under /opt/eventzen"
run_ssh "sudo mkdir -p ${REMOTE_COMPOSE_DIR} ${REMOTE_NGINX_DIR} /opt/eventzen/bin && \
  sudo cp ${REMOTE_TMP_DIR}/docker-compose.prod.yml ${REMOTE_COMPOSE_DIR}/docker-compose.prod.yml && \
  sudo cp ${REMOTE_TMP_DIR}/nginx.prod.template.conf ${REMOTE_NGINX_DIR}/nginx.prod.template.conf && \
  sudo cp ${REMOTE_TMP_DIR}/render-nginx-prod.sh /opt/eventzen/bin/render-nginx-prod.sh && \
  sudo cp ${REMOTE_TMP_DIR}/eventzen-autoscaler.sh /opt/eventzen/bin/eventzen-autoscaler.sh && \
  sudo cp ${REMOTE_TMP_DIR}/eventzen-autoscaler.service /opt/eventzen/bin/eventzen-autoscaler.service && \
  sudo chmod +x /opt/eventzen/bin/render-nginx-prod.sh /opt/eventzen/bin/eventzen-autoscaler.sh && \
  sudo cp ${REMOTE_TMP_DIR}/deploy-ec2.sh ${REMOTE_COMPOSE_DIR}/deploy-ec2.sh && \
  sudo chmod +x ${REMOTE_COMPOSE_DIR}/deploy-ec2.sh"

log "Upload complete"
log "Note: .env.prod was intentionally not uploaded."
