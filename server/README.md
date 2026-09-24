# Ludo Mintly – game server

Authoritative online server for Ludo Mintly: guest accounts, coins, daily rewards,
leaderboard, quick matches (with computer players filling empty seats), private rooms,
and real-time games over Socket.IO. The wire contract lives in `engine/src/protocol.ts`;
rules are the shared pure engine in `engine/src`.

Stack: Node 22.13+, TypeScript, `socket.io`, built-in `node:sqlite` (no external DB).

## Run on localhost

```bash
# at the repo root
npm install
npm run dev:server        # tsx watch, http://localhost:3000
curl localhost:3000/health
```

Production build: `npm run build -w server && npm start -w server` (runs `server/dist/index.js`).
Tests: `npm test -w server`. Type check: `npm run typecheck -w server`.

Data is stored in `server/data/ludo.db` (SQLite, WAL) plus `server/data/secret`
(auto-generated token secret when `SERVER_SECRET` is not set). Delete the folder to reset.

## Play from a phone on the same Wi-Fi

1. Find the PC's LAN IP: `ipconfig` (Windows) / `ip addr` or `ifconfig` (Linux/macOS), e.g. `192.168.1.23`.
2. Allow inbound TCP port 3000 in the firewall
   (Windows: *Windows Defender Firewall → Advanced settings → Inbound Rules → New Rule → Port → TCP 3000*;
   Linux ufw: `sudo ufw allow 3000/tcp`).
3. In the app, point the server URL at `http://192.168.1.23:3000`. Check from the phone's browser that
   `http://192.168.1.23:3000/health` returns `{"ok":true}`.

Note: Android blocks plain `http://` by default in release builds, and the Play Store build must use a
public **https** URL. `localhost`/LAN addresses are only for testing.

## Environment variables

| Variable | Default | Meaning |
|---|---|---|
| `PORT` | `3000` | HTTP/Socket.IO port |
| `HOST` | `0.0.0.0` | Bind address |
| `DATA_DIR` | `./data` | Folder for `ludo.db` and `secret` |
| `SERVER_SECRET` | generated, saved in `DATA_DIR/secret` | HMAC key for auth tokens. Changing it logs everyone out (accounts are kept). |
| `TURN_SECONDS` | `15` | Time per turn before the server auto-plays it |
| `ANIM_GRACE_MS` | `1500` | Extra time added to each turn deadline for animations |
| `BOT_FILL_SECONDS` | `12` | Quick-match wait before computer players fill empty seats |
| `BOT_DELAY_MS` | `900` | Computer player think time per action |
| `STARTING_COINS` | `1000` | Coins for a new account |
| `STAKES` | `100,250,500,1000,2500,5000,10000` | Allowed entry fees |
| `DAILY_REWARDS` | `100,150,200,300,400,500,1000` | Day 1..7 streak rewards |
| `FREE_COINS` / `FREE_COINS_BELOW` / `FREE_COINS_COOLDOWN_MINUTES` | `500` / `100` / `60` | Free coins top-up |
| `MAX_MISSED_TURNS` | `3` | Consecutive timeouts before a player is removed |
| `HOST_GRACE_SECONDS` | `30` | How long a disconnected room member has to come back |

## API

REST (JSON, CORS open to any origin): see `engine/src/protocol.ts`.
`POST /api/auth/guest`, `GET/PATCH /api/me`, `POST /api/daily`, `POST /api/free-coins`,
`GET /api/leaderboard`, `GET /api/config`, `GET /health`, plus:

- `DELETE /api/me` (Bearer token) – **account deletion** (Play Store requirement). Removes the user from any
  queue/room, forfeits a running game, disconnects their sockets and permanently deletes the user row and
  their coin history. Returns `{ "ok": true }`. Logging in again with the same deviceId creates a brand-new account.

Socket.IO: connect with `io(url, { auth: { token } })`; events per `ClientToServer` / `ServerToClient`.

## Deploy publicly

The Play Store app needs a public `https://` URL (Socket.IO uses `wss://` automatically).

### Render (one click)
`render.yaml` at the repo root defines a Docker web service with a 1 GB persistent disk at `/data`
and a generated `SERVER_SECRET`. In Render: *New → Blueprint → pick this repo*. Render terminates TLS and
gives you `https://<name>.onrender.com`. Persistent disks require a paid instance; keep the service at
**one instance** (game state lives in memory).

### Any VPS with Docker
```bash
docker build -f server/Dockerfile -t ludo-mintly-server .      # from the repo root
docker run -d --name ludo -p 3000:3000 -v ludo-data:/data \
  -e SERVER_SECRET="$(openssl rand -hex 32)" --restart unless-stopped ludo-mintly-server
```
Put a TLS reverse proxy in front, e.g. Caddy: `ludo.example.com { reverse_proxy localhost:3000 }`
(Caddy fetches certificates automatically and proxies WebSockets). Back up the `/data` volume.

The server handles `SIGTERM` gracefully. Run a single instance: queues, rooms and games are in memory.
