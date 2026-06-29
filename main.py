"""
FastApiCloud WS Config Panel — Python Edition v5 (FastAPI + aiohttp, NO gRPC)
============================================================================

NO gRPC/protobuf dependency — works on Python 3.14+ without compatibility issues.
Traffic stats are read from Xray's access log instead of gRPC.

Architecture:
- FastAPI app on PORT (for HTTP API + WebSocket server)
- Xray-core subprocess on localhost ports (8443/8444/8445)
- /ws/{proto} → FastAPI WebSocket → aiohttp client → Xray (FAST!)
- Traffic stats from Xray access log (parsed periodically)
"""

import os
import sys
import json
import time
import uuid
import hmac
import hashlib
import secrets
import sqlite3
import asyncio
import logging
import platform
import zipfile
import io
import base64
import subprocess
import urllib.request
import threading
import re
from pathlib import Path
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import aiohttp
import qrcode
import uvicorn

# ==============================================================================
# Configuration
# ==============================================================================

BASE_DIR = Path(__file__).parent.resolve()

def _find_data_dir() -> Path:
    try:
        test_file = BASE_DIR / ".write_test"
        test_file.touch()
        test_file.unlink()
        return BASE_DIR / "data"
    except Exception:
        pass
    tmp_dir = Path("/tmp") / "fastapicloud-data"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    return tmp_dir

DATA_DIR = _find_data_dir()
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "data.db"
XRAY_DIR = DATA_DIR / "xray-bin"
XRAY_BIN = XRAY_DIR / "xray"
XRAY_CONFIG_PATH = XRAY_DIR / "config.json"
XRAY_LOG_PATH = XRAY_DIR / "xray.log"
XRAY_PID_PATH = XRAY_DIR / "xray.pid"
STATIC_DIR = BASE_DIR / "static"

XRAY_PORTS = {"vmess": 8443, "vless": 8444, "trojan": 8445}
XRAY_ACCESS_LOG = XRAY_DIR / "xray-access.log"

PUBLIC_HOST = os.environ.get("PUBLIC_HOST", "")
PUBLIC_PORT = int(os.environ.get("PUBLIC_PORT", "443"))

SESSION_SECRET = os.environ.get("SESSION_SECRET", "")
SESSION_MAX_AGE = 7 * 24 * 3600

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger("fastapicloud")

# ==============================================================================
# Database
# ==============================================================================

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn

