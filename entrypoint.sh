#!/bin/bash
# =============================================================================
# entrypoint.sh - Custom Xray Panel startup (v3 - no set -e, fully robust)
# Starts: Flask panel (port 5000, internal) + Xray-core (port 80, public)
# =============================================================================
# NO set -e — we handle errors explicitly so a failed curl doesn't kill the
# container during the Flask readiness check.

echo "================================================"
echo "  Custom Xray Panel - Bunnyshell Deployment v3"
echo "  Xray Port   : ${XRAY_PORT:-80}"
echo "  Panel Port  : ${PANEL_PORT:-5000} (internal)"
echo "  WS Path     : ${XRAY_WS_PATH:-/vless}"
echo "  Timezone    : ${TZ:-Asia/Tehran}"
echo "  Public Domain: ${PUBLIC_DOMAIN:-not-set}"
echo "  Admin User  : ${ADMIN_USER:-admin}"
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
echo "[STEP 2] Initializing database..."
python3 /app/init_db.py 2>&1
DB_RESULT=$?
if [ $DB_RESULT -ne 0 ]; then
    echo "[FATAL] Database initialization failed (exit code $DB_RESULT)"
    exit 1
fi
echo "[OK] Database initialized"

# ---------- Step 3: Generate Xray config from template ----------------------
echo "[STEP 3] Generating Xray config..."
python3 /app/generate_config.py 2>&1
GEN_RESULT=$?
if [ $GEN_RESULT -ne 0 ]; then
    echo "[FATAL] Xray config generation failed (exit code $GEN_RESULT)"
    exit 1
fi
echo "[OK] Xray config generated"

# ---------- Step 4: Verify Xray binary works --------------------------------
echo "[STEP 4] Verifying Xray binary..."
/usr/local/bin/xray-bin version 2>&1
if [ $? -ne 0 ]; then
    echo "[FATAL] Xray binary not working"
    exit 1
fi
echo "[OK] Xray binary works"

# ---------- Step 5: Verify Xray config is valid -----------------------------
echo "[STEP 5] Validating Xray config..."
/usr/local/bin/xray-bin run -test -config /etc/xray/config.json 2>&1
if [ $? -ne 0 ]; then
    echo "[FATAL] Xray config is invalid. Config contents:"
    cat /etc/xray/config.json 2>/dev/null
    exit 1
fi
echo "[OK] Xray config is valid"

# ---------- Step 6: Start Flask panel in background -------------------------
echo "[STEP 6] Starting Flask panel on 127.0.0.1:${PANEL_PORT:-5000}..."
cd /app
python3 app.py > /var/log/xray/panel.log 2>&1 &
PANEL_PID=$!
echo "[INFO] Flask panel started with PID ${PANEL_PID}"

# ---------- Step 7: Wait for Flask to be ready ------------------------------
echo "[STEP 7] Waiting for Flask to be ready (max 30s)..."
MAX_WAIT=30
WAITED=0
FLASK_READY=false
while [ $WAITED -lt $MAX_WAIT ]; do
    # Check if Flask process is still alive
    if ! kill -0 ${PANEL_PID} 2>/dev/null; then
        echo "[FATAL] Flask panel process died after ${WAITED}s!"
        echo "-------- Flask log (last 50 lines) --------"
        tail -50 /var/log/xray/panel.log 2>/dev/null || echo "(no log file)"
        echo "-------------------------------------------"
        exit 1
    fi
    # Test if Flask responds on /health
    # Use || true so curl failure (exit 7 = connection refused) doesn't kill script
    HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 2 "http://127.0.0.1:${PANEL_PORT:-5000}/health" 2>/dev/null || echo "000")
    if [ "$HEALTH_CODE" = "200" ]; then
        echo "[OK] Flask panel is responding on /health (after ${WAITED}s)"
        FLASK_READY=true
        break
    fi
    echo "  ... waiting (${WAITED}s, HTTP=${HEALTH_CODE})"
    sleep 1
    WAITED=$((WAITED + 1))
done

if [ "$FLASK_READY" = "false" ]; then
    echo "[WARN] Flask panel did not respond within ${MAX_WAIT}s"
    echo "-------- Flask log (last 50 lines) --------"
    tail -50 /var/log/xray/panel.log 2>/dev/null || echo "(no log file)"
    echo "-------------------------------------------"
    echo "[INFO] Continuing anyway — Xray will start, but panel won't be accessible"
fi

# ---------- Step 8: Trap signals for graceful shutdown ----------------------
trap 'echo "[INFO] SIGTERM received, shutting down..."; kill ${PANEL_PID} 2>/dev/null; pkill -TERM xray-bin 2>/dev/null; exit 0' TERM INT

# ---------- Step 9: Start Xray in background --------------------------------
echo "[STEP 9] Starting Xray-core on port ${XRAY_PORT:-80}..."
/usr/local/bin/xray-bin run -config /etc/xray/config.json &
XRAY_PID=$!
echo "[INFO] Xray started with PID ${XRAY_PID}"

# Wait for Xray to bind
sleep 3
if ! kill -0 ${XRAY_PID} 2>/dev/null; then
    echo "[FATAL] Xray process died!"
    echo "-------- Xray error log (last 30 lines) --------"
    tail -30 /var/log/xray/error.log 2>/dev/null || echo "(no log file)"
    echo "------------------------------------------------"
    exit 1
fi
echo "[OK] Xray is running"

echo "================================================"
echo "  ✅ All services started successfully!"
echo "  - Flask panel: http://127.0.0.1:${PANEL_PORT:-5000} (ready=${FLASK_READY})"
echo "  - Xray public: http://0.0.0.0:${XRAY_PORT:-80}"
echo "  - Panel URL:   https://${PUBLIC_DOMAIN:-your-domain}/"
echo "  - VLESS URL:   wss://${PUBLIC_DOMAIN:-your-domain}/vless"
echo "================================================"
echo "[INFO] Container is running. Tailing logs..."

# ---------- Step 10: Wait and tail logs -------------------------------------
# Keep container alive — wait for either process to exit
while true; do
    if ! kill -0 ${PANEL_PID} 2>/dev/null && ! kill -0 ${XRAY_PID} 2>/dev/null; then
        echo "[ERROR] Both processes died!"
        break
    fi
    if ! kill -0 ${PANEL_PID} 2>/dev/null; then
        echo "[WARN] Flask panel exited. Continuing with Xray only."
        PANEL_PID=""
    fi
    if ! kill -0 ${XRAY_PID} 2>/dev/null; then
        echo "[ERROR] Xray exited!"
        echo "-------- Xray error log --------"
        tail -30 /var/log/xray/error.log 2>/dev/null
        echo "--------------------------------"
        break
    fi
    sleep 5
done

echo "[INFO] Shutting down..."
kill ${PANEL_PID} 2>/dev/null || true
kill ${XRAY_PID} 2>/dev/null || true
exit 0
