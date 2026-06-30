#!/usr/bin/env bash
# Two modes:
#   sudo bash deploy.sh          → production redeploy (rsync → build → migrate → restart systemd/nginx)
#   bash deploy.sh dev           → hot-reload dev (tsx watch API + Vite HMR web, straight from source)
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
APP=/srv/mentra
RUN_USER=mentra
PUBLIC_URL="${MENTRA_PUBLIC_URL:-http://localhost:8080}"
MODE="${1:-prod}"

if [ "$MODE" = "dev" ]; then
  # ── LOCAL DEV ONLY ─────────────────────────────────────────────────────────
  # Hot-reload: run both apps live from source. No rsync/build — edits reload
  # instantly. Reads the LOCAL ./.env (dev config: 127.0.0.1 hosts, dev secrets).
  # API → http://localhost:4000 (tsx watch), Web → http://localhost:5173 (Vite HMR).
  cd "$SRC"

  # Safety: dev mode must never run against a production env. The local dev .env
  # is NODE_ENV=development; the VPS .env (/srv/mentra/.env) is production. This
  # guard means an accidental `bash deploy.sh dev` on the VPS aborts instead of
  # stopping the live API or starting Vite with prod secrets.
  [ -f "$SRC/.env" ] || { echo "✗ dev mode needs $SRC/.env (local dev config)."; exit 1; }
  set -a; . "$SRC/.env"; set +a
  if [ "${NODE_ENV:-}" = "production" ]; then
    echo "✗ Refusing dev mode: $SRC/.env is a PRODUCTION env (NODE_ENV=production)."
    echo "  Dev mode is local-only. To (re)deploy prod run:  sudo bash deploy.sh"
    exit 1
  fi

  # Free port 4000 if a local mentra-api service is running (no-op without root).
  systemctl stop mentra-api 2>/dev/null || true
  pnpm install
  pnpm --filter @mentra/api exec prisma generate
  pnpm --filter @mentra/api db:deploy
  echo "🔥 Hot-reload dev — API on :${API_PORT:-4000}, web on http://localhost:${WEB_PORT:-5173} (Ctrl-C to stop)"
  exec pnpm dev
fi

# ── PRODUCTION REDEPLOY (default; run on the VPS as: sudo bash deploy.sh) ──────
# Syncs source into /srv/mentra, builds, migrates, restarts systemd+nginx.
# Reads the prod env at /srv/mentra/.env and NEVER overwrites it (--exclude '.env').

rsync -a --delete \
  --exclude node_modules --exclude .git --exclude 'apps/web/dist' \
  --exclude 'apps/api/dist' --exclude 'var' --exclude '.env' --exclude '.vagrant' \
  --exclude '.pnpm-store' \
  "$SRC"/ "$APP"/

cd "$APP"
pnpm install --frozen-lockfile
pnpm --filter @mentra/api exec prisma generate || true
VITE_API_URL="$PUBLIC_URL" pnpm build
set -a; . "$APP/.env"; set +a
pnpm --filter @mentra/api db:deploy

chown -R "$RUN_USER":"$RUN_USER" "$APP"
systemctl restart mentra-api
systemctl reload nginx
echo "✅ Redeployed. $PUBLIC_URL"
