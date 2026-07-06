# Recordings pipeline — deploy & ops

How a live session becomes an on-demand HLS recording, and the infra needed to run it.

```
mentor goes live
   └─ API: startEgress() ──────────────► LiveKit Egress service
                                              │ records room composite
                                              ▼
                                   R2: recordings/<id>/source.mp4
session ends → LiveKit fires egress_ended webhook → API marks 'processing'
   └─ API enqueues BullMQ "recording-transcode"
                                              ▼
                              mentra-worker (ffmpeg)
            source.mp4 → HLS ladder 1080/720/480/360 (4s segments) + thumbnail
                                              ▼
                         R2: recordings/<id>/hls/master.m3u8 + …
   └─ worker marks session 'ready' with recordingUrl = <R2_PUBLIC_BASE_URL>/…/master.m3u8
                                              ▼
                          student player (hls.js, Phase 3) streams via CDN
```

Everything is gated on R2 being configured (`R2_*` in `.env`). With no R2, sessions run
normally and simply aren't recorded.

---

## 1. Prerequisites already done in code

- `R2_*` env vars (`apps/api/src/env.ts`, `.env`).
- Egress start/stop + webhook handling (`core/livekit.ts`, `live-session` module).
- Transcode worker (`apps/api/src/worker.ts` + `recording.transcode.ts`), scripts
  `pnpm --filter @mentra/api worker` (prod) / `worker:dev`.
- `livekit.yaml` now has a `redis:` block (Egress needs it).

Run `pnpm install` after pulling (adds `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`).

## 2. ffmpeg on the worker host

```bash
sudo apt-get update && sudo apt-get install -y ffmpeg
ffmpeg -version && ffprobe -version   # sanity check
```

Override paths if needed via `FFMPEG_PATH` / `FFPROBE_PATH` in `.env`.

## 3. The transcode worker (systemd)

```bash
sudo cp /srv/mentra/mentra-worker.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now mentra-worker
journalctl -u mentra-worker -f        # watch jobs
```

Scale by running more `mentra-worker` instances (each does one ffmpeg at a time).
Add it to `deploy.sh`'s restart list alongside `mentra-api`.

## 4. The LiveKit Egress service ⚠️ the hard part

Room-composite egress renders the room in **headless Chrome** then encodes with **ffmpeg**.
LiveKit ships Egress as a **Docker image**; running it natively means building from source
plus installing Chrome + ffmpeg + xvfb + pulseaudio. On this no-Docker host you have two
realistic choices:

### Option A — Docker, just for egress (recommended)
Install Docker and run **only** the egress container (the API/SFU/web stay native):

```bash
sudo docker run -d --restart unless-stopped --name mentra-egress \
  --network host \
  -e EGRESS_CONFIG_FILE=/etc/egress.yaml \
  -v /etc/mentra/egress.yaml:/etc/egress.yaml \
  livekit/egress:latest
```

- Copy this repo's `egress.yaml` → `/etc/mentra/egress.yaml` and set the real
  `api_key`/`api_secret` (must match `livekit.yaml`) and `redis.address`.
- `--network host` lets it reach LiveKit (`127.0.0.1:7880`) and Redis (`127.0.0.1:6379`).

### Option B — native egress binary
Build `livekit/egress` from source and install Chrome + ffmpeg + xvfb, run under systemd
with `EGRESS_CONFIG_FILE=/etc/mentra/egress.yaml`. More moving parts; only do this if Docker
is truly off the table.

> Whichever you pick, the egress process must reach the **same Redis** as LiveKit, or
> `startEgress` calls will hang/fail. Confirm with `journalctl` on egress + the API logs
> (`recording egress started` on go-live).

## 5. Firewall / R2

- No new inbound ports for egress (it dials out to LiveKit + Redis on loopback, and to R2
  over HTTPS).
- `R2_PUBLIC_BASE_URL` currently uses the r2.dev dev URL (rate-limited). Swap to a
  Cloudflare CDN custom domain before production.

## 6. End-to-end test

1. `R2_*` set, `pnpm install`, API + worker running, egress running.
2. Start a live session as a mentor, then end it.
3. API logs: `recording egress started` → (on end) `egress complete → transcoding queued`.
4. Worker logs: `transcode job started` → `recording transcoded → ready`.
5. DB: `LiveSession.recordingStatus = 'ready'`, `recordingUrl` set.
6. `curl -I "<recordingUrl>"` returns the master.m3u8 from R2/CDN.

## 7. Mentor video uploads (≤1 GB) — direct-to-R2

Mentors can upload a pre-recorded video on the **Mentor Live Sessions** page. It rides the
same FFmpeg→HLS→R2→CDN pipeline as live recordings (same `recording-transcode` queue +
worker). The browser PUTs the file **straight to R2** via a presigned URL — it never
streams through the API.

Flow: `POST /sessions/upload` (presign + create row, source='upload', status='ended',
recordingStatus='processing') → browser `PUT` to R2 (`uploads/<id>/source`) →
`POST /sessions/:id/upload/finalize` (size check ≤1 GB, enqueue transcode) → worker
transcodes → `recordingStatus='ready'`. It then shows in students' recordings feed.

**REQUIRED: add a CORS policy to the R2 bucket** (R2 dashboard → bucket → Settings →
CORS Policy), or the browser PUT fails with a CORS error. Replace the origin with your
web origin(s):

```json
[
  {
    "AllowedOrigins": ["http://192.168.56.20:5173", "https://mentra.<your-domain>"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Notes:
- The presigned PUT signs `content-type`; the client sends the exact same value — keep the
  CORS `AllowedHeaders` entry as shown.
- The 1 GB cap is enforced client-side (pre-upload) and server-side (`r2Head` size check in
  `finalizeUpload`; oversize objects are deleted and the row marked 'failed').
- ffmpeg sniffs the container from content, so any common video (mp4/mov/webm/mkv) works
  even though the R2 key has no extension.

## 8. Transcode speed knobs (worker env)

The worker reads two optional env vars (set them where the worker runs — same `.env`):

- `TRANSCODE_PRESET` — x264 preset (default `veryfast`). Use `ultrafast`/`superfast` to
  speed up encoding a lot (slightly larger files). Quality-sensitive prod can stay default.
- `TRANSCODE_MAX_HEIGHT` — cap the ABR ladder's top rung (e.g. `720` skips the expensive
  1080p rung). `0`/unset = full ladder up to the source height.

Dev / slow-VM example (much faster, fine for testing):

```
TRANSCODE_PRESET=ultrafast
TRANSCODE_MAX_HEIGHT=720
```

Encoding is CPU-bound and roughly linear with video length × rungs × resolution, so also
give the VM more vCPUs (`Vagrantfile`: `vb.cpus = 4`) — it helps more than anything.
