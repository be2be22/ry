"""GitHub state sync — durable storage for an ephemeral Railway host.

v3 changes:
  - Uses shared ReusableClient from http_util (no duplicated _get_client).
  - Compact JSON (separators) to minimize payload & GitHub diff noise.
  - Hash-based skip: if state hasn't changed since last backup, skip the PUT.
  - restore() returns per-file success dict (users vs stats independently).
  - Cleaner error handling with explicit status-code branches.
"""
from __future__ import annotations

import base64
import hashlib
import json
import time

from . import config, state
from .http_util import gh_client

_API = "https://api.github.com"
_sha_cache: dict[str, str] = {}
_hash_cache: dict[str, str] = {}
_status: dict = {"last_ok": 0, "last_err": "", "pushes": 0, "pulls": 0}


def _headers() -> dict:
    return {
        "Authorization": f"Bearer {config.GH_TOKEN}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "aurora-edge-v3",
    }


def _url(path: str) -> str:
    return f"{_API}/repos/{config.GH_REPO}/contents/{config.GH_DATA_DIR}/{path}"


def status() -> dict:
    return dict(_status)


async def _read(client, path: str) -> str | None:
    r = await client.get(
        _url(path), headers=_headers(), params={"ref": config.GH_BRANCH}
    )
    if r.status_code == 200:
        body = r.json()
        _sha_cache[path] = body.get("sha", "")
        raw = base64.b64decode(body.get("content", ""))
        return raw.decode("utf-8", "ignore")
    if r.status_code == 404:
        return None
    raise RuntimeError(f"read {path}: HTTP {r.status_code}")


async def _write(client, path: str, text: str, msg: str) -> None:
    payload = {
        "message": msg,
        "content": base64.b64encode(text.encode()).decode(),
        "branch": config.GH_BRANCH,
    }
    sha = _sha_cache.get(path)
    if sha:
        payload["sha"] = sha
    r = await client.put(_url(path), headers=_headers(), json=payload)
    if r.status_code in (200, 201):
        _sha_cache[path] = r.json().get("content", {}).get("sha", "")
        return
    if r.status_code in (409, 422):
        # sha drifted — refetch and retry once
        await _read(client, path)
        payload["sha"] = _sha_cache.get(path, "")
        r2 = await client.put(_url(path), headers=_headers(), json=payload)
        if r2.status_code in (200, 201):
            _sha_cache[path] = r2.json().get("content", {}).get("sha", "")
            return
        raise RuntimeError(f"write {path}: HTTP {r2.status_code}")
    raise RuntimeError(f"write {path}: HTTP {r.status_code}")


def _state_hash(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


# ── public surface ───────────────────────────────────────────────────
async def restore() -> dict:
    """Pull users + stats from GitHub. Returns {"users": bool, "stats": bool}."""
    result = {"users": False, "stats": False}
    if not config.gh_enabled():
        return result
    try:
        client = await gh_client.get()
        u = await _read(client, "users.json")
        if u:
            with state.lock:
                state.USERS.clear()
                state.USERS.update(json.loads(u))
            _hash_cache["users.json"] = _state_hash(u)
            result["users"] = True
        s = await _read(client, "stats.json")
        if s:
            with state.lock:
                state.STATS.update(json.loads(s))
            _hash_cache["stats.json"] = _state_hash(s)
            result["stats"] = True
        _status["pulls"] += 1
        _status["last_ok"] = int(time.time())
    except Exception as e:  # noqa: BLE001
        _status["last_err"] = str(e)
        state.log_error(f"gh.restore: {e}")
    return result


async def backup(reason: str = "auto") -> bool:
    """Push current users + stats to GitHub. Skips if unchanged since last push."""
    if not config.gh_enabled():
        return False
    try:
        with state.lock:
            users_txt = json.dumps(
                state.USERS, ensure_ascii=False, separators=(",", ":")
            )
            stats_copy = dict(state.STATS)
            if hasattr(stats_copy.get("history"), "__iter__") and not isinstance(
                stats_copy.get("history"), list
            ):
                stats_copy["history"] = list(stats_copy["history"])
            stats_txt = json.dumps(
                stats_copy, ensure_ascii=False, separators=(",", ":")
            )

        # Hash-based skip: don't push if content unchanged since last backup
        users_hash = _state_hash(users_txt)
        stats_hash = _state_hash(stats_txt)
        if (
            _hash_cache.get("users.json") == users_hash
            and _hash_cache.get("stats.json") == stats_hash
        ):
            return True  # nothing to push

        stamp = time.strftime("%Y-%m-%d %H:%M:%S")
        client = await gh_client.get()
        if _hash_cache.get("users.json") != users_hash:
            await _write(
                client, "users.json", users_txt,
                f"state: users ({reason}) {stamp}",
            )
            _hash_cache["users.json"] = users_hash
        if _hash_cache.get("stats.json") != stats_hash:
            await _write(
                client, "stats.json", stats_txt,
                f"state: stats ({reason}) {stamp}",
            )
            _hash_cache["stats.json"] = stats_hash
        _status["pushes"] += 1
        _status["last_ok"] = int(time.time())
        return True
    except Exception as e:  # noqa: BLE001
        _status["last_err"] = str(e)
        state.log_error(f"gh.backup: {e}")
        return False
