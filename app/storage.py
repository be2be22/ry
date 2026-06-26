"""Local persistence + GitHub state mirror orchestration.

v3 changes:
  - Atomic writes now fsync() before rename (crash-safe).
  - Boot-load tracks users.json and stats.json independently.
  - Debounced local saves (only one write per persist_tick, even with many
    admin mutations in between).
  - History is restored as deque(maxlen=...).
  - Cleanup of stale *.tmp files on boot.
"""
from __future__ import annotations

import json
import os
import tempfile
import time
from pathlib import Path

from . import config, state, ghsync


def _atomic_write(path: str, text: str) -> None:
    """Write text to path atomically with fsync for crash safety."""
    d = os.path.dirname(path)
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=d, suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as f:
            f.write(text)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass


def _cleanup_tmp_files() -> None:
    """Remove leftover *.tmp files from previous crashed writes."""
    try:
        data_dir = Path(config.DATA_DIR)
        if not data_dir.exists():
            return
        for tmp in data_dir.glob("*.tmp"):
            try:
                tmp.unlink()
            except OSError:
                pass
    except Exception:
        pass


def save_local() -> None:
    """Serialize USERS and STATS to local JSON files (atomic + fsync)."""
    with state.lock:
        users = json.dumps(
            state.USERS, ensure_ascii=False, separators=(",", ":")
        )
        # history may be a deque; convert to list for JSON
        stats_copy = dict(state.STATS)
        if hasattr(stats_copy.get("history"), "__iter__") and not isinstance(
            stats_copy.get("history"), list
        ):
            stats_copy["history"] = list(stats_copy["history"])
        stats = json.dumps(
            stats_copy, ensure_ascii=False, separators=(",", ":")
        )
    _atomic_write(config.USERS_FILE, users)
    _atomic_write(config.STATS_FILE, stats)


def _load_local() -> tuple[bool, bool]:
    """Returns (users_loaded, stats_loaded)."""
    users_ok = False
    stats_ok = False
    try:
        if os.path.exists(config.USERS_FILE):
            with open(config.USERS_FILE, encoding="utf-8") as f:
                with state.lock:
                    state.USERS.clear()
                    state.USERS.update(json.load(f))
            users_ok = True
        if os.path.exists(config.STATS_FILE):
            with open(config.STATS_FILE, encoding="utf-8") as f:
                with state.lock:
                    state.STATS.update(json.load(f))
            stats_ok = True
    except Exception as e:  # noqa: BLE001
        state.log_error(f"load_local: {e}")
    return users_ok, stats_ok


def _ensure_defaults() -> None:
    with state.lock:
        if not state.STATS.get("first_seen"):
            state.STATS["first_seen"] = int(time.time())
        state.STATS.setdefault("users", {})
        state.STATS.setdefault("reality", {"priv": "", "pub": "", "sid": ""})
        state.STATS.setdefault("history", [])
        state.STATS.setdefault("admin", {})
        for uid in state.USERS:
            state.STATS["users"].setdefault(uid, {"up": 0, "down": 0})
    # Convert history list to bounded deque
    state.init_history(config.HISTORY_LEN)


async def boot_load() -> str:
    """Load state from best available source. Returns source label."""
    _cleanup_tmp_files()
    src = "fresh"
    users_loaded = False
    stats_loaded = False

    if config.gh_enabled():
        # ghsync.restore returns dict {"users": bool, "stats": bool}
        result = await ghsync.restore()
        if result["users"] or result["stats"]:
            src = "github"
            users_loaded = result["users"]
            stats_loaded = result["stats"]

    # Fill gaps from local if GitHub was incomplete
    if not users_loaded or not stats_loaded:
        u_ok, s_ok = _load_local()
        if u_ok or s_ok:
            if src == "fresh":
                src = "local"
            elif src == "github":
                src = "github+local"

    _ensure_defaults()
    save_local()
    return src


async def persist_tick() -> None:
    """Background: push to GitHub when state changed since last flush."""
    if state.take_dirty():
        save_local()
        if config.gh_enabled():
            await ghsync.backup("auto")


async def flush(reason: str = "shutdown") -> None:
    """Final flush on shutdown."""
    save_local()
    if config.gh_enabled():
        await ghsync.backup(reason)
