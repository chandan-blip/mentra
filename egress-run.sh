#!/usr/bin/env bash
# Runtime wrapper for native LiveKit Egress (mentra-egress.service).
#
# Mirrors LiveKit's Docker entrypoint on bare metal: sets up a per-service runtime dir,
# starts PulseAudio (headless audio capture), and generates the egress config FROM the
# app's .env so api_key/api_secret/redis/ws always match the SFU + API (no drift). Xvfb
# is spawned by egress itself per recording, so we don't start a display here.
set -euo pipefail

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/run/egress}"
mkdir -p "$XDG_RUNTIME_DIR"

# Pull the same keys/redis the API + worker use.
set -a
# shellcheck disable=SC1091
. /srv/mentra/.env
set +a

CONF="$XDG_RUNTIME_DIR/config.yaml"
cat > "$CONF" <<EOF
redis:
  address: ${REDIS_HOST:-127.0.0.1}:${REDIS_PORT:-6379}
api_key: ${LIVEKIT_API_KEY:?LIVEKIT_API_KEY missing in /srv/mentra/.env}
api_secret: ${LIVEKIT_API_SECRET:?LIVEKIT_API_SECRET missing in /srv/mentra/.env}
# Loopback SFU URL the egress joins as a hidden participant.
ws_url: ws://127.0.0.1:7880
template_port: 7980
logging:
  level: info
EOF
export EGRESS_CONFIG_FILE="$CONF"

# Start PulseAudio for this session if it isn't already running.
pulseaudio --check 2>/dev/null || \
  pulseaudio -D --exit-idle-time=-1 --disallow-exit --disable-shm=true 2>/dev/null || true

exec /usr/local/bin/egress
