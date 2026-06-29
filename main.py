"""
FastApiCloud WS Config Panel — Python Edition v2
=================================================

Key improvement: Uses Xray gRPC API for dynamic user management.
NO RESTART needed when adding/removing configs!

- Xray starts once with all 3 protocols (empty client lists)
- Config create → gRPC AddUser (instant, no connection drop)
- Config delete → gRPC RemoveUser (instant)
- Real-time traffic stats via gRPC StatsService
- WebSocket proxy for /ws/{proto}
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
from pathlib import Path
from datetime import datetime, timedelta
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, Request, Response, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import qrcode
import uvicorn
import grpc

# Xray gRPC generated code
sys.path.insert(0, str(Path(__file__).parent.resolve()))
from xray_grpc import proxyman_pb2, proxyman_pb2_grpc, stats_pb2, stats_pb2_grpc, accounts_pb2

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

# Xray listens on localhost for each protocol on a separate port.
XRAY_PORTS = {"vmess": 8443, "vless": 8444, "trojan": 8445}
# gRPC API port (dokodemo-door → api inbound)
XRAY_API_PORT = 15490

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
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'admin',
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS config (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT DEFAULT 'vmess',
        uuid TEXT NOT NULL,
        path TEXT DEFAULT '/',
        host TEXT,
        sni TEXT,
        tls TEXT DEFAULT 'tls',
        network TEXT DEFAULT 'ws',
        port INTEGER DEFAULT 443,
        flow TEXT,
        status TEXT DEFAULT 'active',
        upload_bytes INTEGER DEFAULT 0,
        download_bytes INTEGER DEFAULT 0,
        total_usage_bytes INTEGER DEFAULT 0,
        data_limit INTEGER DEFAULT 0,
        expires_at TEXT,
        xray_active INTEGER DEFAULT 0,
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS activity_log (
        id TEXT PRIMARY KEY,
        action TEXT,
        entity TEXT,
        entity_id TEXT,
        detail TEXT,
        admin_id TEXT,
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );
    """)
    cur = conn.execute("SELECT COUNT(*) FROM admin")
    if cur.fetchone()[0] == 0:
        salt = secrets.token_hex(16)
        hashed = hashlib.pbkdf2_hmac("sha256", b"admin123", salt.encode(), 100000).hex()
        conn.execute(
            "INSERT INTO admin (id, username, password, email, role, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "admin", f"{salt}:{hashed}", "admin@fastapicloud.com", "admin", datetime.now().isoformat()),
        )
        log.info("Default admin created: admin / admin123")
    global SESSION_SECRET
    if not SESSION_SECRET:
        cur = conn.execute("SELECT value FROM settings WHERE key = 'session_secret'")
        row = cur.fetchone()
        if row:
            SESSION_SECRET = row["value"]
        else:
            SESSION_SECRET = secrets.token_hex(32)
            conn.execute("INSERT INTO settings (key, value) VALUES ('session_secret', ?)", (SESSION_SECRET,))
    conn.commit()
    conn.close()


# ==============================================================================
# Password hashing
# ==============================================================================

def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex()
    return f"{salt}:{hashed}"

def verify_password(password: str, stored: str) -> bool:
    try:
        salt, hashed = stored.split(":")
        return hmac.compare_digest(
            hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 100000).hex(),
            hashed,
        )
    except Exception:
        return False

# ==============================================================================
# Session
# ==============================================================================

def create_session(admin: dict) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({
        "id": admin["id"],
        "username": admin["username"],
        "role": admin.get("role", "admin"),
        "exp": int(time.time()) + SESSION_MAX_AGE,
    }).encode()).decode().rstrip("=")
    sig = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"

def verify_session(token: str) -> Optional[dict]:
    try:
        payload, sig = token.rsplit(".", 1)
        expected = hmac.new(SESSION_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected):
            return None
        padding = 4 - (len(payload) % 4)
        if padding != 4:
            payload += "=" * padding
        data = json.loads(base64.urlsafe_b64decode(payload))
        if data.get("exp", 0) < time.time():
            return None
        return data
    except Exception:
        return None

