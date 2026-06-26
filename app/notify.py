"""Optional Telegram notifications (no-op unless TG_BOT_TOKEN + TG_ADMIN_ID set).

v3: uses shared ReusableClient from http_util.
"""
from __future__ import annotations

from . import config, state
from .http_util import tg_client


def enabled() -> bool:
    return config.tg_enabled()


async def send(text: str) -> None:
    if not enabled():
        return
    try:
        client = await tg_client.get()
        await client.post(
            f"https://api.telegram.org/bot{config.TG_TOKEN}/sendMessage",
            json={
                "chat_id": config.TG_ADMIN_ID,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
        )
    except Exception as e:  # noqa: BLE001
        state.log_error(f"tg.notify: {e}")
