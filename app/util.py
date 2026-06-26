"""Small formatting helpers shared across the control plane."""
from __future__ import annotations

import time


def fmt_bytes(n: int | float) -> str:
    """Human-readable byte count (B/KB/MB/GB/TB/PB)."""
    n = float(n or 0)
    for unit in ("B", "KB", "MB", "GB", "TB", "PB"):
        if n < 1024 or unit == "PB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.2f} {unit}"
        n /= 1024
    return f"{n:.2f} PB"


def fmt_speed(bps: int | float) -> str:
    return fmt_bytes(bps) + "/s"


def fmt_duration(seconds: int | float) -> str:
    seconds = int(max(0, seconds))
    d, rem = divmod(seconds, 86400)
    h, rem = divmod(rem, 3600)
    m, _ = divmod(rem, 60)
    if d:
        return f"{d}ر {h}س"
    if h:
        return f"{h}س {m}د"
    return f"{m}د"


def remaining_days(expiry: int) -> int:
    if not expiry:
        return 0
    return max(0, int((expiry - time.time()) / 86400))
