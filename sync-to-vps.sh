#!/usr/bin/env bash
# Push the local working tree up to the VPS to ship updated code.
#
# Safe by design: env files, build output, node_modules and local state are
# EXCLUDED, so this can never overwrite the production secrets that live only at
# /srv/mentra/.env on the server. After syncing, redeploy on the VPS with:
#   cd /opt/mentra && sudo MENTRA_PUBLIC_URL=https://app.mentradev.sbs bash deploy.sh
#
# Usage:
#   bash sync-to-vps.sh
#   VPS_HOST=user@1.2.3.4 VPS_PATH=/opt/mentra bash sync-to-vps.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
VPS_HOST="${VPS_HOST:-root@89.117.58.200}"   # override: VPS_HOST=youruser@host
VPS_PATH="${VPS_PATH:-/opt/mentra}"          # the code checkout on the VPS (NOT /srv/mentra)

rsync -az --delete \
  --exclude '.env' --exclude '.env.*' \
  --exclude node_modules --exclude .git \
  --exclude 'apps/web/dist' --exclude 'apps/api/dist' \
  --exclude var --exclude '.vagrant' --exclude '.pnpm-store' \
  "$SRC"/ "$VPS_HOST:$VPS_PATH"/

echo "✅ Synced to $VPS_HOST:$VPS_PATH"
echo "   (excluded: .env*, node_modules, dist, var, .git — prod secrets untouched)"
echo "   Next, on the VPS:"
echo "     cd $VPS_PATH && sudo MENTRA_PUBLIC_URL=https://app.mentradev.sbs bash deploy.sh"
