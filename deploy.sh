#!/usr/bin/env bash
# Redeploy after code changes: re-sync source, rebuild, migrate, restart the API.
# Run inside the host:  sudo bash deploy.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
APP=/srv/mentra
RUN_USER=mentra
PUBLIC_URL="${MENTRA_PUBLIC_URL:-http://localhost:8080}"

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
