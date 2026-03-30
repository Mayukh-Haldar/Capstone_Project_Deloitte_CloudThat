#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

rotate_generated_secrets=false
skip_build=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rotate-generated-secrets)
      rotate_generated_secrets=true
      shift
      ;;
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

assert_command_available() {
  local name="$1"
  local install_hint="$2"
  if ! command -v "$name" >/dev/null 2>&1; then
    printf '%s\n' "$name is not available on PATH. $install_hint" >&2
    exit 1
  fi
}

assert_command_available "docker" "Install Docker Engine / Docker Desktop and rerun this script."

if ! docker version >/dev/null 2>&1; then
  printf '%s\n' "Docker is installed but not responding. Start Docker and rerun this script." >&2
  exit 1
fi

set_secret_args=()
if [[ "$rotate_generated_secrets" == "true" ]]; then
  set_secret_args+=(--rotate-generated-secrets)
fi

start_args=()
if [[ "$skip_build" == "true" ]]; then
  start_args+=(--skip-build)
fi

printf '%s\n' "Preparing encrypted local Vault secret store..."
"$SCRIPT_DIR/set-local-vault-secrets.sh" "${set_secret_args[@]}"

printf '%s\n' "Starting Vault-backed local stack..."
"$SCRIPT_DIR/start-local-vault.sh" "${start_args[@]}"
