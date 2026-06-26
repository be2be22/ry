"""Process entry point — runs the async control plane behind the edge router."""
import uvicorn

from app import config
from app.server import build_app

app = build_app()

if __name__ == "__main__":
    # loop/http = "auto": use uvloop + httptools when available (they ship with
    # uvicorn[standard]), but fall back to the stdlib asyncio loop instead of
    # refusing to start if they are ever missing on the platform.
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=config.CP_PORT,
        log_level="warning",
        access_log=False,
        loop="auto",
        http="auto",
    )
