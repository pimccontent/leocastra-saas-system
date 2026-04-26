#!/usr/bin/env bash
set -euo pipefail

REPO_DEFAULT="https://github.com/pimccontent/leocastra-saas-system.git"
INSTALL_DIR_DEFAULT="/opt/leocastra-saas-system"

usage() {
  cat <<'EOF'
LeoCastra SaaS licensing system — Ubuntu one-command installer

Usage:
  curl -fsSL https://raw.githubusercontent.com/pimccontent/leocastra-saas-system/main/deploy/ubuntu-one-command.sh | sudo bash -s -- \
    --api-domain saas-api.example.com \
    [--web-domain saas.example.com] \
    [--repo URL] [--dir /opt/leocastra-saas-system] \
    [--superadmin-email you@example.com] [--superadmin-password '...'] \
    [--backend-port 3001] [--web-port 3000]

Notes:
  - Requires Ubuntu with apt and outbound internet access.
  - Installs Docker Engine + Compose plugin if missing.
  - Generates strong secrets for DB + JWT if not provided.
  - Sets SAAS_PUBLIC_API_URL to https://<api-domain>/api (used at Next.js build time).
EOF
}

API_DOMAIN=""
WEB_DOMAIN=""
REPO_URL="$REPO_DEFAULT"
INSTALL_DIR="$INSTALL_DIR_DEFAULT"
SUPERADMIN_EMAIL="${SUPERADMIN_EMAIL:-superadmin@leocastra.local}"
SUPERADMIN_PASSWORD="${SUPERADMIN_PASSWORD:-}"
BACKEND_PORT="${BACKEND_PORT:-3001}"
WEB_PORT="${WEB_PORT:-3000}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-domain) API_DOMAIN="${2:-}"; shift 2 ;;
    --web-domain) WEB_DOMAIN="${2:-}"; shift 2 ;;
    --repo) REPO_URL="${2:-}"; shift 2 ;;
    --dir) INSTALL_DIR="${2:-}"; shift 2 ;;
    --superadmin-email) SUPERADMIN_EMAIL="${2:-}"; shift 2 ;;
    --superadmin-password) SUPERADMIN_PASSWORD="${2:-}"; shift 2 ;;
    --backend-port) BACKEND_PORT="${2:-}"; shift 2 ;;
    --web-port) WEB_PORT="${2:-}"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ -z "$API_DOMAIN" ]]; then
  echo "ERROR: --api-domain is required (example: saas-api.example.com)" >&2
  usage
  exit 2
fi

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "ERROR: run as root (use sudo)." >&2
  exit 2
fi

export DEBIAN_FRONTEND=noninteractive

if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg lsb-release git

  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${VERSION_CODENAME:-}") stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin not available after install." >&2
  exit 1
fi

mkdir -p "$(dirname "$INSTALL_DIR")"
if [[ ! -d "$INSTALL_DIR/.git" ]]; then
  rm -rf "$INSTALL_DIR"
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

if [[ ! -f ".env.saas-live" ]]; then
  if [[ ! -f ".env.saas-live.example" ]]; then
    echo "ERROR: missing .env.saas-live.example in repo checkout." >&2
    exit 1
  fi

  SAAS_DB_NAME="leocastra_saas"
  SAAS_DB_USER="saas_user"
  SAAS_DB_PASSWORD="${SAAS_DB_PASSWORD:-$(openssl rand -hex 24)}"
  AUTH_JWT_SECRET="${AUTH_JWT_SECRET:-$(openssl rand -hex 32)}"
  if [[ -z "$SUPERADMIN_PASSWORD" ]]; then
    SUPERADMIN_PASSWORD="$(openssl rand -base64 24 | tr -d '\n' | tr '+/' '-_')"
  fi

  SAAS_PUBLIC_API_URL="https://${API_DOMAIN}/api"

  cat >".env.saas-live" <<EOF
SAAS_DB_NAME=${SAAS_DB_NAME}
SAAS_DB_USER=${SAAS_DB_USER}
SAAS_DB_PASSWORD=${SAAS_DB_PASSWORD}

SAAS_PUBLIC_API_URL=${SAAS_PUBLIC_API_URL}

SAAS_BACKEND_PORT=${BACKEND_PORT}
SAAS_WEB_PORT=${WEB_PORT}

AUTH_JWT_SECRET=${AUTH_JWT_SECRET}
SUPERADMIN_EMAIL=${SUPERADMIN_EMAIL}
SUPERADMIN_PASSWORD=${SUPERADMIN_PASSWORD}

PAYSTACK_WEBHOOK_SECRET=
BINANCEPAY_WEBHOOK_SECRET=
EOF

  chmod 600 ".env.saas-live"
  echo "Wrote ${INSTALL_DIR}/.env.saas-live (chmod 600)."
fi

docker compose --env-file .env.saas-live -f docker-compose.saas-live.yml up -d --build

echo
echo "Install complete."
echo "- Web:  http://127.0.0.1:${WEB_PORT} (bind all interfaces)"
echo "- API:  http://127.0.0.1:${BACKEND_PORT}/api"
echo "- Public API URL baked into web build: https://${API_DOMAIN}/api"
echo
echo "Next steps:"
echo "- Put TLS reverse proxy in front (recommended):"
echo "  - https://${API_DOMAIN} -> http://127.0.0.1:${BACKEND_PORT}"
if [[ -n "$WEB_DOMAIN" ]]; then
  echo "  - https://${WEB_DOMAIN} -> http://127.0.0.1:${WEB_PORT}"
else
  echo "  - (optional) https://<your-web-domain> -> http://127.0.0.1:${WEB_PORT}"
fi
echo "- Point your live LeoCastra backend LICENSE_VALIDATE_URL to:"
echo "  https://${API_DOMAIN}/api/license/validate"
echo
echo "Superadmin login (from .env.saas-live):"
echo "- Email: ${SUPERADMIN_EMAIL}"
echo "- Password: (saved in ${INSTALL_DIR}/.env.saas-live)"
