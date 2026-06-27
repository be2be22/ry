"""WebSocket connection tracker — asyncio TCP proxy on 127.0.0.1:18082.

Why this exists
───────────────
nginx only writes its access_log entry for a WebSocket connection when the
tunnel *closes* (HTTP/1.1 Upgrade keeps the socket open until the client
disconnects).  That means active WS sessions are completely invisible to the
accounting loop, which reads the nginx log to discover online IPs.

This module runs a tiny transparent TCP proxy between nginx and Xray's WS
inbound (18080).  On every new connection it:

  1. Reads just enough bytes to see the HTTP request headers.
  2. Extracts the real client IP from the headers nginx already injects
     (X-Real-IP / X-Forwarded-For / X-Remote-Addr fallback).
  3. Writes the IP into state.IP_STATS with proto="ws" — immediately,
     while the session is still live.
  4. Forwards all bytes transparently to Xray on WS_PORT.

No extra processes, no nginx modules, no PROXY Protocol required.
"""
from __future__ import annotations

import asyncio
import ipaddress
import re
import time

from . import config, state

# ── header regexes (case-insensitive, matches raw bytes) ────────────────────
_CF_IP_RE     = re.compile(rb"(?i)cf-connecting-ip:\s*([^\r\n]+)")
_REAL_IP_RE   = re.compile(rb"(?i)x-real-ip:\s*([^\r\n]+)")
_XFF_RE       = re.compile(rb"(?i)x-forwarded-for:\s*([^\r\n]+)")
_REMOTE_RE    = re.compile(rb"(?i)x-remote-addr:\s*([^\r\n]+)")

# ── Cloudflare CIDR list (mirrors accounting.py) ────────────────────────────
_CF_NETS = tuple(
    ipaddress.ip_network(n, strict=False)
    for n in (
        "104.16.0.0/12", "108.162.192.0/18", "131.0.72.0/22",
        "141.101.64.0/18", "162.158.0.0/15", "172.64.0.0/13",
        "173.245.48.0/20", "188.114.96.0/20", "190.93.240.0/20",
        "197.234.240.0/22", "198.41.128.0/17",
        "89.222.0.0/15", "172.70.0.0/15", "172.68.0.0/14",
    )
)
_INTERNAL_PREFIXES = (
    "100.64.", "10.", "192.168.", "127.", "172.16.", "172.17.",
    "172.18.", "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
    "172.24.", "172.25.", "172.26.", "172.27.", "172.28.", "172.29.",
    "172.30.", "172.31.",
)


def _is_cf(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
        return any(addr in net for net in _CF_NETS)
    except ValueError:
        return False


def _pick_ip(raw: bytes | None) -> str | None:
    """Extract the first usable public IP from a comma-separated header value."""
    if not raw:
        return None
    for part in reversed(raw.decode("utf-8", "ignore").split(",")):
        ip = part.strip()
        if not ip or ip == "-":
            continue
        if _is_cf(ip):
            continue
        if any(ip.startswith(p) for p in _INTERNAL_PREFIXES):
            continue
        return ip
    return None


def _extract_ip(buf: bytes) -> str | None:
    """Try each header in priority order and return the first real client IP."""
    # 1. Cloudflare sets this to the original visitor IP
    m = _CF_IP_RE.search(buf)
    if m:
        ip = _pick_ip(m.group(1))
        if ip:
            return ip

    # 2. X-Real-IP is set by nginx from $http_x_forwarded_for
    #    (the XFF header Cloudflare injects, or whatever upstream sent)
    m = _REAL_IP_RE.search(buf)
    if m:
        ip = _pick_ip(m.group(1))
        if ip:
            return ip

    # 3. X-Forwarded-For chain (nginx sets $proxy_add_x_forwarded_for)
    m = _XFF_RE.search(buf)
    if m:
        ip = _pick_ip(m.group(1))
        if ip:
            return ip

    # 4. Last resort: $remote_addr that nginx injected as X-Remote-Addr.
    #    For direct (non-CF) clients this is the actual client IP.
    #    For CF clients it's a CF edge IP (already filtered above).
    m = _REMOTE_RE.search(buf)
    if m:
        raw_ip = m.group(1).decode("utf-8", "ignore").strip()
        if raw_ip and raw_ip != "-" and not _is_cf(raw_ip):
            if not any(raw_ip.startswith(p) for p in _INTERNAL_PREFIXES):
                return raw_ip

    return None


def _record_ws_ip(ip: str) -> None:
    """Write the WS connection into IP_STATS with proto=ws."""
    now = time.time()
    with state.lock:
        if len(state.IP_STATS) >= getattr(config, "MAX_TRACKED_IPS", 5000):
            # Evict oldest entry to make room
            oldest = min(state.IP_STATS, key=lambda k: state.IP_STATS[k].get("last", 0))
            state.IP_STATS.pop(oldest, None)
            state.ACTIVE_IPS.discard(oldest)

        rec = state.IP_STATS.get(ip)
        if not rec:
            rec = {
                "first": now, "last": now,
                "conns": 0, "proto": {},
                "up": 0, "down": 0, "up_delta": 0, "down_delta": 0,
            }
            state.IP_STATS[ip] = rec

        rec["last"] = now
        rec["conns"] = rec.get("conns", 0) + 1
        proto_dict = rec.setdefault("proto", {})
        proto_dict["ws"] = proto_dict.get("ws", 0) + 1
        state.ACTIVE_IPS.add(ip)


# ── pipe helper ──────────────────────────────────────────────────────────────

async def _pipe(src: asyncio.StreamReader, dst: asyncio.StreamWriter) -> None:
    try:
        while True:
            data = await src.read(65536)
            if not data:
                break
            dst.write(data)
            await dst.drain()
    except Exception:
        pass


# ── per-connection handler ───────────────────────────────────────────────────

async def _handle(
    client_r: asyncio.StreamReader,
    client_w: asyncio.StreamWriter,
) -> None:
    xray_w: asyncio.StreamWriter | None = None
    try:
        # Read until we have the full HTTP request headers (ends with \r\n\r\n).
        # WS upgrade headers are typically < 2 KB; cap at 16 KB for safety.
        buf = b""
        while b"\r\n\r\n" not in buf and len(buf) < 16384:
            try:
                chunk = await asyncio.wait_for(client_r.read(4096), timeout=10)
            except asyncio.TimeoutError:
                return
            if not chunk:
                return
            buf += chunk

        # Record the real client IP immediately — while the session is live.
        ip = _extract_ip(buf)
        if ip:
            _record_ws_ip(ip)

        # Open connection to Xray's WS inbound and replay the buffered headers.
        xray_r, xray_w = await asyncio.open_connection("127.0.0.1", config.WS_PORT)
        xray_w.write(buf)
        await xray_w.drain()

        # Pipe both directions until either side closes.
        await asyncio.gather(
            _pipe(client_r, xray_w),
            _pipe(xray_r, client_w),
        )
    except Exception:
        pass
    finally:
        for w in (client_w, xray_w):
            if w is not None:
                try:
                    w.close()
                except Exception:
                    pass


# ── public entry point ───────────────────────────────────────────────────────

async def start() -> None:
    """Start the WS tracker proxy.  Called once from server.py lifespan."""
    port = getattr(config, "WS_PROXY_PORT", 18082)
    server = await asyncio.start_server(_handle, "127.0.0.1", port)
    async with server:
        await server.serve_forever()
