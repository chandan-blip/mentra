# Deploying Mentra onto the shared VPS (89.117.58.200)

This box already runs `lootmarket.store` (:5000) and `cashytype.lootmarket.store` (:3100).
Mentra is added **alongside** them as its own subdomain — it must NOT take the
nginx `default_server`. Stack is native (no Docker): MySQL + Redis + Node API
(systemd) + LiveKit + nginx, built into `/srv/mentra`.

Assumed subdomain: **app.mentradev.com** (change everywhere if different).

---

## Dev vs Prod — kept separate so shipping code never breaks prod

| | Local dev (hot reload) | Production (VPS) |
|---|---|---|
| Run | `bash deploy.sh dev` | `sudo bash deploy.sh` |
| Code runs from | the working tree (`pnpm dev`) | `/srv/mentra` (built) |
| Env file | `./.env` (`NODE_ENV=development`) | `/srv/mentra/.env` (`NODE_ENV=production`) |
| Serving | Vite HMR :5173 + tsx watch :4000 | nginx + systemd `mentra-api` |

**The golden rule: env files never travel over rsync.** The prod `.env` exists
**only** at `/srv/mentra/.env` on the server. It is gitignored, `deploy.sh`/`provision.sh`
sync with `--exclude '.env'`, and the dev branch of `deploy.sh` refuses to run if it
sees `NODE_ENV=production`. So neither a redeploy nor an accidental `deploy.sh dev`
can touch prod secrets.

**Shipping updated code** — use the helper (it excludes `.env*`, `node_modules`,
`dist`, `var`, `.git`), then redeploy on the box:

```bash
# from your laptop:
VPS_HOST=youruser@89.117.58.200 bash sync-to-vps.sh
# then on the VPS (see "Future redeploys" below):
cd /opt/mentra && sudo MENTRA_PUBLIC_URL=https://app.mentradev.com bash deploy.sh
```

If you rsync by hand instead of the helper, **always** pass `--exclude '.env*'`.

---

## 0. Pre-flight checks (run on the VPS, confirm before installing)

```bash
node -v          # must be >= 20.x. If 18.x, the build will fail — see note below.
pnpm -v          # if missing: sudo npm i -g pnpm
# Ports 4000 / 7880 / 7881 / 7882 must be free (loot=5000, cashy=3100 are taken):
sudo ss -ltnp | grep -E ':(4000|7880|7881|7882)\b' || echo "ports free ✓"
certbot certificates    # do you already have a *.lootmarket.store wildcard cert?
systemctl is-active mysql redis-server
```