def init_db():
    XRAY_DIR.mkdir(exist_ok=True)
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS admin (
        id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL,
        email TEXT, role TEXT DEFAULT 'admin', created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS config (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT DEFAULT 'vmess',
        uuid TEXT NOT NULL, path TEXT DEFAULT '/', host TEXT, sni TEXT,
        tls TEXT DEFAULT 'tls', network TEXT DEFAULT 'ws', port INTEGER DEFAULT 443,
        flow TEXT, status TEXT DEFAULT 'active',
        upload_bytes INTEGER DEFAULT 0, download_bytes INTEGER DEFAULT 0, total_usage_bytes INTEGER DEFAULT 0,
        data_limit INTEGER DEFAULT 0, expires_at TEXT, xray_active INTEGER DEFAULT 0, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY, action TEXT, entity TEXT, entity_id TEXT, detail TEXT, admin_id TEXT, created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    """)
    cur = conn.execute("SELECT COUNT(*) FROM admin")
    if cur.fetchone()[0] == 0:
        salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac("sha256", b"admin123", salt.encode(), 100000).hex()
        conn.execute("INSERT INTO admin (id, username, password, email, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "admin", f"{salt}:{hashed}", "admin@fastapicloud.com", "admin", datetime.now().isoformat()))
        log.info("Default admin created: admin / admin123")
    global SESSION_SECRET
    if not SESSION_SECRET:
        cur = conn.execute("SELECT value FROM settings WHERE key = 'session_secret'")
        row = cur.fetchone()
        if row: SESSION_SECRET = row["value"]
        else:
            SESSION_SECRET = secrets.token_hex(32)
            conn.execute("INSERT INTO settings (key, value) VALUES ('session_secret', ?)", (SESSION_SECRET,))
    conn.commit()
    conn.close()

# ==============================================================================
# Password & Session
# ==============================================================================

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    return f"{salt}:{hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000).hex()}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split(":")
        return hmac.compare_digest(hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex(), hashed)
    except: return False

def create_session(admin: dict) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({
        "id": admin["id"], "username": admin["username"], "role": admin.get("role", "admin"),
        "exp": int(time.time()) + SESSION_MAX_AGE,
    }).encode()).decode().rstrip("=")
    sig = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"

def verify_session(token: str) -> Optional[dict]:
    try:
        payload, sig = token.rsplit(".", 1)
        if not hmac.compare_digest(sig, hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()): return None
        padding = 4 - (len(payload) % 4)
        if padding != 4: payload += "=" * padding
        data = json.loads(base64.urlsafe_b64decode(payload))
        if data.get("exp", 0) < time.time(): return None
        return data
    except: return None

def get_session_admin(request: Request) -> Optional[dict]:
    token = request.cookies.get("fastapicloud_session")
    return verify_session(token) if token else None

def require_auth(request: Request) -> dict:
    admin = get_session_admin(request)
    if not admin: raise HTTPException(status_code=401, detail="احراز هویت نشده‌اید")
    return admin

# ==============================================================================
# Xray binary & config
# ==============================================================================

def ensure_xray_binary():
    if XRAY_BIN.exists(): return
    XRAY_DIR.mkdir(exist_ok=True)
    machine = platform.machine().lower()
    arch = "64" if machine in ("x86_64", "amd64") else "arm64-v8a" if machine in ("aarch64", "arm64") else None
    if not arch: return
    url = f"https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-{arch}.zip"
    log.info(f"Downloading Xray from {url} ...")
    try:
        with urllib.request.urlopen(url, timeout=60) as resp: data = resp.read()
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            with z.open("xray") as f: XRAY_BIN.write_bytes(f.read())
            XRAY_BIN.chmod(0o755)
            for name in ("geoip.dat", "geosite.dat"):
                try:
                    with z.open(name) as f: (XRAY_DIR / name).write_bytes(f.read())
                except KeyError: pass
        log.info(f"Xray downloaded: {XRAY_BIN}")
    except Exception as e: log.error(f"Failed to download Xray: {e}")

def generate_xray_config() -> dict:
    conn = get_db()
    configs = [dict(r) for r in conn.execute("SELECT * FROM config WHERE status = 'active'").fetchall()]
    conn.close()
    by_type = {"vmess": [], "vless": [], "trojan": []}
    for c in configs:
        if c["type"] in by_type: by_type[c["type"]].append(c)
    inbounds = []
    for proto, port in XRAY_PORTS.items():
        clients = by_type.get(proto, [])
        if proto == "vmess":
            settings = {"clients": [{"id": c["uuid"], "alterId": 0, "level": 0, "email": c["uuid"]} for c in clients], "decryption": "none"}
        elif proto == "vless":
            settings = {"clients": [{"id": c["uuid"], "flow": c.get("flow") or "", "level": 0, "email": c["uuid"]} for c in clients], "decryption": "none"}
        else:
            settings = {"clients": [{"password": c["uuid"], "level": 0, "email": c["uuid"]} for c in clients]}
        inbounds.append({
            "tag": f"{proto}-ws", "listen": "127.0.0.1", "port": port, "protocol": proto,
            "settings": settings,
            "streamSettings": {"network": "ws", "security": "none", "wsSettings": {"path": f"/ws/{proto}"}},
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        })
    return {
        "log": {"loglevel": "warning", "access": str(XRAY_DIR / "xray-access.log"), "error": str(XRAY_DIR / "xray-error.log")},
        "inbounds": inbounds,
        "outbounds": [{"tag": "direct", "protocol": "freedom"}, {"tag": "block", "protocol": "blackhole"}],
    }

def write_xray_config():
    XRAY_CONFIG_PATH.write_text(json.dumps(generate_xray_config(), indent=2))

# ==============================================================================
# Xray process management
# ==============================================================================

_xray_proc = None

def is_xray_running() -> bool:
    global _xray_proc
    if _xray_proc and _xray_proc.poll() is None: return True
    if XRAY_PID_PATH.exists():
        try:
            pid = int(XRAY_PID_PATH.read_text().strip())
            os.kill(pid, 0); return True
        except: XRAY_PID_PATH.unlink(missing_ok=True)
    return False

def get_xray_pid():
    global _xray_proc
    if _xray_proc and _xray_proc.poll() is None: return _xray_proc.pid
    if XRAY_PID_PATH.exists():
        try: return int(XRAY_PID_PATH.read_text().strip())
        except: pass
    return None

def _kill_all_xray():
    global _xray_proc
    if _xray_proc and _xray_proc.poll() is None:
        try:
            _xray_proc.terminate(); time.sleep(0.3)
            if _xray_proc.poll() is None: _xray_proc.kill()
        except: pass
    try: subprocess.run(["pkill", "-f", str(XRAY_BIN)], capture_output=True, timeout=3)
    except: pass
    _xray_proc = None
    XRAY_PID_PATH.unlink(missing_ok=True)

def start_xray():
    global _xray_proc
    _kill_all_xray(); time.sleep(0.3)
    if not XRAY_BIN.exists(): return {"ok": False, "error": "فایل اجرایی Xray یافت نشد"}
    try: write_xray_config()
    except Exception as e: return {"ok": False, "error": f"خطا در config: {e}"}
    try:
        log_fd = open(XRAY_LOG_PATH, "w")
        _xray_proc = subprocess.Popen([str(XRAY_BIN), "run", "-c", str(XRAY_CONFIG_PATH)],
            cwd=str(XRAY_DIR), stdout=log_fd, stderr=log_fd,
            env={**os.environ, "XRAY_LOCATION_ASSET": str(XRAY_DIR)})
        XRAY_PID_PATH.write_text(str(_xray_proc.pid))
        time.sleep(1.5)
        if _xray_proc.poll() is not None:
            return {"ok": False, "error": f"Xray بسته شد.\n{read_log_tail(20)}"}
        log.info(f"Xray started, PID={_xray_proc.pid}")
        return {"ok": True, "pid": _xray_proc.pid}
    except Exception as e: return {"ok": False, "error": f"خطا: {e}"}

def stop_xray():
    _kill_all_xray()
    conn = get_db(); conn.execute("UPDATE config SET xray_active = 0"); conn.commit(); conn.close()
    return {"ok": True}

def restart_xray():
    _kill_all_xray(); time.sleep(0.5)
    r = start_xray()
    if r["ok"]:
        conn = get_db(); conn.execute("UPDATE config SET xray_active = 1 WHERE status = 'active'"); conn.commit(); conn.close()
    return r

def read_log_tail(lines=50):
    try:
        if not XRAY_LOG_PATH.exists(): return "(log not found)"
        content = XRAY_LOG_PATH.read_text(errors="replace")
        return "\n".join(content.split("\n")[-lines:]) if content.strip() else "(empty)"
    except Exception as e: return f"(error: {e})"

def get_xray_status():
    running = is_xray_running()
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM config WHERE status = 'active'").fetchone()[0]
    conn.close()
    return {"running": running, "pid": get_xray_pid() if running else None,
            "public_host": PUBLIC_HOST or "(auto)", "public_port": PUBLIC_PORT,
            "client_count": count, "xray_bin_exists": XRAY_BIN.exists()}

# Debounced reload
_reload_lock = threading.Lock()
_reload_pending = False
_reload_timer = None

def schedule_xray_reload(delay=1.5):
    global _reload_timer, _reload_pending
    with _reload_lock:
        _reload_pending = True
        if _reload_timer: _reload_timer.cancel()
        _reload_timer = threading.Timer(delay, _do_reload)
        _reload_timer.daemon = True
        _reload_timer.start()

def _do_reload():
    global _reload_pending
    with _reload_lock:
        if not _reload_pending: return
        _reload_pending = False
    if not is_xray_running(): return
    try:
        log.info("Reloading Xray...")
        restart_xray()
    except Exception as e: log.error(f"Reload error: {e}")

# ==============================================================================
# Traffic stats from Xray access log
# ==============================================================================

# Xray access log format (when loglevel is "warning" with access log):
# Each line contains: timestamp, inbound tag, from, to, and traffic info
# We parse the email/UUID field and accumulated bytes.
# Format: YYYY/MM/DD HH:MM:SS [tag] from  accepted  email:UUID  [inboundTag]
#         network:tcp type:tcp host:domain  path:/ws/vmess  traffic:uplink → 1234, downlink → 5678

_log_position = 0  # Track how much of the log we've already parsed

def parse_access_log_for_stats() -> dict:
    """Parse Xray access log to extract per-user traffic stats.
    
    Xray access log lines look like:
    2026/06/29 20:00:00 127.0.0.1:12345 accepted //vmess-ws [vmess-ws] email: user@uuid
    The traffic is logged when the connection closes.
    
    Returns: {uuid: {"uplink": int, "downlink": int}}
    """
    global _log_position
    stats = {}
    if not XRAY_ACCESS_LOG.exists():
        return stats
    try:
        size = XRAY_ACCESS_LOG.stat().st_size
        # If log was rotated/reset, start from beginning
        if _log_position > size:
            _log_position = 0
        with open(XRAY_ACCESS_LOG, "r", errors="replace") as f:
            f.seek(_log_position)
            new_data = f.read()
            _log_position = f.tell()
        # Parse each line for traffic info
        for line in new_data.split("\n"):
            # Look for email: pattern (UUID is used as email)
            # Format: ... email: xxx-xxx-xxx-xxx ... traffic: uplink → 1234, downlink → 5678
            email_match = re.search(r"email:\s*([a-f0-9\-]{36})", line)
            if not email_match:
                continue
            uuid = email_match.group(1)
            # Look for traffic info: "traffic: uplink → 1234, downlink → 5678" or "from 127.0.0.1: ... to ... : 1234 B"
            # Xray logs: "from ... to ... accepted ..." then later "traffic: uplink → X, downlink → Y"
            up_match = re.search(r"uplink\s*[→>:]\s*(\d+)", line)
            down_match = re.search(r"downlink\s*[→>:]\s*(\d+)", line)
            if up_match or down_match:
                if uuid not in stats:
                    stats[uuid] = {"uplink": 0, "downlink": 0}
                if up_match:
                    stats[uuid]["uplink"] += int(up_match.group(1))
                if down_match:
                    stats[uuid]["downlink"] += int(down_match.group(1))
        return stats
    except Exception as e:
        log.debug(f"Access log parse error: {e}")
        return {}


def get_traffic_stats() -> dict:
    """Get aggregated traffic stats from access log + DB."""
    log_stats = parse_access_log_for_stats()
    conn = get_db()
    configs = [dict(r) for r in conn.execute("SELECT * FROM config WHERE status = 'active'").fetchall()]
    # Update DB with new stats from log
    for c in configs:
        uuid = c["uuid"]
        if uuid in log_stats:
            up = log_stats[uuid]["uplink"]
            down = log_stats[uuid]["downlink"]
            # Accumulate (add to existing DB values since log may rotate)
            new_up = c.get("upload_bytes", 0) + up
            new_down = c.get("download_bytes", 0) + down
            conn.execute(
                "UPDATE config SET upload_bytes = ?, download_bytes = ?, total_usage_bytes = ? WHERE id = ?",
                (new_up, new_down, new_up + new_down, c["id"])
            )
    conn.commit()
    # Now get totals from DB
    configs = [dict(r) for r in conn.execute("SELECT * FROM config WHERE status = 'active'").fetchall()]
    conn.close()
    total_up = sum(c.get("upload_bytes", 0) for c in configs)
    total_down = sum(c.get("download_bytes", 0) for c in configs)
    total = sum(c.get("total_usage_bytes", 0) for c in configs)
    return {"upload": total_up, "download": total_down, "total": total}

# ==============================================================================
# Share links & QR
# ==============================================================================

def gen_vmess_link(c, host, port):
    obj = {"v": "2", "ps": c["name"], "add": host, "port": str(port), "id": c["uuid"],
           "aid": "0", "scy": "auto", "net": "ws", "type": "none", "host": host,
           "path": "/ws/vmess", "tls": "tls", "sni": host}
    return "vmess://" + base64.b64encode(json.dumps(obj).encode()).decode()

def gen_vless_link(c, host, port):
    from urllib.parse import urlencode, quote
    params = {"encryption": "none", "type": "ws", "host": host, "path": "/ws/vless", "security": "tls", "sni": host}
    return f"vless://{c['uuid']}@{host}:{port}?{urlencode(params)}#{quote(c['name'])}"

def gen_trojan_link(c, host, port):
    from urllib.parse import urlencode, quote
    params = {"type": "ws", "host": host, "path": "/ws/trojan", "security": "tls", "sni": host}
    return f"trojan://{c['uuid']}@{host}:{port}?{urlencode(params)}#{quote(c['name'])}"

def gen_share_link(c, host, port):
    t = c["type"]
    if t == "vmess": return gen_vmess_link(c, host, port)
    if t == "vless": return gen_vless_link(c, host, port)
    if t == "trojan": return gen_trojan_link(c, host, port)
    return ""

def get_public_host(request):
    global PUBLIC_HOST
    if PUBLIC_HOST: return PUBLIC_HOST
    host = request.headers.get("host", "").split(":")[0]
    if host and host not in ("localhost", "127.0.0.1"): PUBLIC_HOST = host
    return PUBLIC_HOST or host or "fastapicloud.com"

def make_qr(text):
    img = qrcode.make(text)
    buf = io.BytesIO(); img.save(buf, format="PNG"); return buf.getvalue()

# ==============================================================================
# FastAPI App
# ==============================================================================

@asynccontextmanager
async def lifespan(app):
    log.info("Starting FastApiCloud WS Panel v4...")
    init_db()
    ensure_xray_binary()
    if XRAY_BIN.exists() and not is_xray_running():
        r = start_xray()
        if r["ok"]: log.info("Xray auto-started")
    yield
    if is_xray_running(): stop_xray()

app = FastAPI(title="FastApiCloud WS Panel", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# Shared aiohttp session for WebSocket proxy (reuse connections)
_http_session = None

async def get_http_session():
    global _http_session
    if _http_session is None:
        _http_session = aiohttp.ClientSession()
    return _http_session

# ==============================================================================
# Routes — Frontend
# ==============================================================================

@app.get("/", response_class=HTMLResponse)
async def index():
    if not STATIC_DIR.exists(): return HTMLResponse("<h1>static/index.html not found</h1>", status_code=500)
    return HTMLResponse(STATIC_DIR.joinpath("index.html").read_text(encoding="utf-8"))

# ==============================================================================
# Routes — Auth
# ==============================================================================

@app.post("/api/auth/login")
async def login(request: Request):
    body = await request.json()
    conn = get_db()
    admin = conn.execute("SELECT * FROM admin WHERE username = ?", (body.get("username", "").strip(),)).fetchone()
    conn.close()
    if not admin or not verify_password(body.get("password", ""), admin["password"]):
        return JSONResponse({"ok": False, "error": "نام کاربری یا رمز نادرست"}, status_code=401)
    token = create_session(dict(admin))
    resp = JSONResponse({"ok": True, "admin": {"id": admin["id"], "username": admin["username"], "role": admin["role"]}})
    resp.set_cookie("fastapicloud_session", token, httponly=True, samesite="lax", max_age=SESSION_MAX_AGE, path="/")
    return resp

@app.post("/api/auth/logout")
async def logout():
    resp = JSONResponse({"ok": True})
    resp.delete_cookie("fastapicloud_session", path="/")
    return resp

@app.get("/api/auth/check")
async def auth_check(request: Request):
    admin = get_session_admin(request)
    return {"ok": bool(admin), "admin": admin}

@app.post("/api/auth/password")
async def change_password(request: Request):
    admin = require_auth(request)
    body = await request.json()
    if len(body.get("newPassword", "")) < 6:
        return JSONResponse({"ok": False, "error": "حداقل ۶ کاراکتر"}, status_code=400)
    conn = get_db()
    conn.execute("UPDATE admin SET password = ? WHERE id = ?", (hash_password(body["newPassword"]), admin["id"]))
    conn.commit(); conn.close()
    return {"ok": True}

# ==============================================================================
# Routes — Configs
# ==============================================================================

@app.get("/api/configs")
async def list_configs(request: Request):
    require_auth(request)
    conn = get_db()
    rows = [dict(r) for r in conn.execute("SELECT * FROM config ORDER BY created_at DESC").fetchall()]
    conn.close()
    return {"ok": True, "configs": rows}

@app.post("/api/configs")
async def create_config(request: Request):
    admin = require_auth(request)
    body = await request.json()
    if not body.get("name"): return JSONResponse({"ok": False, "error": "نام الزامی"}, status_code=400)
    cid = str(uuid.uuid4())
    cuuid = body.get("uuid") or str(uuid.uuid4())
    host = get_public_host(request)
    now = datetime.now().isoformat()
    dl = int(body.get("dataLimit", 0)) * 1073741824 if body.get("dataLimit") else 0
    ed = int(body.get("expireDays", 0))
    exp = (datetime.now() + timedelta(days=ed)).isoformat() if ed > 0 else None
    conn = get_db()
    conn.execute("""INSERT INTO config (id, name, type, uuid, path, host, sni, tls, network, port, flow, status, data_limit, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (cid, body["name"], body.get("type", "vmess"), cuuid, f"/ws/{body.get('type', 'vmess')}",
         host, host, "tls", "ws", 443, body.get("flow"), body.get("status", "active"), dl, exp, now))
    conn.execute("INSERT INTO activity_log (id, action, entity, entity_id, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), "create", "config", cid, f"ساخت {body['name']}", admin["id"], now))
    conn.commit(); conn.close()
    schedule_xray_reload()
    return {"ok": True, "configId": cid}

@app.get("/api/configs/{cid}")
async def get_config(request: Request, cid: str):
    require_auth(request)
    host = get_public_host(request)
    conn = get_db()
    c = conn.execute("SELECT * FROM config WHERE id = ?", (cid,)).fetchone()
    conn.close()
    if not c: return JSONResponse({"ok": False, "error": "یافت نشد"}, status_code=404)
    return {"ok": True, "config": dict(c), "shareLink": gen_share_link(dict(c), host, PUBLIC_PORT)}

@app.put("/api/configs/{cid}")
async def update_config(request: Request, cid: str):
    admin = require_auth(request)
    body = await request.json()
    conn = get_db()
    existing = conn.execute("SELECT * FROM config WHERE id = ?", (cid,)).fetchone()
    if not existing: conn.close(); return JSONResponse({"ok": False, "error": "یافت نشد"}, status_code=404)
    updates = {}
    for f in ("name", "type", "flow", "status"):
        if f in body: updates[f] = body[f]
    if "dataLimit" in body: updates["data_limit"] = int(body["dataLimit"]) * 1073741824 if body["dataLimit"] else 0
    if "expireDays" in body:
        ed = int(body["expireDays"])
        updates["expires_at"] = (datetime.now() + timedelta(days=ed)).isoformat() if ed > 0 else None
    if "uuid" in body: updates["uuid"] = body["uuid"]
    if updates:
        conn.execute(f"UPDATE config SET {', '.join(f'{k}=?' for k in updates)} WHERE id = ?", list(updates.values()) + [cid])
    conn.execute("INSERT INTO activity_log (id, action, entity, entity_id, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), "update", "config", cid, f"ویرایش {body.get('name', existing['name'])}", admin["id"], datetime.now().isoformat()))
    conn.commit(); conn.close()
    schedule_xray_reload()
    return {"ok": True}

@app.delete("/api/configs/{cid}")
async def delete_config(request: Request, cid: str):
    admin = require_auth(request)
    conn = get_db()
    c = conn.execute("SELECT * FROM config WHERE id = ?", (cid,)).fetchone()
    if not c: conn.close(); return JSONResponse({"ok": False, "error": "یافت نشد"}, status_code=404)
    conn.execute("DELETE FROM config WHERE id = ?", (cid,))
    conn.execute("INSERT INTO activity_log (id, action, entity, entity_id, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), "delete", "config", cid, f"حذف {c['name']}", admin["id"], datetime.now().isoformat()))
    conn.commit(); conn.close()
    schedule_xray_reload()
    return {"ok": True}

# ==============================================================================
# Routes — Xray
# ==============================================================================

@app.get("/api/xray/status")
async def xray_status(request: Request):
    require_auth(request)
    return {"ok": True, "status": get_xray_status()}

@app.post("/api/xray/start")
async def xray_start(request: Request):
    admin = require_auth(request)
    r = start_xray()
    if r["ok"]:
        conn = get_db()
        conn.execute("INSERT INTO activity_log (id, action, entity, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "xray_start", "system", f"اجرای Xray PID:{r['pid']}", admin["id"], datetime.now().isoformat()))
        conn.commit(); conn.close()
    return r

@app.post("/api/xray/stop")
async def xray_stop(request: Request):
    admin = require_auth(request)
    r = stop_xray()
    if r["ok"]:
        conn = get_db()
        conn.execute("INSERT INTO activity_log (id, action, entity, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "xray_stop", "system", "توقف Xray", admin["id"], datetime.now().isoformat()))
        conn.commit(); conn.close()
    return r

@app.post("/api/xray/restart")
async def xray_restart(request: Request):
    admin = require_auth(request)
    r = restart_xray()
    if r["ok"]:
        conn = get_db()
        conn.execute("INSERT INTO activity_log (id, action, entity, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "xray_restart", "system", f"Restart PID:{r['pid']}", admin["id"], datetime.now().isoformat()))
        conn.commit(); conn.close()
    return r

@app.get("/api/xray/config")
async def xray_config(request: Request):
    require_auth(request)
    return {"ok": True, "config": generate_xray_config()}

@app.get("/api/xray/logs")
async def xray_logs(request: Request, lines: int = 100):
    require_auth(request)
    return {"ok": True, "content": read_log_tail(lines)}

# ==============================================================================
# Routes — QR & Stats
# ==============================================================================

@app.get("/api/qr")
async def qr_code(request: Request, id: str = "", text: str = ""):
    require_auth(request)
    host = get_public_host(request)
    content = text
    if id:
        conn = get_db()
        c = conn.execute("SELECT * FROM config WHERE id = ?", (id,)).fetchone()
        conn.close()
        if not c: return JSONResponse({"ok": False, "error": "یافت نشد"}, status_code=404)
        content = gen_share_link(dict(c), host, PUBLIC_PORT)
    if not content: return JSONResponse({"ok": False, "error": "متن ارسال نشده"}, status_code=400)
    return Response(content=make_qr(content), media_type="image/png")

@app.get("/api/stats")
async def stats(request: Request):
    require_auth(request)
    conn = get_db()
    total = conn.execute("SELECT COUNT(*) FROM config").fetchone()[0]
    active = conn.execute("SELECT COUNT(*) FROM config WHERE status = 'active'").fetchone()[0]
    by_type = {r["type"]: r["c"] for r in conn.execute("SELECT type, COUNT(*) as c FROM config GROUP BY type").fetchall()}
    logs = [dict(r) for r in conn.execute("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 5").fetchall()]
    conn.close()
    # Get traffic stats from access log (no gRPC needed)
    traffic = get_traffic_stats()
    return {"ok": True, "stats": {
        "configs": {"total": total, "active": active}, "byType": by_type,
        "traffic": traffic,
        "xray": get_xray_status(), "recentLogs": logs}}

@app.post("/api/seed")
async def seed_data(request: Request):
    admin = require_auth(request)
    conn = get_db()
    if conn.execute("SELECT COUNT(*) FROM config").fetchone()[0] > 0:
        conn.close(); return {"ok": True, "message": "قبلاً ایجاد شده"}
    now = datetime.now().isoformat()
    for proto in ("vmess", "vless", "trojan"):
        conn.execute("INSERT INTO config (id, name, type, uuid, path, host, sni, tls, network, port, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), f"sample-{proto}", proto, str(uuid.uuid4()), f"/ws/{proto}", "fastapicloud.com", "fastapicloud.com", "tls", "ws", 443, "active", now))
    conn.execute("INSERT INTO activity_log (id, action, entity, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), "seed", "system", "داده‌های نمونه", admin["id"], now))
    conn.commit(); conn.close()
    schedule_xray_reload()
    return {"ok": True, "message": "ایجاد شد"}

# ==============================================================================
# WebSocket Proxy — FastAPI server + aiohttp client (FAST!)
# ==============================================================================

@app.websocket("/ws/{proto}")
async def ws_proxy(ws: WebSocket, proto: str):
    """Proxy WebSocket using aiohttp client for fast throughput."""
    if proto not in XRAY_PORTS:
        await ws.close(code=1008); return
    if not is_xray_running():
        await ws.close(code=1011); return

    await ws.accept()
    xray_url = f"ws://127.0.0.1:{XRAY_PORTS[proto]}/ws/{proto}"
    session = await get_http_session()

    try:
        async with session.ws_connect(xray_url, max_msg_size=0, autoclose=False) as xray_ws:
            async def c2x():
                """client → Xray"""
                try:
                    while True:
                        data = await ws.receive_bytes()
                        await xray_ws.send_bytes(data)
                except (WebSocketDisconnect, Exception): pass

            async def x2c():
                """Xray → client"""
                try:
                    async for msg in xray_ws:
                        if msg.type == aiohttp.WSMsgType.BINARY:
                            await ws.send_bytes(msg.data)
                        elif msg.type == aiohttp.WSMsgType.TEXT:
                            await ws.send_text(msg.data)
                        elif msg.type == aiohttp.WSMsgType.CLOSE:
                            break
                except Exception: pass

            await asyncio.gather(c2x(), x2c(), return_exceptions=True)
    except Exception as e:
        log.error(f"WS proxy error {proto}: {e}")
    finally:
        try: await ws.close()
        except: pass

# This makes `fastapi run` find the app
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))
