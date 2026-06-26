#!/usr/bin/env python3
"""
Aurora v3 — Self-Diagnostic Script

Run this BEFORE deploying to Railway to catch all integration issues:
    python3 /path/to/diagnose.py

Or run it ON the Railway container via `railway shell`:
    python3 /app/diagnose.py

What it checks:
  1. Environment variables & config completeness
  2. Xray binary presence & version
  3. GeoIP database presence
  4. Data directory writability
  5. GitHub API connectivity (with token)
  6. Axiom API connectivity (with token)
  7. Telegram bot connectivity (with token)
  8. All Python module imports
  9. FastAPI app construction
 10. bcrypt / pydantic availability
 11. Port availability
 12. nginx config validity (if running on container)

Exit code: 0 = all OK, 1 = warnings, 2 = critical errors
"""
from __future__ import annotations

import asyncio
import os
import shutil
import socket
import subprocess
import sys
import traceback
from pathlib import Path

# Colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
RESET = "\033[0m"
BOLD = "\033[1m"

results: list[tuple[str, str, str]] = []  # (status, name, detail)
# status: OK / WARN / FAIL


def check(name: str, status: str, detail: str = "") -> None:
    results.append((status, name, detail))
    icon = {"OK": f"{GREEN}✓", "WARN": f"{YELLOW}⚠", "FAIL": f"{RED}✗"}[status]
    print(f"  {icon} {name}{RESET}" + (f" — {detail}" if detail else ""))


def section(title: str) -> None:
    print(f"\n{CYAN}{BOLD}═══ {title} ═══{RESET}")


# ═══════════════════════════════════════════════════════════════════
section("1. Environment Variables")
# ═══════════════════════════════════════════════════════════════════

critical_envs = ["ADMIN_PASSWORD", "PUBLIC_HOST"]
optional_envs = [
    "GH_TOKEN", "GH_REPO", "AXIOM_TOKEN", "TG_BOT_TOKEN",
    "TG_ADMIN_ID", "TG_WEBHOOK_SECRET", "MASTER_UUID",
    "TCP_PROXY_DOMAIN", "REALITY_DEST",
]

for var in critical_envs:
    val = os.environ.get(var, "")
    if val:
        check(f"ENV {var}", "OK", "set")
    else:
        check(f"ENV {var}", "FAIL", "MISSING (critical)")

for var in optional_envs:
    val = os.environ.get(var, "")
    if val:
        check(f"ENV {var}", "OK", "set")
    else:
        check(f"ENV {var}", "WARN", "not set (optional)")


# ═══════════════════════════════════════════════════════════════════
section("2. Xray Binary")
# ═══════════════════════════════════════════════════════════════════

core_bin = os.environ.get("CORE_BIN", "/usr/local/bin/core")
if Path(core_bin).exists():
    try:
        out = subprocess.run(
            [core_bin, "version"], capture_output=True, text=True, timeout=5
        ).stdout.strip()
        check("Xray binary", "OK", out.split("\n")[0] if out else "present")
    except Exception as e:
        check("Xray binary", "WARN", f"present but version check failed: {e}")
else:
    check("Xray binary", "FAIL", f"not found at {core_bin}")

# Test x25519 key generation
if Path(core_bin).exists():
    try:
        out = subprocess.run(
            [core_bin, "x25519"], capture_output=True, text=True, timeout=5
        ).stdout
        if "Private key:" in out and "Public key:" in out:
            check("Xray x25519", "OK", "key generation works")
        else:
            check("Xray x25519", "FAIL", f"unexpected output: {out[:100]}")
    except Exception as e:
        check("Xray x25519", "FAIL", str(e))


# ═══════════════════════════════════════════════════════════════════
section("3. GeoIP Database")
# ═══════════════════════════════════════════════════════════════════

geoip_path = os.environ.get("GEOIP_DB_PATH", "/app/data/dbip-country-lite.mmdb")
if Path(geoip_path).exists():
    size = Path(geoip_path).stat().st_size
    if size > 1_000_000:
        check("GeoIP DB", "OK", f"{size / 1024 / 1024:.1f} MB")
    else:
        check("GeoIP DB", "WARN", f"file too small ({size} bytes)")
else:
    check("GeoIP DB", "WARN", f"not found at {geoip_path} (country lookup disabled)")


# ═══════════════════════════════════════════════════════════════════
section("4. Data Directory Writability")
# ═══════════════════════════════════════════════════════════════════

