#!/usr/bin/env bash

set -euo pipefail

APP_ROOT="/opt/eventzen"
COMPOSE_DIR="$APP_ROOT/compose"
ENV_DIR="$APP_ROOT/env"
NGINX_DIR="$APP_ROOT/nginx"
DATA_DIR="$APP_ROOT/data"
LOG_DIR="$APP_ROOT/logs"
BIN_DIR="$APP_ROOT/bin"
AUTOSCALER_STATE_DIR="$APP_ROOT/autoscaler-state"
MYSQL_DIR="$DATA_DIR/mysql"
REDIS_DIR="$DATA_DIR/redis"
KAFKA_DIR="$DATA_DIR/kafka"
ZOOKEEPER_DIR="$DATA_DIR/zookeeper"
SWAP_FILE="/swapfile"
SWAP_SIZE_GB="${SWAP_SIZE_GB:-4}"
ADMIN_USER="${SUDO_USER:-ubuntu}"
INSTALL_CLOUDWATCH="${INSTALL_CLOUDWATCH:-false}"

log() {
  echo "[eventzen-bootstrap] $*"
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    echo "Please run this script as root or with sudo."
    exit 1
  fi
}

setup_packages() {
  log "Updating apt package index"
  apt-get update -y

  log "Installing base packages"
  apt-get install -y \
    ca-certificates \
    curl \
    git \
    gnupg \
    htop \
    jq \
    nginx \
    ufw \
    unzip
}

install_docker() {
  if command -v docker >/dev/null 2>&1; then
    log "Docker already installed"
    return
  fi

  log "Installing Docker"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc

  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
    ${VERSION_CODENAME} stable" | tee /etc/apt/sources.list.d/docker.list >/dev/null

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

  systemctl enable docker
  systemctl start docker
}

configure_user_access() {
  if id "$ADMIN_USER" >/dev/null 2>&1; then
    log "Adding $ADMIN_USER to docker group"
    usermod -aG docker "$ADMIN_USER" || true
  fi
}

create_layout() {
  log "Creating EventZen directory layout"
  mkdir -p \
    "$COMPOSE_DIR" \
    "$ENV_DIR" \
    "$NGINX_DIR" \
    "$BIN_DIR" \
    "$AUTOSCALER_STATE_DIR" \
    "$MYSQL_DIR" \
    "$REDIS_DIR" \
    "$KAFKA_DIR" \
    "$ZOOKEEPER_DIR" \
    "$LOG_DIR"

  chown -R "$ADMIN_USER":"$ADMIN_USER" "$APP_ROOT" || true
}

configure_swap() {
  if swapon --show | grep -q "$SWAP_FILE"; then
    log "Swap already configured"
    return
  fi

  if [[ -f "$SWAP_FILE" ]]; then
    log "Activating existing swap file"
    chmod 600 "$SWAP_FILE"
    mkswap "$SWAP_FILE" >/dev/null 2>&1 || true
    swapon "$SWAP_FILE"
  else
    log "Creating ${SWAP_SIZE_GB}G swap file"
    fallocate -l "${SWAP_SIZE_GB}G" "$SWAP_FILE" || dd if=/dev/zero of="$SWAP_FILE" bs=1G count="$SWAP_SIZE_GB"
    chmod 600 "$SWAP_FILE"
    mkswap "$SWAP_FILE"
    swapon "$SWAP_FILE"
  fi

  grep -q "^$SWAP_FILE" /etc/fstab || echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
}

configure_firewall() {
  log "Configuring UFW"
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
}

configure_nginx() {
  log "Enabling nginx"
  systemctl enable nginx
  systemctl start nginx
}

install_cloudwatch_agent() {
  if [[ "$INSTALL_CLOUDWATCH" != "true" ]]; then
    log "Skipping CloudWatch agent installation"
    return
  fi

  log "Installing CloudWatch agent"
  ARCH="$(dpkg --print-architecture)"
  TMP_DEB="/tmp/amazon-cloudwatch-agent.deb"

  if [[ "$ARCH" == "arm64" ]]; then
    curl -fsSL "https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/arm64/latest/amazon-cloudwatch-agent.deb" -o "$TMP_DEB"
  else
    curl -fsSL "https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb" -o "$TMP_DEB"
  fi

  dpkg -i "$TMP_DEB" || apt-get install -f -y
}

write_motd_hint() {
  cat >/etc/motd <<'EOF'
EventZen EC2 host prepared.

Primary directories:
  /opt/eventzen/compose
  /opt/eventzen/env
  /opt/eventzen/nginx
  /opt/eventzen/bin
  /opt/eventzen/data
  /opt/eventzen/logs

Next steps:
  1. Copy docker-compose.prod.yml into /opt/eventzen/compose
  2. Copy .env.prod into /opt/eventzen/env
  3. Copy the production nginx template into /opt/eventzen/nginx
  4. Copy deploy and autoscaler scripts into /opt/eventzen/bin
  5. Pull or build Docker images
  6. Start the stack with docker compose
EOF
}

main() {
  require_root
  setup_packages
  install_docker
  configure_user_access
  create_layout
  configure_swap
  configure_firewall
  configure_nginx
  install_cloudwatch_agent
  write_motd_hint

  log "Bootstrap complete"
  log "Log out and back in before using docker as $ADMIN_USER"
}

main "$@"
