#!/usr/bin/env bash
set -euo pipefail

REPO_DEFAULT="https://github.com/pimccontent/leocastra-saas-system.git"
INSTALL_DIR_DEFAULT="/opt/leocastra-saas-system"

require_root() {
  if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
    echo "ERROR: run as root (use sudo)." >&2
    exit 2
  fi
}

ubuntu_codename() {
  local code=""
  code="$(. /etc/os-release 2>/dev/null && echo "${VERSION_CODENAME:-}")" || true
  if [[ -z "$code" ]] && command -v lsb_release >/dev/null 2>&1; then
    code="$(lsb_release -cs 2>/dev/null || true)"
  fi
  echo "$code"
}

usage() {
  cat <<'EOF'
LeoCastra SaaS licensing system — Ubuntu one-command installer

Usage:
  curl -fsSL https://raw.githubusercontent.com/pimccontent/leocastra-saas-system/main/deploy/ubuntu-one-command.sh | sudo bash -s -- \
    --api-domain saas-api.example.com \
    [--web-domain saas.example.com] \
    [--single-domain saas.example.com] \
    [--no-https] [--caddy-email you@example.com] \
    [--show-superadmin-credentials] \
    [--repo URL] [--dir /opt/leocastra-saas-system] \
    [--superadmin-email you@example.com] [--superadmin-password '...'] \
    [--backend-port 3001] [--web-port 3000]

Notes:
  - Requires Ubuntu with apt and outbound internet access.
  - Installs Docker Engine + Compose plugin if missing.
  - Installs and configures Caddy (reverse proxy + automatic HTTPS).
  - Generates strong secrets for DB + JWT if not provided.
  - Sets SAAS_PUBLIC_API_URL to the public HTTPS URL (used at Next.js build time).
EOF
}

API_DOMAIN=""
WEB_DOMAIN=""
SINGLE_DOMAIN=""
NO_HTTPS="false"
CADDY_EMAIL="${CADDY_EMAIL:-}"
SHOW_SUPERADMIN_CREDENTIALS="false"
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
    --single-domain) SINGLE_DOMAIN="${2:-}"; shift 2 ;;
    --no-https) NO_HTTPS="true"; shift 1 ;;
    --caddy-email) CADDY_EMAIL="${2:-}"; shift 2 ;;
    --show-superadmin-credentials) SHOW_SUPERADMIN_CREDENTIALS="true"; shift 1 ;;
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

if [[ -n "$SINGLE_DOMAIN" ]] && [[ -n "$WEB_DOMAIN" ]]; then
  echo "ERROR: use either --single-domain OR --web-domain, not both." >&2
  usage
  exit 2
fi

require_root

export DEBIAN_FRONTEND=noninteractive