data_dir = os.environ.get("DATA_DIR", "/app/data")
try:
    Path(data_dir).mkdir(parents=True, exist_ok=True)
    test_file = Path(data_dir) / ".diagnose_test"
    test_file.write_text("test")
    test_file.unlink()
    check("Data dir", "OK", f"{data_dir} writable")
except Exception as e:
    check("Data dir", "FAIL", f"{data_dir} not writable: {e}")


# ═══════════════════════════════════════════════════════════════════
section("5. Python Dependencies")
# ═══════════════════════════════════════════════════════════════════

deps = [
    ("fastapi", "fastapi"),
    ("uvicorn", "uvicorn"),
    ("httpx", "httpx"),
    ("segno", "segno"),
    ("geoip2", "geoip2"),
    ("bcrypt", "bcrypt"),
    ("pydantic", "pydantic"),
]
for module, package in deps:
    try:
        __import__(module)
        check(f"Package {package}", "OK")
    except ImportError:
        check(f"Package {package}", "FAIL", "not installed")


# ═══════════════════════════════════════════════════════════════════
section("6. App Module Imports")
# ═══════════════════════════════════════════════════════════════════

# Add parent dir to path
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir))

modules_to_test = [
    "app",
    "app.config",
    "app.state",
    "app.http_util",
    "app.security",
    "app.storage",
    "app.engine",
    "app.sysmetrics",
    "app.accounting",
    "app.ghsync",
    "app.axiom_logs",
    "app.schemas",
    "app.util",
    "app.geo",
    "app.notify",
    "app.subs",
    "app.bot",
    "app.server",
    "app.services",
    "app.services.user_service",
]
for mod in modules_to_test:
    try:
        __import__(mod)
        check(f"Import {mod}", "OK")
    except Exception as e:
        check(f"Import {mod}", "FAIL", str(e))


# ═══════════════════════════════════════════════════════════════════
section("7. FastAPI App Construction")
# ═══════════════════════════════════════════════════════════════════

try:
    from app.server import build_app
    app = build_app()
    routes = [r.path for r in app.routes if hasattr(r, "path")]
    check("FastAPI app", "OK", f"{len(routes)} routes")
    # Verify critical routes exist
    critical_routes = ["/up", "/tg/{secret}", "/s/{sid}"]
    admin_path = os.environ.get("ADMIN_PATH", "manage").strip("/") or "manage"
    critical_routes.extend([
        f"/{admin_path}",
        f"/{admin_path}/api/login",
        f"/{admin_path}/api/overview",
        f"/{admin_path}/api/users",
    ])
    for cr in critical_routes:
        if cr in routes:
            check(f"Route {cr}", "OK")
        else:
            check(f"Route {cr}", "FAIL", "missing")
except Exception as e:
    check("FastAPI app", "FAIL", str(e))
    traceback.print_exc()


# ═══════════════════════════════════════════════════════════════════
section("8. Security Functions")
# ═══════════════════════════════════════════════════════════════════

try:
    from app import security, state
    security.set_password("test123")
    ok = security.verify_password("test123")
    bad = security.verify_password("wrong")
    if ok and not bad:
        check("bcrypt hash/verify", "OK")
    else:
        check("bcrypt hash/verify", "FAIL", "logic error")

    token = security.open_session()
    valid = security.valid_session(token)
    security.close_session(token)
    if valid:
        check("Session management", "OK")
    else:
        check("Session management", "FAIL", "token not valid")

    # Rate limiter
    allowed = security.allow("1.2.3.4", "test", limit=2, window=60)
    allowed2 = security.allow("1.2.3.4", "test", limit=2, window=60)
    blocked = security.allow("1.2.3.4", "test", limit=2, window=60)
    if allowed and allowed2 and not blocked:
        check("Rate limiter", "OK")
    else:
        check("Rate limiter", "FAIL", "logic error")
except Exception as e:
    check("Security functions", "FAIL", str(e))


# ═══════════════════════════════════════════════════════════════════
section("9. Pydantic Schemas")
# ═══════════════════════════════════════════════════════════════════

