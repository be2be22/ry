# Xray VLESS + gRPC + REALITY Panel

A single-deployment web panel for managing an [Xray-core](https://github.com/XTLS/Xray-core) server running **VLESS over gRPC with REALITY**, designed for [Railway](https://railway.app).

One Express process serves the React frontend, the JSON API, the subscription endpoint, and runs Xray-core as a `child_process`. All state lives in a SQLite file on a Railway Volume, so redeploys preserve clients, traffic counters, REALITY keys, and admin credentials.

---

## Features

- **Auth** — bcrypt-hashed admin password, JWT session, login rate-limiting. Credentials auto-generated on first boot (logged once to the console).
- **Dashboard** — Xray process status with restart button, today + 7-day traffic chart, active vs total client counts.
- **Client CRUD** — UUID, remark, optional traffic cap in GB, optional expiry date, enable/disable toggle. Per-client actions: copy share link, show QR code, regenerate UUID.
- **Subscription URL** — `GET /sub/:token` returns the base64-encoded `vless://` link with `Subscription-Userinfo` header (upload/download/total/expire) so subscription-aware apps stay in sync.
- **REALITY settings page** — edit `XRAY_PORT`, the Railway TCP-Proxy public host:port, `dest`, `serverNames`, `shortIds`, gRPC `serviceName`, default client `fingerprint`, log level, plus a one-click "generate new REALITY keypair" button (calls `xray x25519`).
- **Traffic accounting** — polls Xray's Stats API every 5s, persists per-client and daily totals, auto-disables clients that hit their cap or expiry.
- **Logs viewer** — paginated tail of Xray's access/error log (last 200 lines, never the whole file).
- **Persian (Farsi) RTL UI** — Vazirmatn font, dark theme with violet→cyan gradient, glassmorphism cards, soft glow on the online indicator. Technical values (UUIDs, IPs, ports, keys, `vless://` links) stay in Latin characters so they copy cleanly.

---

## File tree

```
xray-panel/
├── Dockerfile                 # Multi-stage: builds client, installs prod deps, downloads Xray
├── .dockerignore
├── .env.example
├── package.json               # Backend deps (express, better-sqlite3, bcryptjs, jwt, helmet, …)
├── README.md
├── server/
│   ├── index.js               # Express app entry; serves API + static frontend
│   ├── db.js                  # better-sqlite3 setup, schema init, settings helpers
│   ├── auth.js                # bcrypt + JWT, first-boot admin bootstrap
│   ├── xray.js                # Config builder, process spawn/restart, x25519/UUID gen
│   ├── stats.js               # Polls `xray api statsquery`, applies deltas to db
│   ├── share-link.js          # Builds the vless:// URL for a client
│   ├── middleware.js          # requireAuth
│   └── routes/
│       ├── auth.js            # POST /api/login, GET /api/auth/me, POST /api/auth/change-password
│       ├── clients.js         # CRUD + regenerate-uuid + /link
│       ├── settings.js        # GET/PUT settings, generate-keypair, generate-shortid
│       ├── dashboard.js       # GET /api/dashboard, POST /api/dashboard/restart
│       ├── logs.js            # GET /api/logs?type=error|access
│       └── sub.js             # GET /sub/:token (public, returns base64 vless://)
└── client/
    ├── package.json           # React + Vite + Tailwind + Recharts + qrcode.react
    ├── vite.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html             # dir="rtl", lang="fa", Vazirmatn font CDN
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css          # Tailwind layers + custom component classes
        ├── api.js             # tiny fetch wrapper with auth header injection
        ├── context/AuthContext.jsx
        ├── components/
        │   ├── Layout.jsx
        │   ├── Sidebar.jsx
        │   └── Toast.jsx
        └── pages/
            ├── Login.jsx
            ├── Dashboard.jsx
            ├── Clients.jsx
            ├── Settings.jsx
            └── Logs.jsx
```

---

## Environment variables

All optional — the app generates safe random values on first boot and logs them once.

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP port for the web panel. Railway injects this automatically. |
| `XRAY_PORT` | `8443` | Internal port Xray's VLESS/gRPC/REALITY inbound listens on. Expose via Railway TCP Proxy. |
| `XRAY_API_PORT` | `10085` | Local-only port for Xray's Stats API (dokodemo-door). Never exposed publicly. |
| `DATA_DIR` | `/data` | Where SQLite db, `xray-config.json`, logs, and REALITY keypair are stored. Mount a Railway Volume here. |
| `XRAY_BIN` | `/usr/local/bin/xray` | Path to the Xray binary (downloaded in the Dockerfile). |
| `STATIC_DIR` | `/app/client/dist` | Path to the built React frontend. |
| `ADMIN_USER` | `admin` | Admin username. If unset, defaults to `admin`. |
| `ADMIN_PASSWORD` | *(random)* | Admin password. If unset, a random one is generated and logged once on first boot. |
| `JWT_SECRET` | *(random)* | JWT signing secret. If unset, a random one is generated and logged once. **Set this in Railway** so sessions survive redeploys. |
| `NODE_ENV` | `production` | Node environment. |

---

## Railway deploy — step by step

### 1. Create the service

1. Push this repository to GitHub.
2. In Railway, click **New Project → Deploy from GitHub repo** and select the repo.
3. Railway detects the Dockerfile and builds it. The first build downloads the Xray binary (~25 MB) and runs `npm install` for both backend and frontend.

### 2. Attach a Volume at `/data`

Everything that must survive a redeploy lives in `/data`:

1. In your Railway service, go to the **Settings** tab.
2. Click **+ Add Volume**.
3. Mount path: `/data`.
4. Click **Add**. Railway creates the volume and remounts the service.

### 3. Set environment variables

In the service's **Variables** tab, add at least:

```
JWT_SECRET=<any long random string>
ADMIN_USER=admin
ADMIN_PASSWORD=<your password>
```

If you leave `ADMIN_PASSWORD` and `JWT_SECRET` unset, the app generates random ones and prints them to the **Deployments → Logs** tab on the first boot. Save them — they only show once.

### 4. Open the web panel

1. In the service's **Settings** tab, click **Generate Domain**.
2. You get a `*.up.railway.app` URL that routes to `$PORT` (the panel's HTTP listener).
3. Visit the URL, log in with `ADMIN_USER` / `ADMIN_PASSWORD`.

### 5. Enable the TCP Proxy for Xray

The web panel uses Railway's normal HTTP routing. **Xray's VLESS traffic needs a separate TCP port**, which Railway exposes via the TCP Proxy:

1. In the service's **Settings** tab, find **Networking**.
2. Click **Add TCP Proxy** (or "Generate TCP Service" / equivalent — Railway's UI has called it different things over time).
3. Railway shows you a public `host:port` pair, e.g. `your-service-production.up.railway.app:12345`. That TCP port forwards to your service's `$XRAY_PORT` (default `8443`).
4. Copy that **public host** and **public port** into the panel's **Settings → اتصال** section.
5. Save. The panel rewrites `xray-config.json` and restarts Xray.

### 6. Generate the REALITY keypair

1. In the panel, go to **Settings → REALITY**.
2. Click **تولید کلید جدید** (Generate new key). The panel calls `xray x25519` and stores the keypair in `/data`.
3. The **public key (pbk)** is shown — it's the value that goes into client share links.
4. Tweak `dest` / `serverNames` to a real, popular site that supports TLS 1.3 + HTTP/2 (e.g. `www.microsoft.com:443`, `www.cloudflare.com:443`). Don't leave the default placeholder if you can avoid it.

### 7. Add your first client

1. Go to **Clients → کلاینت جدید**.
2. Pick a remark (e.g. `phone`), optionally set a traffic cap or expiry.
3. Save. Click the **QR icon** to scan or copy the `vless://` link.
4. Paste the link into any Xray-compatible client (v2rayN, Nekobox, Streisand, Foxray, …). The link encodes everything: UUID, public host:port, SNI, fingerprint, pbk, shortId, gRPC serviceName.

### 8. (Optional) Use the subscription URL

Each client also has a **Subscription URL** (`https://your-panel.up.railway.app/sub/<token>`). Apps that support subscription URLs (v2rayN, Nekobox, Shadowrocket, …) will periodically re-fetch this URL and stay in sync if you regenerate the client's UUID or change settings.

The URL returns the standard `Subscription-Userinfo` header with `upload; download; total; expire` so subscription clients can show remaining traffic / days.

---

## How traffic accounting works

Every 5 seconds (configurable via the `stats_interval_ms` setting), the panel:

1. Calls `xray api statsquery --server=127.0.0.1:$XRAY_API_PORT -reset`.
2. Parses the output into per-client `up`/`down` deltas.
3. Adds the deltas to each client's `traffic_used_up` / `traffic_used_down` columns.
4. Adds the same deltas to today's row in the `traffic_daily` table.
5. If a client exceeds its `traffic_limit_gb` or its `expires_at` has passed, it's auto-disabled (the `enabled` column flips to `0`) and the panel triggers a debounced Xray restart so the disabled client is removed from the inbound.

The `-reset` flag means each poll returns traffic since the last poll — so if Xray restarts mid-interval, no traffic is double-counted.

---

## Resource notes

The panel itself is intentionally lean:

- **better-sqlite3** instead of Prisma — no query-engine binary, native C bindings, ~5 MB resident.
- Stats polling shells out to `xray api statsquery` every 5s — no gRPC client library, no proto loading.
- Config rewrites are debounced (800ms) so saving 5 clients in a row triggers one Xray restart, not five.
- Xray's `log.loglevel` defaults to `warning` — debug logging burns CPU and disk I/O that should go to proxy traffic.
- The logs viewer only reads the last 200 lines, never the whole file.
- The frontend is code-split (`react`, `recharts` chunks) and ships no source maps.

On a Railway 512 MB plan, the panel + Xray together typically use 80–120 MB at idle.

---

## Updating Xray

To upgrade Xray-core, edit `Dockerfile` and change:

```dockerfile
ARG XRAY_VERSION=v25.6.30
```

to the latest release from <https://github.com/XTLS/Xray-core/releases>, then redeploy. The volume preserves all clients and settings; only the binary changes.

---

## Local development

```bash
# 1. Install backend deps
cd xray-panel
npm install

# 2. Install frontend deps
cd client
npm install
cd ..

# 3. (optional) put an xray binary somewhere and point XRAY_BIN at it
#    On macOS: brew install xray  →  /opt/homebrew/bin/xray
export XRAY_BIN=/opt/homebrew/bin/xray
export DATA_DIR=./.data
mkdir -p .data

# 4. Run backend (with auto-reload via node --watch)
npm run dev:server   # in one terminal

# 5. Run frontend dev server (proxies /api to :3000)
npm run dev:client   # in another terminal
```

Open <http://localhost:5173>. The Vite dev server proxies `/api` and `/sub` to `http://localhost:3000`.

If `XRAY_BIN` is unavailable locally, the backend still runs — Xray just won't start, and the dashboard will show "متوقف". The rest of the panel (settings, clients, etc.) still works for testing the UI.

---

## Security notes

- Every `/api/*` route except `/api/login` requires a valid JWT.
- `helmet` is enabled (CSP is disabled so the Vite-built frontend's inline styles work; this is standard for SPAs).
- `express-rate-limit` throttles `/api/login` to 10 attempts per 5 minutes per IP.
- The REALITY **private key** is never returned in any API response. Only the **public key** is.
- Admin password and JWT secret are logged **once** on first boot if env vars are unset, so you can retrieve them from Railway's deploy logs. After that, set the env vars so they persist.
- The subscription endpoint (`/sub/:token`) is public by design — the token is a 32-char hex secret. Rotating a client's UUID also rotates its sub token.

---

## License

MIT. Use it, fork it, sell it — no warranties.
