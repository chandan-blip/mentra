#!/usr/bin/env bash
# Native LiveKit Egress for Mentra recordings — NO Docker.
#
# Builds the egress binary from source and installs it as the `mentra-egress` systemd
# service, alongside Chrome + GStreamer + Xvfb + PulseAudio. Run ONCE on the VPS as root:
#
#   sudo bash /opt/mentra/provision-egress.sh
#
# Target: Ubuntu 24.04, x86_64. Egress renders each live room in headless Chrome and
# encodes with GStreamer; the API's `startEgress` writes the composite MP4 to R2, then
# the mentra-worker transcodes it to HLS. Egress talks to the SFU (ws://127.0.0.1:7880)
# and the SAME Redis the API/worker use. See DEPLOY_RECORDINGS.md.
#
# ⚠️ Native egress is unsupported by LiveKit (they ship it as Docker). The risky bit is
# GStreamer version compatibility — if encoding fails, the fallback is mentor uploads.
set -euo pipefail

[ "$(id -u)" = 0 ] || { echo "✗ run as root (sudo)"; exit 1; }

APP=/srv/mentra
SRC=/opt/egress-src
GO_VERSION="${GO_VERSION:-1.23.6}"

echo "▸ 1/7  Runtime + build dependencies"
apt-get update
apt-get install -y --no-install-recommends \
  ca-certificates curl wget gnupg unzip pkg-config build-essential git \
  xvfb pulseaudio fonts-noto fonts-liberation \
  gstreamer1.0-tools gstreamer1.0-plugins-base gstreamer1.0-plugins-good \
  gstreamer1.0-plugins-bad gstreamer1.0-plugins-ugly gstreamer1.0-libav \
  gstreamer1.0-pulseaudio libgstreamer1.0-dev libgstreamer-plugins-base1.0-dev \
  libgstreamer-plugins-bad1.0-dev libglib2.0-dev

echo "▸ 2/7  Google Chrome (stable)"
if ! command -v google-chrome >/dev/null 2>&1; then
  wget -qO /tmp/chrome.deb https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
  apt-get install -y /tmp/chrome.deb
  rm -f /tmp/chrome.deb
fi

echo "▸ 3/7  Ubuntu 24.04 sandbox fix (unprivileged userns for Chrome)"
# Noble restricts unprivileged user namespaces via AppArmor, which breaks Chrome's
# sandbox and makes room-composite render a black frame. Re-enable them.
echo 'kernel.apparmor_restrict_unprivileged_userns = 0' > /etc/sysctl.d/60-egress-userns.conf
sysctl --system >/dev/null

echo "▸ 4/7  Build toolchain — private Node 22 (app's Node untouched) + Go ${GO_VERSION}"
# The egress template pins pnpm@11, which needs Node >=22.13. Install a private Node 22
# under /opt/node22 used ONLY for this build, so the app keeps running on its own
# /usr/bin/node (v20). We prepend it to PATH just for the steps below.
NODE22_VERSION="${NODE22_VERSION:-22.13.1}"
NODE22_DIR=/opt/node22
if [ ! -x "$NODE22_DIR/bin/node" ] || ! "$NODE22_DIR/bin/node" -v 2>/dev/null | grep -q '^v22\.'; then
  rm -rf "$NODE22_DIR"; mkdir -p "$NODE22_DIR"
  wget -qO /tmp/node22.tar.xz "https://nodejs.org/dist/v${NODE22_VERSION}/node-v${NODE22_VERSION}-linux-x64.tar.xz"
  tar -xJf /tmp/node22.tar.xz -C "$NODE22_DIR" --strip-components=1
  rm -f /tmp/node22.tar.xz
