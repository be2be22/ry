#!/usr/bin/env python3
"""
app.py - Custom Xray Management Panel (Flask)

Routes:
  GET  /              → Login or redirect to dashboard
  POST /login         → Authenticate
  GET  /logout        → Logout
  GET  /dashboard     → List users
  POST /users/add     → Add new user
  POST /users/<id>/toggle → Enable/disable user
  POST /users/<id>/delete → Delete user
  GET  /users/<id>/link   → Show VLESS link
  GET  /logs          → View Xray logs (live)
  GET  /api/logs      → SSE stream of Xray logs
  POST /api/xray/reload → Reload Xray config
  GET  /api/stats     → JSON stats
"""
import os
import sqlite3
import uuid
import subprocess
import threading
import time
import json
from hashlib import sha256
from flask import Flask, request, redirect, url_for, render_template, session, jsonify, Response, stream_with_context
from functools import wraps

DB_PATH = "/data/users.db"
XRAY_CONFIG_PATH = "/etc/xray/config.json"
XRAY_LOG_PATH = "/var/log/xray"
XRAY_BIN = "/usr/local/bin/xray-bin"

app = Flask(__name__)
app.secret_key = os.environ.get("PANEL_SECRET", "change-this-secret-in-production")
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


# =============================================================================
# Database helpers
# =============================================================================
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def get_setting(key, default=None):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cur.fetchone()
    conn.close()
    return row["value"] if row else default


def set_setting(key, value):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, str(value)))
    conn.commit()
    conn.close()


# =============================================================================
# Auth
# =============================================================================
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if "user" not in session:
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated


def check_login(username, password):
    pass_hash = sha256(password.encode()).hexdigest()
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM admins WHERE username = ? AND password_hash = ?", (username, pass_hash))
    row = cur.fetchone()
    conn.close()
    return row is not None