- **Node < 20:** NodeSource won't auto-upgrade an existing Node. Install 20 first:
  `curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash - && sudo apt-get install -y nodejs`
  (verify loot/cashyzone still run after — or use `nvm` per-service if you can't move the system Node.)

## 1. DNS

Two hostnames — the **app** lives on `app.*`, the **landing page** on the root domain.
Add **A records** (both → the VPS):
- `app.mentradev.com → 89.117.58.200`  (the React app + API)
- `mentradev.com → 89.117.58.200`      (the marketing landing page)
- `www.mentradev.com → 89.117.58.200`  (optional; landing cert covers it)

Wait for them to resolve (`dig +short app.mentradev.com`, `dig +short mentradev.com`).

A third hostname, `cdn.mentradev.com`, serves the stored files (HLS recordings, thumbnails,
review videos/images). It is **not** an A record to the VPS — add it in Cloudflare R2 →
`mentra-recordings` → Settings → Custom Domains, which creates the DNS record for you. It
must match `R2_PUBLIC_BASE_URL` in `.env`; see `DEPLOY_RECORDINGS.md`.

## 2. Get the code onto the VPS

```bash
sudo mkdir -p /opt/mentra && sudo chown $USER /opt/mentra
git clone <your-repo-url> /opt/mentra        # or rsync the working tree up
cd /opt/mentra
```

## 3. Production .env

```bash
cp .env.vps.example /srv/mentra/.env   # create /srv first if needed: sudo mkdir -p /srv/mentra
sudo $EDITOR /srv/mentra/.env
```
Fill every `<PLACEHOLDER>`:
- `MYSQL_PASSWORD` (and the same value inside `DATABASE_URL`) — a strong password.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_COOKIE_SECRET` — `openssl rand -base64 48` each.
- `AI_API_KEY` — copy your Groq key from the old `.env`.
- `LIVEKIT_API_KEY` (any string) + `LIVEKIT_API_SECRET` (`openssl rand -base64 32`) —
  must match `livekit.yaml` in step 5.
- Confirm `app.mentradev.com` is your real subdomain throughout.

## 4. Provision everything EXCEPT nginx (safe on a shared host)

`SKIP_NGINX=1` keeps your existing vhosts untouched; phpMyAdmin is off by default.
The MySQL step is additive (`CREATE … IF NOT EXISTS mentra`) — it won't touch the loot DB.

```bash
cd /opt/mentra
sudo MENTRA_PUBLIC_URL=https://app.mentradev.com \
     MYSQL_PASSWORD='<same strong password as in .env>' \
     SKIP_NGINX=1 \
     bash provision.sh
```
This installs the LiveKit binary, creates the `mentra` MySQL DB/user, rsyncs to
`/srv/mentra`, builds web+api, runs migrations, and starts `mentra-api` + `livekit`.

## 5. Point LiveKit at the public IP

Provision copied `livekit.yaml` to `/etc/mentra/livekit.yaml`. Edit it for a real host:

```bash
sudo $EDITOR /etc/mentra/livekit.yaml
```
- `use_external_ip: true`  (was false)
- remove / comment `node_ip: 127.0.0.1`
- `keys:` → replace `devkey: devsecret…` with `<LIVEKIT_API_KEY>: <LIVEKIT_API_SECRET>` from `.env`
- `webhook.api_key:` → `<LIVEKIT_API_KEY>`

```bash
sudo systemctl restart livekit
```

## 6. Firewall (only if ufw is active)

```bash
sudo ufw status
# if active:
sudo ufw allow 7881/tcp     # LiveKit RTC/TCP
sudo ufw allow 7882/udp     # LiveKit RTC/UDP (media)
# 80/443 should already be open for the existing sites.
```

## 7. nginx subdomain vhost + HTTPS

```bash
cd /opt/mentra
sed 's/MENTRA_DOMAIN/app.mentradev.com/' nginx/mentra.vps.conf \
  | sudo tee /etc/nginx/sites-available/mentra.conf >/dev/null
sudo ln -s /etc/nginx/sites-available/mentra.conf /etc/nginx/sites-enabled/mentra.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d app.mentradev.com   # issues cert, adds 80→443 redirect
```
(If `certbot certificates` already showed a `*.lootmarket.store` wildcard, you can instead
add the `listen 443 ssl` + existing cert paths to the vhost by hand and skip certbot.)

## 7b. Landing page vhost (root domain)

The landing page is a static file (`landing/index.html`) rsynced to `/srv/mentra/landing`
by provision/deploy. Its vhost serves that page and proxies `/api/` to the API so the
onboarding enquiry form posts same-origin. The "Get started" buttons link to
`https://app.mentradev.com`.

```bash
cd /opt/mentra
# NOTE the /g — server_name carries LANDING_DOMAIN twice (apex + www) on one line, and
# without it the www half stays a literal placeholder and certbot reports
# "Could not automatically find a matching server block for www.<domain>".
sed 's/LANDING_DOMAIN/mentradev.com/g' nginx/landing.vps.conf \
  | sudo tee /etc/nginx/sites-available/mentra-landing.conf >/dev/null
sudo ln -s /etc/nginx/sites-available/mentra-landing.conf /etc/nginx/sites-enabled/mentra-landing.conf
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d mentradev.com -d www.mentradev.com   # cert + 80→443 redirect
```

Enquiries submitted here appear in the **Leads** admin UI (`source: landing`), owned by a
marketing/admin user. Verify: `curl -i -X POST https://mentradev.com/api/v1/enquiries -H 'content-type: application/json' -d '{"name":"Test","email":"t@e.com"}'` → `201`.

## 7b. Legacy domain redirect (mentradev.sbs → mentradev.com)

Mentra previously lived on `mentradev.sbs`. Links shared before the move — `/watch/<id>`
session links, unfurled social cards, bookmarks — still point there, so a redirect vhost
keeps them working instead of 404ing.

```bash
cd /opt/mentra
sudo certbot certificates    # confirm the .sbs cert names/paths match the file
sudo cp nginx/sbs-redirect.vps.conf /etc/nginx/sites-available/mentra-sbs-redirect.conf
sudo ln -s /etc/nginx/sites-available/mentra-sbs-redirect.conf \
           /etc/nginx/sites-enabled/mentra-sbs-redirect.conf
sudo nginx -t && sudo systemctl reload nginx
curl -sI http://app.mentradev.sbs/watch/abc  | grep -i location   # → https://app.mentradev.com/watch/abc
curl -sI https://app.mentradev.sbs/watch/abc | grep -i location   # same, over TLS
```

Three things this depends on, all easy to get wrong:
- **Keep the `.sbs` certs.** TLS completes *before* the 301 is sent, so a deleted or
  expired cert turns every `https://…sbs/…` link into a browser security warning rather
  than a redirect. Do not run `certbot delete` on the `.sbs` names until you retire the
  vhost.
- **Keep `.sbs` DNS + registration** pointed at this VPS. The redirect is served by this
  box; if the name stops resolving there is nothing to redirect.
- **Never build this file by copying `mentra.vps.conf`** — that file declares the
  `$mentra_is_social_crawler` map at http context, and a duplicate map name makes nginx
  refuse to start.

Retire it once the access logs go quiet: remove the symlink, reload, then
`sudo certbot delete --cert-name app.mentradev.sbs` and `--cert-name mentradev.sbs`.

## 8. Seed baseline data (fresh DB)

Admin modules/roles/default plan only (non-destructive):
```bash
cd /srv/mentra
set -a; . /srv/mentra/.env; set +a
pnpm --filter @mentra/api db:seed
# optional demo mentors: pnpm --filter @mentra/api db:seed:mentors
```

## 9. Verify

```bash
systemctl status mentra-api livekit --no-pager
curl -i https://app.mentradev.com/api/v1/health   # adjust to a real health route
```
Open `https://app.mentradev.com` in a browser; check login, then a live session
(LiveKit media needs UDP 7882 reachable).

---

## Future redeploys (after pulling new code)

`deploy.sh` re-syncs, rebuilds, migrates, and restarts the API. It does **not** touch
nginx or `livekit.yaml`, so it's safe on the shared host:
```bash
cd /opt/mentra && git pull
sudo MENTRA_PUBLIC_URL=https://app.mentradev.com bash deploy.sh
```


MYSQL_PASSWORD=Mv048ed0a8b3506dea_Pz
DATABASE_URL=mysql://mentra:Mv048ed0a8b3506dea_Pz@127.0.0.1:3306/mentra
UPDATE `User` SET role = 'admin' WHERE email = 'chandan@triophase.com'