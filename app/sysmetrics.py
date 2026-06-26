"""Container-aware system metrics: CPU%, memory, NIC throughput.

v3 changes:
  - Cleaner structure, all reads wrapped in try/except.
  - Reset deltas when counters go backwards (container restart).
  - Pure stdlib, microsecond-cheap.
"""
from __future__ import annotations

import os
import time

from . import state

_CG2 = "/sys/fs/cgroup"
_prev: dict = {"cpu_usec": 0, "ts": 0.0, "rx": 0, "tx": 0, "reset": False}


def _read_int(path: str) -> int | None:
    try:
        with open(path) as f:
            v = f.read().strip()
        return int(v) if v.isdigit() else None
    except Exception:
        return None


def _ncpu() -> int:
    try:
        with open(f"{_CG2}/cpu.max") as f:
            parts = f.read().split()
            if len(parts) == 2 and parts[0] != "max":
                quota, period = int(parts[0]), int(parts[1])
                if period > 0:
                    return max(1, round(quota / period))
    except Exception:
        pass
    return os.cpu_count() or 1


def _mem() -> tuple[int, int]:
    used = _read_int(f"{_CG2}/memory.current")
    total = _read_int(f"{_CG2}/memory.max")
    if used is None:
        used = _read_int("/sys/fs/cgroup/memory/memory.usage_in_bytes")
        total = _read_int("/sys/fs/cgroup/memory/memory.limit_in_bytes")
    if not total or total > (1 << 60):
        total = 0
        try:
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        total = int(line.split()[1]) * 1024
                        break
        except Exception:
            pass
    return used or 0, total or 0


def _cpu_usec() -> int:
    try:
        with open(f"{_CG2}/cpu.stat") as f:
            for line in f:
                if line.startswith("usage_usec"):
                    return int(line.split()[1])
    except Exception:
        pass
    v1 = _read_int("/sys/fs/cgroup/cpuacct/cpuacct.usage")
    return (v1 // 1000) if v1 else 0


def _net() -> tuple[int, int]:
    rx = tx = 0
    try:
        with open("/proc/net/dev") as f:
            for _ in range(2):
                f.readline()
            for line in f:
                name, _, rest = line.partition(":")
                if name.strip() == "lo":
                    continue
                cols = rest.split()
                if len(cols) >= 9:
                    rx += int(cols[0])
                    tx += int(cols[8])
    except Exception:
        pass
    return rx, tx


def refresh() -> None:
    """Update state.SYS with fresh CPU/MEM/NET metrics.

    Call this from a worker thread (asyncio.to_thread) to avoid blocking
    the event loop on filesystem reads.
    """
    now = time.time()
    cpu_usec = _cpu_usec()
    rx, tx = _net()
    used, total = _mem()

    dt = now - _prev["ts"] if _prev["ts"] else 0
    if dt > 0:
        d_cpu = cpu_usec - _prev["cpu_usec"]
        if d_cpu < 0:
            # Counter reset (container restart) — skip this cycle
            _prev["reset"] = True
        else:
            _prev["reset"] = False
            pct = (d_cpu / (dt * 1_000_000)) * 100 / max(1, _ncpu())
            state.SYS["cpu"] = round(max(0.0, min(100.0, pct)), 1)

        d_rx = rx - _prev["rx"]
        d_tx = tx - _prev["tx"]
        # If counters went backwards, skip this cycle's bps update
        if d_rx >= 0 and not _prev.get("reset"):
            state.SYS["rx_bps"] = max(0, int(d_rx / dt))
        if d_tx >= 0 and not _prev.get("reset"):
            state.SYS["tx_bps"] = max(0, int(d_tx / dt))

    state.SYS["mem_used"] = used
    state.SYS["mem_total"] = total
    state.SYS["rx"] = rx
    state.SYS["tx"] = tx

    _prev["cpu_usec"] = cpu_usec
    _prev["ts"] = now
    _prev["rx"] = rx
    _prev["tx"] = tx