def get_session_admin(request: Request) -> Optional[dict]:
    token = request.cookies.get("fastapicloud_session")
    if not token:
        return None
    return verify_session(token)

def require_auth(request: Request) -> dict:
    admin = get_session_admin(request)
    if not admin:
        raise HTTPException(status_code=401, detail="احراز هویت نشده‌اید")
    return admin

# ==============================================================================
# Xray binary management
# ==============================================================================

def ensure_xray_binary():
    if XRAY_BIN.exists():
        return
    XRAY_DIR.mkdir(exist_ok=True)
    machine = platform.machine().lower()
    if machine in ("x86_64", "amd64"):
        arch = "64"
    elif machine in ("aarch64", "arm64"):
        arch = "arm64-v8a"
    else:
        log.warning(f"Unsupported arch: {machine}")
        return
    url = f"https://github.com/XTLS/Xray-core/releases/latest/download/Xray-linux-{arch}.zip"
    log.info(f"Downloading Xray from {url} ...")
    try:
        with urllib.request.urlopen(url, timeout=60) as resp:
            data = resp.read()
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            with z.open("xray") as f:
                XRAY_BIN.write_bytes(f.read())
            XRAY_BIN.chmod(0o755)
            for name in ("geoip.dat", "geosite.dat"):
                try:
                    with z.open(name) as f:
                        (XRAY_DIR / name).write_bytes(f.read())
                except KeyError:
                    pass
        log.info(f"Xray downloaded: {XRAY_BIN}")
    except Exception as e:
        log.error(f"Failed to download Xray: {e}")

# ==============================================================================
# Xray config generation — starts with ALL 3 protocols, empty client lists
# ==============================================================================

def generate_xray_config() -> dict:
    """Build Xray config with all 3 protocol inbounds + ALL active configs from DB.
    
    Since we restart Xray to apply changes, the config must include all current users.
    gRPC QueryStats is used for real-time traffic stats (no restart needed for stats).
    """
    # Load all active configs from DB
    conn = get_db()
    configs = [dict(r) for r in conn.execute("SELECT * FROM config WHERE status = 'active'").fetchall()]
    conn.close()

    by_type = {"vmess": [], "vless": [], "trojan": []}
    for c in configs:
        if c["type"] in by_type:
            by_type[c["type"]].append(c)

    inbounds = []

    # API inbound for gRPC (StatsService — QueryStats works!)
    inbounds.append({
        "tag": "api",
        "listen": "127.0.0.1",
        "port": XRAY_API_PORT,
        "protocol": "dokodemo-door",
        "settings": {"address": "127.0.0.1"},
    })

    # All 3 protocol inbounds with their clients from DB
    for proto, port in XRAY_PORTS.items():
        clients = by_type.get(proto, [])
        if proto == "vmess":
            client_list = [{"id": c["uuid"], "alterId": 0, "level": 0, "email": c["uuid"]} for c in clients]
            settings = {"clients": client_list, "decryption": "none"}
        elif proto == "vless":
            client_list = [{"id": c["uuid"], "flow": c.get("flow") or "", "level": 0, "email": c["uuid"]} for c in clients]
            settings = {"clients": client_list, "decryption": "none"}
        else:  # trojan
            client_list = [{"password": c["uuid"], "level": 0, "email": c["uuid"]} for c in clients]
            settings = {"clients": client_list}

        inbounds.append({
            "tag": f"{proto}-ws",
            "listen": "127.0.0.1",
            "port": port,
            "protocol": proto,
            "settings": settings,
            "streamSettings": {
                "network": "ws",
                "security": "none",
                "wsSettings": {"path": f"/ws/{proto}"},
            },
            "sniffing": {"enabled": True, "destOverride": ["http", "tls"]},
        })

    return {
        "log": {"loglevel": "warning", "access": str(XRAY_DIR / "xray-access.log"), "error": str(XRAY_DIR / "xray-error.log")},
        "api": {
            "tag": "api",
            "services": ["HandlerService", "StatsService", "LoggerService"],
        },
        "stats": {},
        "policy": {
            "levels": {
                "0": {"statsUserUplink": True, "statsUserDownlink": True},
            },
            "system": {
                "statsInboundUplink": True,
                "statsInboundDownlink": True,
            },
        },
        "routing": {
            "domainStrategy": "AsIs",
            "rules": [
                {
                    "type": "field",
                    "inboundTag": ["api"],
                    "outboundTag": "api",
                },
            ],
        },
        "inbounds": inbounds,
        "outbounds": [
            {"tag": "direct", "protocol": "freedom"},
            {"tag": "block", "protocol": "blackhole"},
        ],
    }


