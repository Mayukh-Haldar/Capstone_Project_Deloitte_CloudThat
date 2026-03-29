#!/bin/sh
set -eu

export VAULT_ADDR="${VAULT_ADDR:-http://vault:8200}"
export VAULT_TOKEN="${VAULT_TOKEN:?VAULT_TOKEN is required}"

until vault status >/dev/null 2>&1; do
  sleep 2
done

mkdir -p /vault/approle
vault read -field=role_id auth/approle/role/eventzen-local/role-id > /vault/approle/role-id
vault write -wrap-ttl=30m -field=wrapping_token -f auth/approle/role/eventzen-local/secret-id > /vault/approle/secret-id
chmod 0400 /vault/approle/role-id /vault/approle/secret-id