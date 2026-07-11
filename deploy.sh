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

# Recording transcode worker (BullMQ + ffmpeg consumer) — runs as its own service so
# heavy transcoding never blocks the API. It is NOT part of the base image, so make the
# deploy self-healing: ensure ffmpeg exists, (re)install the unit, and restart it on
# every deploy so it always runs current code (mirrors mentra-api above). Without this,
# recordings/uploads sit at recordingStatus='processing' forever.
command -v ffmpeg >/dev/null 2>&1 || { apt-get update && apt-get install -y ffmpeg; }
install -m 0644 "$APP/mentra-worker.service" /etc/systemd/system/mentra-worker.service
systemctl daemon-reload
systemctl enable mentra-worker
systemctl restart mentra-worker

# LiveKit SFU config: recording egress is dispatched to the egress worker over Redis, so
# the SFU config MUST carry a `redis:` block — without it LiveKit runs single-node and
# startEgress() times out (~22s) with "failed to start recording egress", so recording
# never starts while live sessions/media keep working (which masks the bug). The live
# /etc/mentra/livekit.yaml is hand-tuned per host (node_ip / use_external_ip), so we must
# NOT overwrite it from the repo copy — only ensure the redis block exists (idempotent).
LK_CFG=/etc/mentra/livekit.yaml
if [ -f "$LK_CFG" ] && ! grep -qE '^redis:' "$LK_CFG"; then
  echo "▸ LiveKit: adding missing redis block to $LK_CFG (required for egress dispatch)"
  printf '\nredis:\n  address: 127.0.0.1:6379\n' >> "$LK_CFG"
  systemctl restart livekit \
    || echo "⚠️  livekit failed to restart after redis fix — check: journalctl -u livekit"
fi

# LiveKit Egress (session recording → R2) — same self-healing pattern as the worker.
# Session recording needs the native Egress service running next to the SFU on the SAME
# Redis; without it startEgress() throws and nothing reaches R2 (mentor uploads still work,
# which is why R2 looks "fine"). The egress binary is built from source ONCE (heavy: Chrome
# + GStreamer + Go) by provision-egress.sh, so auto-run that only when it's missing; on
# every deploy just refresh the runner + unit and restart (cheap). Best-effort by design —
# an egress build/start failure must NEVER fail the core redeploy. Skip with SKIP_EGRESS=1.
if [ "${SKIP_EGRESS:-0}" = "1" ]; then
  echo "▸ Egress: skipped (SKIP_EGRESS=1)"
elif [ ! -x /usr/local/bin/egress ]; then
  echo "▸ Egress: binary missing — provisioning once (slow: builds Chrome/GStreamer/Go from source)…"
  bash "$APP/provision-egress.sh" \
    || echo "⚠️  Egress provisioning failed — recording stays off (mentor uploads unaffected). See: journalctl -u mentra-egress"
else
  install -m 0755 "$APP/egress-run.sh" /usr/local/bin/egress-run.sh
  install -m 0644 "$APP/mentra-egress.service" /etc/systemd/system/mentra-egress.service
  systemctl daemon-reload
  systemctl enable mentra-egress >/dev/null 2>&1 || true
  systemctl restart mentra-egress \
    || echo "⚠️  mentra-egress failed to (re)start — recording stays off. See: journalctl -u mentra-egress"
fi

systemctl reload nginx
echo "✅ Redeployed. $PUBLIC_URL"
echo "   API: $(systemctl is-active mentra-api)  ·  Worker: $(systemctl is-active mentra-worker)  ·  Egress: $(systemctl is-active mentra-egress 2>/dev/null || echo n/a)"