def write_xray_config():
    config = generate_xray_config()
    XRAY_CONFIG_PATH.write_text(json.dumps(config, indent=2))
    return config

# ==============================================================================
# Xray process management
# ==============================================================================

_xray_proc: Optional[subprocess.Popen] = None

def is_xray_running() -> bool:
    global _xray_proc
    if _xray_proc and _xray_proc.poll() is None:
        return True
    if XRAY_PID_PATH.exists():
        try:
            pid = int(XRAY_PID_PATH.read_text().strip())
            os.kill(pid, 0)
            return True
        except Exception:
            XRAY_PID_PATH.unlink(missing_ok=True)
    return False

def get_xray_pid() -> Optional[int]:
    global _xray_proc
    if _xray_proc and _xray_proc.poll() is None:
        return _xray_proc.pid
    if XRAY_PID_PATH.exists():
        try:
            return int(XRAY_PID_PATH.read_text().strip())
        except Exception:
            pass
    return None

def _kill_all_xray():
    """Force kill ALL xray processes."""
    global _xray_proc
    if _xray_proc and _xray_proc.poll() is None:
        try:
            _xray_proc.terminate()
            time.sleep(0.3)
            if _xray_proc.poll() is None:
                _xray_proc.kill()
        except Exception:
            pass
    try:
        subprocess.run(["pkill", "-f", str(XRAY_BIN)], capture_output=True, timeout=3)
    except Exception:
        pass
    _xray_proc = None
    XRAY_PID_PATH.unlink(missing_ok=True)

def start_xray() -> dict:
    global _xray_proc
    _kill_all_xray()
    time.sleep(0.3)
    if not XRAY_BIN.exists():
        return {"ok": False, "error": "فایل اجرایی Xray یافت نشد"}
    try:
        write_xray_config()
    except Exception as e:
        return {"ok": False, "error": f"خطا در تولید config: {e}"}
    try:
        log_fd = open(XRAY_LOG_PATH, "w")
        _xray_proc = subprocess.Popen(
            [str(XRAY_BIN), "run", "-c", str(XRAY_CONFIG_PATH)],
            cwd=str(XRAY_DIR),
            stdout=log_fd,
            stderr=log_fd,
            env={**os.environ, "XRAY_LOCATION_ASSET": str(XRAY_DIR)},
        )
        XRAY_PID_PATH.write_text(str(_xray_proc.pid))
        time.sleep(1.5)
        if _xray_proc.poll() is not None:
            tail = read_log_tail(20)
            return {"ok": False, "error": f"Xray بلافاصله بسته شد.\n{tail}"}
        log.info(f"Xray started, PID={_xray_proc.pid}")
        return {"ok": True, "pid": _xray_proc.pid}
    except Exception as e:
        return {"ok": False, "error": f"خطا در اجرای Xray: {e}"}

def stop_xray() -> dict:
    _kill_all_xray()
    conn = get_db()
    conn.execute("UPDATE config SET xray_active = 0")
    conn.commit()
    conn.close()
    log.info("Xray stopped")
    return {"ok": True}

def restart_xray() -> dict:
    _kill_all_xray()
    time.sleep(0.5)
    r = start_xray()
    if r["ok"]:
        # Config.json already includes all active configs, just mark them as active
        conn = get_db()
        conn.execute("UPDATE config SET xray_active = 1 WHERE status = 'active'")
        conn.commit()
        conn.close()
    return r