try:
    from app.schemas import CreateUserRequest, EditUserRequest, LoginRequest
    # Valid
    req = CreateUserRequest(label="Test", days=30, gb=50)
    check("Schema valid input", "OK")
    # Invalid: negative days
    try:
        CreateUserRequest(days=-1)
        check("Schema rejects bad input", "FAIL", "accepted negative days")
    except Exception:
        check("Schema rejects bad input", "OK")
    # Invalid: too long label
    try:
        CreateUserRequest(label="x" * 100)
        check("Schema rejects long label", "FAIL", "accepted 100-char label")
    except Exception:
        check("Schema rejects long label", "OK")
except Exception as e:
    check("Pydantic schemas", "FAIL", str(e))


# ═══════════════════════════════════════════════════════════════════
section("10. Port Availability")
# ═══════════════════════════════════════════════════════════════════

for port in [5000, 10085, 18080]:
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        if sock.connect_ex(("127.0.0.1", port)) == 0:
            check(f"Port {port}", "WARN", "already in use")
        else:
            check(f"Port {port}", "OK", "available")
    finally:
        sock.close()


# ═══════════════════════════════════════════════════════════════════
section("11. Async Integration Tests (Network)")
# ═══════════════════════════════════════════════════════════════════

async def test_github():
    """Test GitHub API connectivity with token."""
    from app import config
    if not config.gh_enabled():
        check("GitHub API", "WARN", f"disabled: {config.gh_disabled_reason()}")
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"https://api.github.com/repos/{config.GH_REPO}",
                headers={
                    "Authorization": f"Bearer {config.GH_TOKEN}",
                    "Accept": "application/vnd.github+json",
                },
            )
            if r.status_code == 200:
                data = r.json()
                check("GitHub API", "OK", f"repo: {data.get('full_name', '?')}")
            elif r.status_code == 401:
                check("GitHub API", "FAIL", "token invalid (401)")
            elif r.status_code == 404:
                check("GitHub API", "FAIL", f"repo {config.GH_REPO} not found (404)")
            else:
                check("GitHub API", "FAIL", f"HTTP {r.status_code}")
    except Exception as e:
        check("GitHub API", "FAIL", str(e))


async def test_axiom():
    """Test Axiom API connectivity."""
    from app import config
    if not config.AXIOM_TOKEN:
        check("Axiom API", "WARN", "AXIOM_TOKEN not set")
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"https://api.axiom.co/v2/datasets/{config.AXIOM_DATASET}",
                headers={"Authorization": f"Bearer {config.AXIOM_TOKEN}"},
            )
            if r.status_code == 200:
                check("Axiom API", "OK", f"dataset: {config.AXIOM_DATASET}")
            elif r.status_code == 401:
                check("Axiom API", "FAIL", "token invalid (401)")
            elif r.status_code == 404:
                check("Axiom API", "WARN", f"dataset {config.AXIOM_DATASET} not found (will be auto-created)")
            else:
                check("Axiom API", "FAIL", f"HTTP {r.status_code}")
    except Exception as e:
        check("Axiom API", "FAIL", str(e))


async def test_telegram():
    """Test Telegram bot connectivity."""
    from app import config
    if not config.TG_TOKEN:
        check("Telegram bot", "WARN", "TG_BOT_TOKEN not set")
        return
    try:
        import httpx
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"https://api.telegram.org/bot{config.TG_TOKEN}/getMe"
            )
            data = r.json()
            if data.get("ok"):
                bot_info = data.get("result", {})
                check("Telegram bot", "OK", f"@{bot_info.get('username', '?')}")
            else:
                check("Telegram bot", "FAIL", f"API error: {data.get('description', '?')}")
    except Exception as e:
        check("Telegram bot", "FAIL", str(e))

    # Check webhook secret
    if not config.TG_WEBHOOK_SECRET:
        check("TG webhook secret", "FAIL", "not set (bot will be disabled)")
    else:
        check("TG webhook secret", "OK", f"length: {len(config.TG_WEBHOOK_SECRET)}")

    # Check admin ID
    if not config.TG_ADMIN_ID:
        check("TG admin ID", "WARN", "not set")
    else:
        check("TG admin ID", "OK")


async def test_all_async():
    await asyncio.gather(test_github(), test_axiom(), test_telegram())


try:
    asyncio.run(test_all_async())
except Exception as e:
    check("Async tests", "FAIL", str(e))


# ═══════════════════════════════════════════════════════════════════
section("12. nginx Config (if present)")
# ═══════════════════════════════════════════════════════════════════