fi
export PATH="$NODE22_DIR/bin:$PATH"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0   # non-interactive pnpm fetch
corepack enable || true
echo "    template build node: $(node -v)"
if [ ! -x /usr/local/go/bin/go ] || ! /usr/local/go/bin/go version | grep -q "go${GO_VERSION}"; then
  wget -qO /tmp/go.tgz "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz"
  rm -rf /usr/local/go && tar -C /usr/local -xzf /tmp/go.tgz && rm -f /tmp/go.tgz
fi
export PATH="$PATH:/usr/local/go/bin"

echo "▸ 5/7  Build egress from source (latest release)"
EGRESS_TAG="${EGRESS_TAG:-$(curl -fsSL https://api.github.com/repos/livekit/egress/releases/latest | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p')}"
echo "    building egress ${EGRESS_TAG:-main}"
rm -rf "$SRC"
git clone --depth 1 ${EGRESS_TAG:+--branch "$EGRESS_TAG"} https://github.com/livekit/egress "$SRC"

# Ubuntu's gstreamer1.0-plugins-bad ships NO `faac` AAC encoder, and there is no apt
# package that provides the `faac` GStreamer element (the faac/libfaac0 packages are only
# the CLI + lib). LiveKit egress hardcodes `faac` for the MP4 audio track, so every
# recording dies instantly at pipeline build with "could not create element: faac" (and
# crashes the egress process). Swap it for `voaacenc` (from gstreamer1.0-plugins-bad,
# installed in step 1) — it accepts S16LE raw audio exactly like faac and takes the same
# `bitrate` (bits/sec) property, so it links to egress's fixed S16LE capsfilter as a true
# drop-in. NOTE: do NOT use ffmpeg's `avenc_aac` here — it wants FLTP (float-planar) input
# and fails with "failed to link capsfilter0 to avenc_aac0" against that capsfilter.
AUDIO_GO="$SRC/pkg/pipeline/builder/audio.go"
if [ -f "$AUDIO_GO" ] && grep -q 'gst.NewElement("faac")' "$AUDIO_GO"; then
  echo "    patching egress audio encoder: faac → voaacenc (Ubuntu lacks the faac gst element)"
  sed -i 's/gst\.NewElement("faac")/gst.NewElement("voaacenc")/' "$AUDIO_GO"
fi

cd "$SRC/template-default"
# Build the room-composite template with npm, NOT pnpm. pnpm 11's supply-chain gate keeps
# blocking esbuild's build script and exiting non-zero (breaking every pnpm command incl.
# `pnpm build`). npm runs dependency build scripts by default, so esbuild's native binary
# is set up and `vite build` works. --legacy-peer-deps avoids React 19 peer-dep errors.
rm -f pnpm-workspace.yaml pnpm-lock.yaml
npm install --legacy-peer-deps --no-audit --no-fund
npm run build
cd "$SRC"
mkdir -p cmd/server/templates
cp -a template-default/build/. cmd/server/templates/
CGO_ENABLED=1 GO111MODULE=on GODEBUG=disablethp=1 \
  /usr/local/go/bin/go build -a -o /usr/local/bin/egress ./cmd/server
/usr/local/bin/egress --version || true

echo "▸ 6/7  Service user + env access"
id egress >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/egress --shell /usr/sbin/nologin egress
# Let egress read the app env (it derives its config from it). Group-read only.
usermod -aG mentra egress 2>/dev/null || true
chgrp mentra "$APP/.env" 2>/dev/null || true
chmod 640 "$APP/.env" 2>/dev/null || true

echo "▸ 7/7  Install runner + systemd unit"
install -m 0755 "$APP/egress-run.sh" /usr/local/bin/egress-run.sh
install -m 0644 "$APP/mentra-egress.service" /etc/systemd/system/mentra-egress.service
systemctl daemon-reload
systemctl enable --now mentra-egress

echo
echo "✅ mentra-egress installed. Status: $(systemctl is-active mentra-egress)"
echo "   Watch it:      journalctl -u mentra-egress -f"
echo "   Then start a live session and expect the API log: 'recording egress started'"
