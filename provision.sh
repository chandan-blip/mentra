#!/usr/bin/env bash
# Mentra — native (no Docker) provisioner for a single Ubuntu host.
# Installs MySQL, Redis, Node, nginx and the LiveKit binary; builds the app into a
# single runtime folder (/srv/mentra); installs systemd units + the nginx site; and
# starts everything. Idempotent — safe to re-run.
#
# Usage (in the VM, the Vagrantfile calls this):  sudo bash provision.sh
# On a real VPS: clone the repo to /opt/mentra, then run the same command.
set -euo pipefail

# Source repo = the dir holding this script (Vagrant mounts it at /opt/mentra).
SRC="$(cd "$(dirname "$0")" && pwd)"
APP=/srv/mentra                 # single runtime folder holding the built software
KIT="$SRC"
RUN_USER=mentra

PUBLIC_URL="${MENTRA_PUBLIC_URL:-http://localhost:8080}"   # what the browser hits (nginx)
DB_USER="${MYSQL_USER:-mentra}"
DB_PASS="${MYSQL_PASSWORD:-mentra_dev_pw}"
DB_NAME="${MYSQL_DATABASE:-mentra}"

echo "==> [1/9] System packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git rsync build-essential ca-certificates mysql-server redis-server nginx \
  php-fpm php-mysql php-mbstring php-zip php-gd php-curl php-xml openssl

echo "==> [2/9] Node.js 20 + pnpm"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
command -v pnpm >/dev/null 2>&1 || npm install -g pnpm

echo "==> [3/9] LiveKit server binary"
if ! command -v livekit-server >/dev/null 2>&1; then
  # Download the release tarball directly (the get.livekit.io one-liner gives no
  # retry and silently extracts an HTML error page when GitHub rate-limits). Retry,
  # and verify it's a real gzip before extracting.
  # NB: pin to a release that actually has binary tarballs attached. v1.13.0's
  # GitHub release exists but ships zero assets, so its download URL 404s.
  LK_VER="${LIVEKIT_VERSION:-1.12.0}"
  LK_URL="https://github.com/livekit/livekit/releases/download/v${LK_VER}/livekit_${LK_VER}_linux_amd64.tar.gz"
  TMP_LK="$(mktemp -d)"
  for attempt in 1 2 3 4 5; do
    if curl -fSL --retry 3 --retry-delay 2 -o "$TMP_LK/lk.tgz" "$LK_URL" \
       && tar -tzf "$TMP_LK/lk.tgz" >/dev/null 2>&1; then
      tar -xzf "$TMP_LK/lk.tgz" -C "$TMP_LK"
      install -m 0755 "$TMP_LK/livekit-server" /usr/local/bin/livekit-server
      break
    fi
    echo "   livekit download attempt $attempt failed (GitHub flaky); retrying in 5s..."
    sleep 5
  done
  rm -rf "$TMP_LK"
  command -v livekit-server >/dev/null 2>&1 || { echo "ERROR: livekit-server install failed after 5 attempts"; exit 1; }
fi

echo "==> [4/9] Runtime user + folders"
id "$RUN_USER" >/dev/null 2>&1 || useradd --system --create-home --shell /usr/sbin/nologin "$RUN_USER"
mkdir -p "$APP" /etc/mentra "$APP/var/uploads"

echo "==> [5/9] MySQL database + user"
systemctl enable --now mysql
mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'127.0.0.1';
GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost';
FLUSH PRIVILEGES;
SQL
systemctl enable --now redis-server

echo "==> [6/9] Sync source -> $APP and build"
# Build off the synced folder onto local disk (avoids slow/symlink-broken node_modules
# on a VirtualBox synced mount).
rsync -a --delete \
  --exclude node_modules --exclude .git --exclude 'apps/web/dist' \
  --exclude 'apps/api/dist' --exclude 'var' --exclude '.vagrant' \
  --exclude '.env' --exclude '.pnpm-store' \
  "$SRC"/ "$APP"/

# First-run env from the template; never clobber an edited .env.
[ -f "$APP/.env" ] || cp "$KIT/env.example" "$APP/.env"

cd "$APP"
pnpm install --frozen-lockfile
pnpm --filter @mentra/api exec prisma generate || true
# Build the web against the public origin so it calls same-origin /api (nginx proxies it).
VITE_API_URL="$PUBLIC_URL" pnpm build
# Apply DB migrations using the .env DATABASE_URL.
set -a; . "$APP/.env"; set +a
pnpm --filter @mentra/api db:deploy

chown -R "$RUN_USER":"$RUN_USER" "$APP" /etc/mentra

echo "==> [7/9] LiveKit + systemd services"
cp "$KIT/livekit.yaml" /etc/mentra/livekit.yaml
cp "$KIT/systemd/mentra-api.service" /etc/systemd/system/mentra-api.service
cp "$KIT/systemd/livekit.service" /etc/systemd/system/livekit.service
systemctl daemon-reload
systemctl enable --now livekit
systemctl restart mentra-api && systemctl enable mentra-api

echo "==> [8/9] phpMyAdmin (DB admin UI, served by nginx via php-fpm)"
# Install from the Ubuntu archive — the upstream phpmyadmin.net download is often
# unreachable from inside the VM. Preseed debconf so apt neither prompts nor pulls
# in Apache (empty webserver choice, no dbconfig control DB).
echo "phpmyadmin phpmyadmin/dbconfig-install boolean false" | debconf-set-selections
echo "phpmyadmin phpmyadmin/reconfigure-webserver multiselect" | debconf-set-selections
apt-get install -y --no-install-recommends phpmyadmin
# Config: a self-contained cookie-auth setup against the native MySQL over TCP,
# written to the file /usr/share/phpmyadmin/config.inc.php symlinks to. Written once
# so the generated blowfish secret (and any hand-edits) survive re-provisioning.
if ! grep -q blowfish_secret /etc/phpmyadmin/config.inc.php 2>/dev/null; then
  PMA_SECRET="$(openssl rand -base64 32)"
  cat >/etc/phpmyadmin/config.inc.php <<PHP
<?php
declare(strict_types=1);
\$cfg['blowfish_secret'] = '${PMA_SECRET}';
\$i = 0;
\$i++;
\$cfg['Servers'][\$i]['auth_type'] = 'cookie';
\$cfg['Servers'][\$i]['host'] = '127.0.0.1';
\$cfg['Servers'][\$i]['port'] = '3306';
\$cfg['Servers'][\$i]['compress'] = false;
\$cfg['Servers'][\$i]['AllowNoPassword'] = false;
\$cfg['TempDir'] = '/var/lib/phpmyadmin/tmp';
PHP
fi
mkdir -p /var/lib/phpmyadmin/tmp
# php-fpm runs as www-data and needs to write TempDir.
chown -R www-data:www-data /var/lib/phpmyadmin
systemctl enable --now php8.1-fpm

echo "==> [9/9] nginx site"
cp "$KIT/nginx/mentra.conf" /etc/nginx/sites-available/mentra.conf
ln -sf /etc/nginx/sites-available/mentra.conf /etc/nginx/sites-enabled/mentra.conf
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "✅ Done. App: $PUBLIC_URL   (api: /api, livekit ws: /rtc, phpMyAdmin: /phpmyadmin)"
echo "   phpMyAdmin login: MySQL user '$DB_USER' / its password, DB '$DB_NAME'."
echo "   Services: systemctl status mentra-api livekit nginx mysql redis-server php8.1-fpm"