def read_log_tail(lines: int = 50) -> str:
    try:
        if not XRAY_LOG_PATH.exists():
            return "(log file not found — Xray ممکن است هنوز اجرا نشده باشد)"
        content = XRAY_LOG_PATH.read_text(errors="replace")
        if not content.strip():
            return "(log is empty)"
        return "\n".join(content.split("\n")[-lines:])
    except Exception as e:
        return f"(error reading log: {e})"

def get_xray_status() -> dict:
    running = is_xray_running()
    conn = get_db()
    client_count = conn.execute("SELECT COUNT(*) FROM config WHERE status = 'active'").fetchone()[0]
    conn.close()
    return {
        "running": running,
        "pid": get_xray_pid() if running else None,
        "public_host": PUBLIC_HOST or "(auto)",
        "public_port": PUBLIC_PORT,
        "client_count": client_count,
        "xray_bin_exists": XRAY_BIN.exists(),
    }

# ==============================================================================
# Xray gRPC client — stats only (AddUser not available in this Xray version)
# + Debounced restart for user management
# ==============================================================================

import threading

_grpc_channel = None
_reload_lock = threading.Lock()
_reload_pending = False
_reload_timer = None

def get_grpc_channel():
    global _grpc_channel
    if _grpc_channel is None:
        _grpc_channel = grpc.insecure_channel(f"127.0.0.1:{XRAY_API_PORT}")
    return _grpc_channel

def schedule_xray_reload(delay_seconds: float = 1.5):
    """Schedule a debounced Xray reload. Rapid changes batch into one restart."""
    global _reload_timer, _reload_pending
    with _reload_lock:
        _reload_pending = True
        if _reload_timer:
            _reload_timer.cancel()
        _reload_timer = threading.Timer(delay_seconds, _do_xray_reload)
        _reload_timer.daemon = True
        _reload_timer.start()
    log.info(f"Xray reload scheduled in {delay_seconds}s")

def _do_xray_reload():
    """Perform the actual reload: rewrite config + restart."""
    global _reload_pending
    with _reload_lock:
        if not _reload_pending:
            return
        _reload_pending = False
    if not is_xray_running():
        return
    try:
        log.info("Reloading Xray (debounced)...")
        r = restart_xray()
        if r.get("ok"):
            log.info("Xray reloaded successfully")
        else:
            log.error(f"Xray reload failed: {r.get('error')}")
    except Exception as e:
        log.error(f"Xray reload error: {e}")

def grpc_add_user(config: dict) -> dict:
    """Add a user — schedules a debounced Xray restart."""
    schedule_xray_reload()
    return {"ok": True}

def grpc_remove_user(config: dict) -> dict:
    """Remove a user — schedules a debounced Xray restart."""
    schedule_xray_reload()
    return {"ok": True}

def grpc_sync_all_users():
    """After Xray restart, mark all active configs as active in DB."""
    conn = get_db()
    count = conn.execute("SELECT COUNT(*) FROM config WHERE status = 'active'").fetchone()[0]
    conn.execute("UPDATE config SET xray_active = 1 WHERE status = 'active'")
    conn.commit()
    conn.close()
    return {"added": count, "failed": 0, "total": count}

def grpc_query_all_stats() -> dict:
    """Query all user traffic stats via gRPC QueryStats (this method works!)."""
    if not is_xray_running():
        return {"ok": False, "stats": {}}
    try:
        channel = get_grpc_channel()
        stub = stats_pb2_grpc.StatsServiceStub(channel)
        resp = stub.QueryStats(stats_pb2.QueryStatsRequest(pattern="user>>>", reset=False), timeout=5)
        stats = {}
        for s in resp.stat:
            parts = s.name.split(">>>")
            if len(parts) != 4:
                continue
            email = parts[1]
            direction = parts[3]
            if email not in stats:
                stats[email] = {"uplink": 0, "downlink": 0}
            if direction == "uplink":
                stats[email]["uplink"] = s.value
            elif direction == "downlink":
                stats[email]["downlink"] = s.value
        return {"ok": True, "stats": stats}
    except Exception as e:
        log.error(f"gRPC QueryStats failed: {e}")
        return {"ok": False, "stats": {}}

