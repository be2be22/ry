#!/bin/bash
# =============================================================================
# entrypoint.sh - Custom Xray Panel startup
# Starts: Flask panel (port 5000, internal) + Xray-core (port 80, public)
# Xray handles all incoming traffic on port 80:
#   - WebSocket traffic on path /vless → VLESS proxy
#   - Everything else → fallback to Flask panel on 127.0.0.1:5000
# =============================================================================
set -e

echo "================================================"
echo "  Custom Xray Panel - Bunnyshell Deployment"
echo "  Xray Port   : ${XRAY_PORT:-80}"
echo "  Panel Port  : ${PANEL_PORT:-5000} (internal)"
echo "  WS Path     : ${XRAY_WS_PATH:-/vless}"
echo "  Timezone    : ${TZ:-Asia/Tehran}"
echo "================================================"

# ---------- Step 1: Generate admin password if not provided -----------------
if [ -z "${ADMIN_PASS}" ]; then
    ADMIN_PASS="$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 20)"
    echo ""
    echo "=========================================================="
    echo "  [SECURITY] No ADMIN_PASS provided."
    echo "  Generated random admin password: ${ADMIN_PASS}"
    echo "=========================================================="
    echo ""
fi
export ADMIN_PASS

# ---------- Step 2: Initialize SQLite database ------------------------------
python3 /app/init_db.py

# ---------- Step 3: Generate Xray config from template ----------------------
python3 /app/generate_config.py

# ---------- Step 4: Start Flask panel in background -------------------------
echo "[INFO] Starting Flask panel on port ${PANEL_PORT:-5000}..."
cd /app
python3 app.py &
PANEL_PID=$!
echo "[INFO] Flask panel started with PID ${PANEL_PID}"

# ---------- Step 5: Wait for Flask to be ready ------------------------------
sleep 2
if ! kill -0 ${PANEL_PID} 2>/dev/null; then
    echo "[FATAL] Flask panel failed to start"
    exit 1
fi
echo "[OK] Flask panel is running"

# ---------- Step 6: Start Xray in foreground --------------------------------
echo "[INFO] Starting Xray-core on port ${XRAY_PORT:-80}..."
echo "================================================"

# Trap SIGTERM/SIGINT for graceful shutdown
trap 'echo "[INFO] Shutting down..."; kill ${PANEL_PID} 2>/dev/null; kill -TERM $(pgrep xray-bin) 2>/dev/null; exit 0' TERM INT

# Start Xray (foreground, replaces shell via exec)
# Logs go to /var/log/xray/ for panel to read
exec /usr/local/bin/xray-bin run -config /etc/xray/config.json &

XRAY_PID=$!
echo "[INFO] Xray started with PID ${XRAY_PID}"

# Wait for either process to exit
wait -n ${PANEL_PID} ${XRAY_PID} 2>/dev/null || wait ${PANEL_PID} ${XRAY_PID}

echo "[INFO] A process exited, shutting down..."
kill ${PANEL_PID} ${XRAY_PID} 2>/dev/null || true
exit 0