# =============================================================================
# Xray management
# =============================================================================
def regenerate_xray_config():
    """Regenerate Xray config from DB and reload."""
    try:
        result = subprocess.run(
            ["python3", "/app/generate_config.py"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return False, result.stderr or result.stdout
        # Reload Xray by sending SIGHUP (if supported) or restart process
        # Easier: send SIGUSR1 to refresh stats; for full reload, restart
        reload_xray()
        return True, result.stdout
    except Exception as e:
        return False, str(e)


def reload_xray():
    """Send SIGHUP to Xray to reload config (or restart if needed)."""
    try:
        result = subprocess.run(["pkill", "-HUP", "xray-bin"], capture_output=True, text=True)
        # If pkill didn't find the process, log it
        if result.returncode != 0:
            print(f"[WARN] pkill xray-bin returned {result.returncode}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to reload Xray: {e}")
        return False


def get_xray_status():
    """Check if Xray process is running."""
    try:
        result = subprocess.run(["pgrep", "-f", "xray-bin"], capture_output=True, text=True)
        return result.returncode == 0
    except Exception:
        return False


def get_xray_pid():
    try:
        result = subprocess.run(["pgrep", "-f", "xray-bin"], capture_output=True, text=True)
        if result.stdout.strip():
            return result.stdout.strip().split("\n")[0]
    except Exception:
        pass
    return None


# =============================================================================
# Routes
# =============================================================================
@app.route("/")
def index():
    if "user" in session:
        return redirect(url_for("dashboard"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        if check_login(username, password):
            session["user"] = username
            return redirect(url_for("dashboard"))
        return render_template("login.html", error="نام کاربری یا رمز عبور اشتباه است")
    return render_template("login.html", error=None)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


@app.route("/dashboard")
@login_required
def dashboard():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users ORDER BY created_at DESC")
    users = cur.fetchall()
    cur.execute("SELECT COUNT(*) as c FROM users WHERE enabled = 1")
    active_count = cur.fetchone()["c"]
    conn.close()

    xray_running = get_xray_status()
    public_domain = os.environ.get("PUBLIC_DOMAIN", "") or "your-domain.com"

    return render_template(
        "dashboard.html",
        users=users,
        active_count=active_count,
        total_count=len(users),
        xray_running=xray_running,
        public_domain=public_domain,
        ws_path=get_setting("ws_path", "/vless"),
        xray_port=get_setting("xray_port", "80")
    )


@app.route("/users/add", methods=["POST"])
@login_required
def add_user():
    email = request.form.get("email", "").strip()
    name = request.form.get("name", "").strip()
    if not email:
        email = f"user-{uuid.uuid4().hex[:8]}@example.com"

    user_uuid = str(uuid.uuid4())
    conn = get_db()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO users (uuid, email, name) VALUES (?, ?, ?)",
        (user_uuid, email, name or email.split("@")[0])
    )
    conn.commit()
    conn.close()

    ok, msg = regenerate_xray_config()
    if not ok:
        return f"User added but Xray reload failed: {msg}", 500

    return redirect(url_for("dashboard"))


@app.route("/users/<int:user_id>/toggle", methods=["POST"])
@login_required
def toggle_user(user_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("UPDATE users SET enabled = 1 - enabled WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    regenerate_xray_config()
    return redirect(url_for("dashboard"))


@app.route("/users/<int:user_id>/delete", methods=["POST"])
@login_required
def delete_user(user_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    conn.close()
    regenerate_xray_config()
    return redirect(url_for("dashboard"))


@app.route("/users/<int:user_id>/link")
@login_required
def user_link(user_id):
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT * FROM users WHERE id = ?", (user_id,))
    user = cur.fetchone()
    conn.close()
    if not user:
        return "User not found", 404

    public_domain = os.environ.get("PUBLIC_DOMAIN", "") or request.host.split(":")[0]
    ws_path = get_setting("ws_path", "/vless")

    # VLESS link (clients connect to port 443 HTTPS, Bunnyshell terminates TLS)
    link = (
        f"vless://{user['uuid']}@{public_domain}:443"
        f"?encryption=none&security=tls&sni={public_domain}"
        f"&type=ws&host={public_domain}"
        f"&path=%2Fvless"
        f"#{user['email'] or user['name']}"
    )

    return render_template("link.html", user=user, link=link, public_domain=public_domain)


@app.route("/logs")
@login_required
def view_logs():
    log_type = request.args.get("type", "access")
    lines = request.args.get("lines", "100", type=str)
    try:
        lines = int(lines)
    except ValueError:
        lines = 100

    log_file = os.path.join(XRAY_LOG_PATH, f"{log_type}.log")
    content = ""
    if os.path.exists(log_file):
        try:
            with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                all_lines = f.readlines()
                content = "".join(all_lines[-lines:])
        except Exception as e:
            content = f"Error reading log: {e}"
    else:
        content = "(log file does not exist yet)"

    return render_template("logs.html", content=content, log_type=log_type, lines=lines)


@app.route("/api/logs/stream")
@login_required
def stream_logs():
    """Server-Sent Events stream for live log tailing."""
    log_type = request.args.get("type", "access")
    log_file = os.path.join(XRAY_LOG_PATH, f"{log_type}.log")

    def generate():
        # Send last 50 lines first
        if os.path.exists(log_file):
            with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                lines = f.readlines()[-50:]
                for line in lines:
                    yield f"data: {line.rstrip()}\n\n"

        # Then tail new lines
        last_pos = 0
        if os.path.exists(log_file):
            last_pos = os.path.getsize(log_file)

        while True:
            try:
                if os.path.exists(log_file):
                    cur_size = os.path.getsize(log_file)
                    if cur_size < last_pos:
                        # Log was rotated
                        last_pos = 0
                    if cur_size > last_pos:
                        with open(log_file, "r", encoding="utf-8", errors="replace") as f:
                            f.seek(last_pos)
                            new_data = f.read()
                            last_pos = f.tell()
                            for line in new_data.split("\n"):
                                if line:
                                    yield f"data: {line}\n\n"
                time.sleep(1)
            except GeneratorError:
                break
            except Exception as e:
                yield f"data: [error] {e}\n\n"
                time.sleep(2)

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive"
        }
    )


@app.route("/api/xray/reload", methods=["POST"])
@login_required
def api_reload_xray():
    ok, msg = regenerate_xray_config()
    return jsonify({"success": ok, "message": msg})


@app.route("/api/xray/status")
@login_required
def api_xray_status():
    return jsonify({
        "running": get_xray_status(),
        "pid": get_xray_pid()
    })


@app.route("/api/stats")
@login_required
def api_stats():
    conn = get_db()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as c FROM users")
    total = cur.fetchone()["c"]
    cur.execute("SELECT COUNT(*) as c FROM users WHERE enabled = 1")
    active = cur.fetchone()["c"]
    conn.close()
    return jsonify({
        "total_users": total,
        "active_users": active,
        "xray_running": get_xray_status()
    })


# =============================================================================
# Error handlers
# =============================================================================
@app.errorhandler(404)
def not_found(e):
    return render_template("error.html", code=404, message="صفحه یافت نشد"), 404


@app.errorhandler(500)
def server_error(e):
    return render_template("error.html", code=500, message="خطای داخلی سرور"), 500


if __name__ == "__main__":
    panel_port = int(os.environ.get("PANEL_PORT", "5000"))
    print(f"[INFO] Starting panel on 127.0.0.1:{panel_port}")
    # Listen on 127.0.0.1 only (Xray fallback forwards to it)
    app.run(host="127.0.0.1", port=panel_port, debug=False, threaded=True)