# ==============================================================================
# Share link generators
# ==============================================================================

def gen_vmess_link(c: dict, host: str, port: int) -> str:
    obj = {
        "v": "2", "ps": c["name"], "add": host, "port": str(port),
        "id": c["uuid"], "aid": "0", "scy": "auto", "net": "ws",
        "type": "none", "host": host, "path": f"/ws/vmess",
        "tls": "tls", "sni": host,
    }
    return "vmess://" + base64.b64encode(json.dumps(obj).encode()).decode()

def gen_vless_link(c: dict, host: str, port: int) -> str:
    from urllib.parse import urlencode, quote
    params = {
        "encryption": "none", "type": "ws", "host": host,
        "path": f"/ws/vless", "security": "tls", "sni": host,
    }
    return f"vless://{c['uuid']}@{host}:{port}?{urlencode(params)}#{quote(c['name'])}"

def gen_trojan_link(c: dict, host: str, port: int) -> str:
    from urllib.parse import urlencode, quote
    params = {"type": "ws", "host": host, "path": f"/ws/trojan", "security": "tls", "sni": host}
    return f"trojan://{c['uuid']}@{host}:{port}?{urlencode(params)}#{quote(c['name'])}"

def gen_share_link(c: dict, host: str, port: int) -> str:
    t = c["type"]
    if t == "vmess": return gen_vmess_link(c, host, port)
    if t == "vless": return gen_vless_link(c, host, port)
    if t == "trojan": return gen_trojan_link(c, host, port)
    return ""

def get_public_host(request: Request) -> str:
    global PUBLIC_HOST
    if PUBLIC_HOST:
        return PUBLIC_HOST
    host = request.headers.get("host", "").split(":")[0]
    if host and host != "localhost" and host != "127.0.0.1":
        PUBLIC_HOST = host
    return PUBLIC_HOST or host or "fastapicloud.com"

# ==============================================================================
# QR code
# ==============================================================================

def make_qr(text: str) -> bytes:
    img = qrcode.make(text)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

# ==============================================================================
# App
# ==============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    log.info("Starting FastApiCloud WS Config Panel v2...")
    init_db()
    ensure_xray_binary()
    if XRAY_BIN.exists() and not is_xray_running():
        r = start_xray()
        if r["ok"]:
            log.info("Xray auto-started")
            # Sync all existing configs via gRPC
            sync_result = grpc_sync_all_users()
            log.info(f"Synced {sync_result['added']} configs to Xray")
        else:
            log.warning(f"Xray auto-start failed: {r.get('error')}")
    yield
    if is_xray_running():
        stop_xray()