apt-get update -y
apt-get install -y ca-certificates curl git openssl gnupg lsb-release

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg

  UBUNTU_CODENAME="$(ubuntu_codename)"
  if [[ -z "${UBUNTU_CODENAME}" ]]; then
    echo "ERROR: could not detect Ubuntu codename (VERSION_CODENAME)." >&2
    exit 1
  fi

  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu ${UBUNTU_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list

  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable --now docker
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "ERROR: docker compose plugin not available after install." >&2
  exit 1
fi

install_caddy_if_needed() {
  if command -v caddy >/dev/null 2>&1; then
    return 0
  fi

  # Install Caddy from the official Cloudsmith repo.
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" \
    > /etc/apt/sources.list.d/caddy-stable.list

  apt-get update -y
  apt-get install -y caddy

  if ! command -v caddy >/dev/null 2>&1; then
    echo "ERROR: Caddy install did not provide the 'caddy' binary." >&2
    echo "Hints:" >&2
    echo "- Check outbound connectivity to dl.cloudsmith.io" >&2
    echo "- If you are behind restrictive egress, rerun with --no-https" >&2
    exit 1
  fi

  systemctl enable --now caddy || true
  if ! systemctl list-unit-files | grep -q '^caddy\.service'; then
    echo "ERROR: caddy.service was not installed (systemd unit missing)." >&2
    echo "Rerun with --no-https to skip HTTPS, or install Caddy manually." >&2
    exit 1
  fi
}

write_caddyfile() {
  local api_upstream="127.0.0.1:${BACKEND_PORT}"
  local web_upstream="127.0.0.1:${WEB_PORT}"

  if [[ -n "$SINGLE_DOMAIN" ]]; then
    cat >/etc/caddy/Caddyfile <<EOF
${SINGLE_DOMAIN} {
  encode gzip

  handle /api/* {
    reverse_proxy ${api_upstream}
  }

  reverse_proxy ${web_upstream}
}
EOF
    return 0
  fi

  if [[ -n "$WEB_DOMAIN" ]]; then
    cat >/etc/caddy/Caddyfile <<EOF
${API_DOMAIN} {
  encode gzip
  reverse_proxy ${api_upstream}
}

${WEB_DOMAIN} {
  encode gzip
  reverse_proxy ${web_upstream}
}
EOF
    return 0
  fi

  cat >/etc/caddy/Caddyfile <<EOF
${API_DOMAIN} {
  encode gzip
  reverse_proxy ${api_upstream}
}
EOF
}

configure_firewall_if_ufw() {
  if ! command -v ufw >/dev/null 2>&1; then
    return 0
  fi
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
}

mkdir -p "$(dirname "$INSTALL_DIR")"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  git -C "$INSTALL_DIR" fetch --all --prune
  git -C "$INSTALL_DIR" reset --hard origin/main
else
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

  if [[ -n "$SINGLE_DOMAIN" ]]; then
    SAAS_PUBLIC_API_URL="https://${SINGLE_DOMAIN}/api"
    CORS_ORIGINS="https://${SINGLE_DOMAIN}"
  elif [[ -n "$WEB_DOMAIN" ]]; then
    SAAS_PUBLIC_API_URL="https://${API_DOMAIN}/api"
    CORS_ORIGINS="https://${WEB_DOMAIN}"
  else
    SAAS_PUBLIC_API_URL="https://${API_DOMAIN}/api"
    CORS_ORIGINS=""
  fi

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

CORS_ORIGINS=${CORS_ORIGINS}

PAYSTACK_WEBHOOK_SECRET=
BINANCEPAY_WEBHOOK_SECRET=
EOF

  chmod 600 ".env.saas-live"
  echo "Wrote ${INSTALL_DIR}/.env.saas-live (chmod 600)."
fi

docker compose --env-file .env.saas-live -f docker-compose.saas-live.yml up -d --build

if [[ "${NO_HTTPS}" != "true" ]]; then
  install_caddy_if_needed
  write_caddyfile
  if [[ -n "${CADDY_EMAIL}" ]]; then
    mkdir -p /etc/caddy
    if ! grep -q '^{' /etc/caddy/Caddyfile 2>/dev/null; then
      printf "{\n  email %s\n}\n\n" "${CADDY_EMAIL}" | cat - /etc/caddy/Caddyfile > /etc/caddy/Caddyfile.tmp
      mv /etc/caddy/Caddyfile.tmp /etc/caddy/Caddyfile
    fi
  fi
  systemctl reload caddy || systemctl restart caddy
  configure_firewall_if_ufw
fi

print_superadmin_credentials_if_requested() {
  if [[ "${SHOW_SUPERADMIN_CREDENTIALS}" != "true" ]]; then
    return 0
  fi
  if [[ ! -f ".env.saas-live" ]]; then
    echo "WARN: .env.saas-live not found; cannot print superadmin credentials." >&2
    return 0
  fi

  local email password
  email="$(grep -E '^SUPERADMIN_EMAIL=' .env.saas-live | head -n 1 | cut -d= -f2- || true)"
  password="$(grep -E '^SUPERADMIN_PASSWORD=' .env.saas-live | head -n 1 | cut -d= -f2- || true)"

  echo
  echo "Superadmin credentials (from ${INSTALL_DIR}/.env.saas-live):"
  echo "- Email: ${email:-<missing>}"
  echo "- Password: ${password:-<missing>}"
  echo
  echo "Security note: this password was printed because you passed --show-superadmin-credentials."
}

echo
echo "Install complete."
echo "- Web upstream (localhost): http://127.0.0.1:${WEB_PORT}"
echo "- API upstream (localhost): http://127.0.0.1:${BACKEND_PORT}/api"
if [[ -n "$SINGLE_DOMAIN" ]]; then
  echo "- Web (HTTPS): https://${SINGLE_DOMAIN}"
  echo "- API (HTTPS): https://${SINGLE_DOMAIN}/api"
  echo "- License validate: https://${SINGLE_DOMAIN}/api/license/validate"
elif [[ -n "$WEB_DOMAIN" ]]; then
  echo "- Web (HTTPS): https://${WEB_DOMAIN}"
  echo "- API (HTTPS): https://${API_DOMAIN}/api"
  echo "- License validate: https://${API_DOMAIN}/api/license/validate"
else
  echo "- API (HTTPS): https://${API_DOMAIN}/api"
  echo "- License validate: https://${API_DOMAIN}/api/license/validate"
  echo "- (optional) add --web-domain for a separate web hostname, or --single-domain for one hostname."
fi
echo
echo "Next steps:"
echo "- Ensure Cloudflare DNS is set to DNS-only (no orange proxy) during first TLS issuance, or allow HTTP-01."
echo "- Point your live LeoCastra backend LICENSE_VALIDATE_URL to the URL above."

echo
echo "Superadmin login:"
echo "- Email: (saved in ${INSTALL_DIR}/.env.saas-live)"
echo "- Password: (saved in ${INSTALL_DIR}/.env.saas-live)"
echo "Tip: rerun installer with --show-superadmin-credentials to print them."

print_superadmin_credentials_if_requested