if shutil.which("nginx"):
    try:
        r = subprocess.run(
            ["nginx", "-t"], capture_output=True, text=True, timeout=5
        )
        if r.returncode == 0:
            check("nginx config", "OK")
        else:
            check("nginx config", "FAIL", r.stderr.strip()[:200])
    except Exception as e:
        check("nginx config", "FAIL", str(e))
else:
    check("nginx", "WARN", "not installed (skip if running locally)")


# ═══════════════════════════════════════════════════════════════════
section("13. Internal HTTP Smoke Test (if app can start)")
# ═══════════════════════════════════════════════════════════════════

try:
    from fastapi.testclient import TestClient
    from app.server import build_app
    app = build_app()
    client = TestClient(app)

    # /up should work without lifespan (no deps)
    with client:
        r = client.get("/up")
        if r.status_code == 200 and r.text == "ok":
            check("GET /up", "OK")
        else:
            check("GET /up", "FAIL", f"status={r.status_code}")

        # Root
        r = client.get("/")
        if r.status_code == 200:
            check("GET /", "OK")
        else:
            check("GET /", "FAIL", f"status={r.status_code}")

        # Admin path (should serve login)
        admin_path = os.environ.get("ADMIN_PATH", "manage").strip("/") or "manage"
        r = client.get(f"/{admin_path}")
        if r.status_code == 200:
            check(f"GET /{admin_path}", "OK")
        else:
            check(f"GET /{admin_path}", "FAIL", f"status={r.status_code}")

        # Unauthorized overview (should 401)
        r = client.get(f"/{admin_path}/api/overview")
        if r.status_code == 401:
            check("Auth gate /api/overview", "OK", "returns 401 when unauthed")
        else:
            check("Auth gate /api/overview", "FAIL", f"expected 401, got {r.status_code}")

        # Login with wrong password
        r = client.post(f"/{admin_path}/api/login", json={"password": "wrong"})
        if r.status_code == 401:
            check("Login wrong password", "OK", "returns 401")
        else:
            check("Login wrong password", "FAIL", f"expected 401, got {r.status_code}")

        # Login with correct password (if ADMIN_PASSWORD set)
        admin_pw = os.environ.get("ADMIN_PASSWORD", "")
        if admin_pw:
            r = client.post(f"/{admin_path}/api/login", json={"password": admin_pw})
            if r.status_code == 200 and "as" in r.cookies:
                check("Login correct password", "OK")
                # Test authed endpoint
                r = client.get(f"/{admin_path}/api/overview")
                if r.status_code == 200:
                    check("Authed /api/overview", "OK")
                else:
                    check("Authed /api/overview", "FAIL", f"status={r.status_code}")
            else:
                check("Login correct password", "FAIL", f"status={r.status_code}")
        else:
            check("Login correct password", "WARN", "ADMIN_PASSWORD not set, skipped")

except Exception as e:
    check("HTTP smoke test", "FAIL", str(e))
    traceback.print_exc()


# ═══════════════════════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════════════════════

print(f"\n{CYAN}{BOLD}════════════════ SUMMARY ════════════════{RESET}")

ok_count = sum(1 for s, _, _ in results if s == "OK")
warn_count = sum(1 for s, _, _ in results if s == "WARN")
fail_count = sum(1 for s, _, _ in results if s == "FAIL")

print(f"  {GREEN}✓ OK:    {ok_count}{RESET}")
print(f"  {YELLOW}⚠ WARN:  {warn_count}{RESET}")
print(f"  {RED}✗ FAIL:  {fail_count}{RESET}")
print(f"  Total: {len(results)} checks")

print(f"\n{BOLD}Verdict:{RESET}", end=" ")
if fail_count > 0:
    print(f"{RED}{BOLD}CRITICAL ERRORS — fix before deploying{RESET}")
    print(f"\n{BOLD}Failed checks:{RESET}")
    for status, name, detail in results:
        if status == "FAIL":
            print(f"  {RED}✗ {name}{RESET}" + (f" — {detail}" if detail else ""))
    sys.exit(2)
elif warn_count > 0:
    print(f"{YELLOW}{BOLD}READY with warnings{RESET}")
    print(f"\n{BOLD}Warnings:{RESET}")
    for status, name, detail in results:
        if status == "WARN":
            print(f"  {YELLOW}⚠ {name}{RESET}" + (f" — {detail}" if detail else ""))
    sys.exit(1)
else:
    print(f"{GREEN}{BOLD}ALL CLEAR — ready to deploy! 🚀{RESET}")
    sys.exit(0)