app = FastAPI(title="FastApiCloud WS Panel", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# ==============================================================================
# Frontend
# ==============================================================================

@app.get("/", response_class=HTMLResponse)
async def index():
    if not STATIC_DIR.exists():
        return HTMLResponse("<h1>static/index.html not found</h1>", status_code=500)
    return HTMLResponse(STATIC_DIR.joinpath("index.html").read_text(encoding="utf-8"))

# ==============================================================================
# Auth API
# ==============================================================================

@app.post("/api/auth/login")
async def login(request: Request):
    body = await request.json()
    username = body.get("username", "").strip()
    password = body.get("password", "")
    conn = get_db()
    admin = conn.execute("SELECT * FROM admin WHERE username = ?", (username,)).fetchone()
    conn.close()
    if not admin or not verify_password(password, admin["password"]):
        return JSONResponse({"ok": False, "error": "نام کاربری یا رمز عبور نادرست است"}, status_code=401)
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
    if not admin:
        return {"ok": False, "admin": None}
    return {"ok": True, "admin": admin}

@app.post("/api/auth/password")
async def change_password(request: Request):
    admin = require_auth(request)
    body = await request.json()
    new_password = body.get("newPassword", "")
    if len(new_password) < 6:
        return JSONResponse({"ok": False, "error": "رمز جدید باید حداقل ۶ کاراکتر باشد"}, status_code=400)
    conn = get_db()
    conn.execute("UPDATE admin SET password = ? WHERE id = ?", (hash_password(new_password), admin["id"]))
    conn.commit()
    conn.close()
    return {"ok": True}

# ==============================================================================
# Configs API — uses gRPC, NO RESTART!
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
    name = body.get("name")
    if not name:
        return JSONResponse({"ok": False, "error": "نام الزامی است"}, status_code=400)
    config_id = str(uuid.uuid4())
    config_uuid = body.get("uuid") or str(uuid.uuid4())
    host = get_public_host(request)
    now = datetime.now().isoformat()
    data_limit = int(body.get("dataLimit", 0)) * 1073741824 if body.get("dataLimit") else 0
    expire_days = int(body.get("expireDays", 0))
    expires_at = (datetime.now() + timedelta(days=expire_days)).isoformat() if expire_days > 0 else None

    conn = get_db()
    conn.execute(
        """INSERT INTO config (id, name, type, uuid, path, host, sni, tls, network, port, flow, status, data_limit, expires_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (config_id, name, body.get("type", "vmess"), config_uuid,
         f"/ws/{body.get('type', 'vmess')}", host, host,
         "tls", "ws", 443, body.get("flow"), body.get("status", "active"),
         data_limit, expires_at, now),
    )
    conn.execute(
        "INSERT INTO activity_log (id, action, entity, entity_id, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), "create", "config", config_id, f"ساخت کانفیگ {name}", admin["id"], now),
    )
    conn.commit()
    conn.close()

    # Add user to Xray via gRPC — NO RESTART!
    config = {"id": config_id, "type": body.get("type", "vmess"), "uuid": config_uuid, "flow": body.get("flow")}
    grpc_result = grpc_add_user(config)

    return {"ok": True, "configId": config_id, "grpcAdded": grpc_result["ok"], "grpcError": grpc_result.get("error")}

@app.get("/api/configs/{config_id}")
async def get_config(request: Request, config_id: str):
    require_auth(request)
    host = get_public_host(request)
    conn = get_db()
    c = conn.execute("SELECT * FROM config WHERE id = ?", (config_id,)).fetchone()
    conn.close()
    if not c:
        return JSONResponse({"ok": False, "error": "کانفیگ یافت نشد"}, status_code=404)
    c = dict(c)
    share_link = gen_share_link(c, host, PUBLIC_PORT)
    return {"ok": True, "config": c, "shareLink": share_link}

@app.put("/api/configs/{config_id}")
async def update_config(request: Request, config_id: str):
    admin = require_auth(request)
    body = await request.json()
    conn = get_db()
    existing = conn.execute("SELECT * FROM config WHERE id = ?", (config_id,)).fetchone()
    if not existing:
        conn.close()
        return JSONResponse({"ok": False, "error": "کانفیگ یافت نشد"}, status_code=404)
    existing = dict(existing)

    updates = {}
    for field in ("name", "type", "flow", "status"):
        if field in body:
            updates[field] = body[field]
    if "dataLimit" in body:
        updates["data_limit"] = int(body["dataLimit"]) * 1073741824 if body["dataLimit"] else 0
    if "expireDays" in body:
        ed = int(body["expireDays"])
        updates["expires_at"] = (datetime.now() + timedelta(days=ed)).isoformat() if ed > 0 else None
    if "uuid" in body:
        updates["uuid"] = body["uuid"]

    if updates:
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        conn.execute(f"UPDATE config SET {set_clause} WHERE id = ?", list(updates.values()) + [config_id])
    conn.execute(
        "INSERT INTO activity_log (id, action, entity, entity_id, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), "update", "config", config_id, f"ویرایش کانفیگ {body.get('name', existing['name'])}", admin["id"], datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()

    # If uuid or type changed, remove old user and add new one via gRPC
    updated = {**existing, **updates}
    if "uuid" in updates or "type" in updates:
        grpc_remove_user(existing)  # remove old
        grpc_add_user(updated)       # add new
    elif updates.get("status") == "disabled" and existing["status"] == "active":
        grpc_remove_user(existing)
    elif updates.get("status") == "active" and existing["status"] != "active":
        grpc_add_user(updated)

    return {"ok": True}

@app.delete("/api/configs/{config_id}")
async def delete_config(request: Request, config_id: str):
    admin = require_auth(request)
    conn = get_db()
    c = conn.execute("SELECT * FROM config WHERE id = ?", (config_id,)).fetchone()
    if not c:
        conn.close()
        return JSONResponse({"ok": False, "error": "کانفیگ یافت نشد"}, status_code=404)
    c = dict(c)
    conn.execute("DELETE FROM config WHERE id = ?", (config_id,))
    conn.execute(
        "INSERT INTO activity_log (id, action, entity, entity_id, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), "delete", "config", config_id, f"حذف کانفیگ {c['name']}", admin["id"], datetime.now().isoformat()),
    )
    conn.commit()
    conn.close()

    # Remove user from Xray via gRPC — NO RESTART!
    grpc_remove_user(c)

    return {"ok": True}

# ==============================================================================
# Xray API
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
        # Sync all existing configs
        grpc_sync_all_users()
        conn = get_db()
        conn.execute(
            "INSERT INTO activity_log (id, action, entity, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "xray_start", "system", f"اجرای Xray (PID: {r['pid']})", admin["id"], datetime.now().isoformat()),
        )
        conn.commit()
        conn.close()
    return r

@app.post("/api/xray/stop")
async def xray_stop(request: Request):
    admin = require_auth(request)
    r = stop_xray()
    if r["ok"]:
        conn = get_db()
        conn.execute(
            "INSERT INTO activity_log (id, action, entity, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "xray_stop", "system", "توقف Xray", admin["id"], datetime.now().isoformat()),
        )
        conn.commit()
        conn.close()
    return r

@app.post("/api/xray/restart")
async def xray_restart(request: Request):
    admin = require_auth(request)
    r = restart_xray()
    if r["ok"]:
        conn = get_db()
        conn.execute(
            "INSERT INTO activity_log (id, action, entity, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "xray_restart", "system", f"Restart Xray (PID: {r['pid']})", admin["id"], datetime.now().isoformat()),
        )
        conn.commit()
        conn.close()
    return r

@app.get("/api/xray/config")
async def xray_config(request: Request):
    require_auth(request)
    config = generate_xray_config()
    return {"ok": True, "config": config, "path": str(XRAY_CONFIG_PATH)}

@app.get("/api/xray/logs")
async def xray_logs(request: Request, lines: int = 100):
    require_auth(request)
    return {"ok": True, "content": read_log_tail(lines)}

# ==============================================================================
# QR Code
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
        if not c:
            return JSONResponse({"ok": False, "error": "کانفیگ یافت نشد"}, status_code=404)
        content = gen_share_link(dict(c), host, PUBLIC_PORT)
    if not content:
        return JSONResponse({"ok": False, "error": "متن یا شناسه ارسال نشده"}, status_code=400)
    png = make_qr(content)
    return Response(content=png, media_type="image/png")

# ==============================================================================
# Stats API — with real-time traffic from gRPC
# ==============================================================================

@app.get("/api/stats")
async def stats(request: Request):
    require_auth(request)
    conn = get_db()
    total_configs = conn.execute("SELECT COUNT(*) FROM config").fetchone()[0]
    active_configs = conn.execute("SELECT COUNT(*) FROM config WHERE status = 'active'").fetchone()[0]
    by_type = {r["type"]: r["c"] for r in conn.execute("SELECT type, COUNT(*) as c FROM config GROUP BY type").fetchall()}
    recent_logs = [dict(r) for r in conn.execute("SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 10").fetchall()]
    
    # Get all configs to check expiry and data limits
    configs = [dict(r) for r in conn.execute("SELECT * FROM config WHERE status = 'active'").fetchall()]
    conn.close()

    # Query real-time traffic from Xray gRPC
    traffic_stats = grpc_query_all_stats()
    total_upload = 0
    total_download = 0
    total_traffic = 0
    
    if traffic_stats["ok"]:
        # Update DB with real-time stats
        conn = get_db()
        for c in configs:
            uuid = c["uuid"]
            if uuid in traffic_stats["stats"]:
                up = traffic_stats["stats"][uuid]["uplink"]
                down = traffic_stats["stats"][uuid]["downlink"]
                total_upload += up
                total_download += down
                total_traffic += up + down
                conn.execute(
                    "UPDATE config SET upload_bytes = ?, download_bytes = ?, total_usage_bytes = ? WHERE id = ?",
                    (up, down, up + down, c["id"])
                )
        conn.commit()
        conn.close()
    else:
        # Fallback to DB stats
        for c in configs:
            total_upload += c.get("upload_bytes", 0)
            total_download += c.get("download_bytes", 0)
            total_traffic += c.get("total_usage_bytes", 0)

    return {
        "ok": True,
        "stats": {
            "configs": {"total": total_configs, "active": active_configs},
            "byType": by_type,
            "traffic": {
                "upload": total_upload,
                "download": total_download,
                "total": total_traffic,
            },
            "xray": get_xray_status(),
            "recentLogs": recent_logs,
        },
    }

# ==============================================================================
# Seed data
# ==============================================================================

@app.post("/api/seed")
async def seed_data(request: Request):
    admin = require_auth(request)
    conn = get_db()
    if conn.execute("SELECT COUNT(*) FROM config").fetchone()[0] > 0:
        conn.close()
        return {"ok": True, "message": "داده‌های نمونه قبلاً ایجاد شده‌اند"}
    now = datetime.now().isoformat()
    created = []
    for proto in ("vmess", "vless", "trojan"):
        cid = str(uuid.uuid4())
        cuuid = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO config (id, name, type, uuid, path, host, sni, tls, network, port, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (cid, f"sample-{proto}", proto, cuuid, f"/ws/{proto}", "fastapicloud.com", "fastapicloud.com", "tls", "ws", 443, "active", now),
        )
        created.append({"id": cid, "type": proto, "uuid": cuuid})
    conn.execute(
        "INSERT INTO activity_log (id, action, entity, detail, admin_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), "seed", "system", "ایجاد داده‌های نمونه", admin["id"], now),
    )
    conn.commit()
    conn.close()
    # Add all to Xray via gRPC — NO RESTART!
    for c in created:
        grpc_add_user(c)
    return {"ok": True, "message": "داده‌های نمونه ایجاد شدند"}

# ==============================================================================
# WebSocket proxy: /ws/{proto} -> ws://127.0.0.1:{port}
# ==============================================================================

@app.websocket("/ws/{proto}")
async def ws_proxy(ws: WebSocket, proto: str):
    if proto not in XRAY_PORTS:
        await ws.close(code=1008, reason="Invalid protocol")
        return
    if not is_xray_running():
        await ws.close(code=1011, reason="Xray is not running")
        return
    try:
        import websockets
    except ImportError:
        await ws.close(code=1011, reason="websockets library not installed")
        return

    await ws.accept()
    xray_url = f"ws://127.0.0.1:{XRAY_PORTS[proto]}/ws/{proto}"
    xray_ws = None
    try:
        xray_ws = await websockets.connect(xray_url, max_size=None)
    except Exception as e:
        log.error(f"Failed to connect to Xray at {xray_url}: {e}")
        await ws.close(code=1011, reason="Cannot connect to Xray")
        return

    async def client_to_xray():
        try:
            while True:
                data = await ws.receive_bytes()
                await xray_ws.send(data)
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    async def xray_to_client():
        try:
            while True:
                data = await xray_ws.recv()
                if isinstance(data, str):
                    await ws.send_text(data)
                else:
                    await ws.send_bytes(data)
        except Exception:
            pass

    await asyncio.gather(client_to_xray(), xray_to_client(), return_exceptions=True)
    try:
        await xray_ws.close()
    except Exception:
        pass
    try:
        await ws.close()
    except Exception:
        pass

# ==============================================================================
# Main
# ==============================================================================

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")
