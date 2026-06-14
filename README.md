# Mentra — native (no Docker) deploy with nginx

Runs the whole stack directly on one Ubuntu host — **MySQL, Redis, the Node API, the
LiveKit binary, and nginx** — with the built software living in a single folder:
**`/srv/mentra`**. nginx serves the web app and reverse-proxies `/api` and the LiveKit
signaling WebSocket (`/rtc`).

```
Vagrantfile              # Ubuntu 22.04 VM (no Docker)
provision.sh             # one-shot installer/builder (idempotent)
deploy.sh                # rebuild + migrate + restart after code changes
env.example              # -> /srv/mentra/.env on first run
livekit.yaml             # -> /etc/mentra/livekit.yaml
nginx/mentra.conf        # -> /etc/nginx/sites-available/mentra.conf
systemd/                 # mentra-api.service, livekit.service -> /etc/systemd/system/
```

## Run it in a VM (local)
```bash
vagrant up            # from the repo ROOT — boots Ubuntu, provisions natively, builds, starts nginx
```
Open **http://localhost:8080**.

## Run it on a real VPS
```bash
git clone <repo> /opt/mentra
sudo bash /opt/mentra/provision.sh
# then edit /srv/mentra/.env (secrets, AI key, LinkedIn, domain) and:
sudo bash /opt/mentra/deploy.sh
```

## What ends up where
- **/srv/mentra** — the single runtime folder (built `apps/web/dist`, `apps/api/dist`, `node_modules`, `.env`).
- **mentra-api.service** — `node dist/index.js` on `127.0.0.1:4000`.
- **livekit.service** — `livekit-server` on `7880/7881/7882`.
- **nginx** — `:80` → web static + `/api`→4000 + `/rtc`→7880.

## Day-2
```bash
sudo bash deploy.sh                              # ship code changes
systemctl status mentra-api livekit nginx mysql redis-server
journalctl -u mentra-api -f                      # API logs
```

## Production notes
- **TLS:** `sudo certbot --nginx -d yourdomain.com`, then set in `/srv/mentra/.env`:
  `WEB_APP_ORIGIN=https://yourdomain.com`, `LIVEKIT_WS_URL=wss://yourdomain.com`,
  `LINKEDIN_REDIRECT_URI=https://yourdomain.com/api/v1/marketing/linkedin/callback`,
  rebuild (`deploy.sh` bakes `VITE_API_URL` from `MENTRA_PUBLIC_URL` — export it to your https origin).
- **LiveKit media** is WebRTC over UDP and connects **directly** to the host — open **UDP 7882**
  (and TCP 7881) on the firewall, and set `use_external_ip: true` in `/etc/mentra/livekit.yaml` on a real VPS.
- **Secrets:** change the `JWT_*` and `LIVEKIT_*` defaults in `.env`; set a strong MySQL password
  (override `MYSQL_USER`/`MYSQL_PASSWORD` env before provisioning, and match `DATABASE_URL`).
- **Firewall:** allow 22, 80, 443, 7881/tcp, 7882/udp; keep MySQL/Redis bound to localhost.
