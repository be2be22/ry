#!/bin/bash
# =============================================================================
# entrypoint.sh - Custom Xray Panel startup (v2 - more robust)
# Starts: Flask panel (port 5000, internal) + Xray-core (port 80, public)
# =============================================================================
set -e

echo "================================================"
echo "  Custom Xray Panel - Bunnyshell Deployment"
echo "  Xray Port   : ${XRAY_PORT:-80}"
echo "  Panel Port  : ${PANEL_PORT:-5000} (internal)"
echo "  WS Path     : ${XRAY_WS_PATH:-/vless}"
echo "  Timezone    : ${TZ:-Asia/Tehran}"
echo "  Public Domain: ${PUBLIC_DOMAIN:-not-set}"
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
python3 /app/init_db.py
if [ $? -ne 0 ]; then
    echo "[FATAL] Database initialization failed"
    exit 1
fi

# ---------- Step 3: Generate Xray config from template ----------------------
echo "[STEP 3] Generating Xray config..."
python3 /app/generate_config.py
if [ $? -ne 0 ]; then
    echo "[FATAL] Xray config generation failed"
    exit 1
fi

# ---------- Step 4: Verify Xray binary works --------------------------------
echo "[STEP 4] Verifying Xray binary..."
/usr/local/bin/xray-bin version
if [ $? -ne 0 ]; then
    echo "[FATAL] Xray binary not working"
    exit 1
fi

# ---------- Step 5: Verify Xray config is valid -----------------------------
echo "[STEP 5] Validating Xray config..."
/usr/local/bin/xray-bin run -test -config /etc/xray/config.json
if [ $? -ne 0 ]; then
    echo "[FATAL] Xray config is invalid"
    cat /etc/xray/config.json
    exit 1
fi

# ---------- Step 6: Start Flask panel in background -------------------------
echo "[STEP 6] Starting Flask panel on 127.0.0.1:${PANEL_PORT:-5000}..."
cd /app
python3 app.py > /var/log/xray/panel.log 2>&1 &
PANEL_PID=$!
echo "[INFO] Flask panel started with PID ${PANEL_PID}"

# ---------- Step 7: Wait for Flask to be ready ------------------------------
echo "[STEP 7] Waiting for Flask to be ready..."
MAX_WAIT=30
WAITED=0
while [ $WAITED -lt $MAX_WAIT ]; do
    if ! kill -0 ${PANEL_PID} 2>/dev/null; then
        echo "[FATAL] Flask panel process died. Last log lines:"
        tail -30 /var/log/xray/panel.log 2>/dev/null || echo "(no log file)"
        exit 1
    fi
    # Test if Flask responds
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:${PANEL_PORT:-5000}/ 2>/dev/null | grep -qE "^(200|302|401|403)$"; then
        echo "[OK] Flask panel is responding (after ${WAITED}s)"
        break
    fi
    sleep 1
    WAITED=$((WAITED + 1))
done

if [ $WAITED -ge $MAX_WAIT ]; then
    echo "[WARN] Flask panel did not respond within ${MAX_WAIT}s, but continuing anyway"
    echo "[INFO] Last panel log:"
    tail -20 /var/log/xray/panel.log 2>/dev/null
fi

# ---------- Step 8: Trap signals for graceful shutdown ----------------------
trap 'echo "[INFO] Shutting down..."; kill ${PANEL_PID} 2>/dev/null; pkill -TERM xray-bin 2>/dev/null; exit 0' TERM INT

# ---------- Step 9: Start Xray in background --------------------------------
echo "[STEP 9] Starting Xray-core on port ${XRAY_PORT:-80}..."
/usr/local/bin/xray-bin run -config /etc/xray/config.json &
XRAY_PID=$!
echo "[INFO] Xray started with PID ${XRAY_PID}"

# Wait a moment for Xray to bind
sleep 2
if ! kill -0 ${XRAY_PID} 2>/dev/null; then
    echo "[FATAL] Xray failed to start"
    echo "[INFO] Xray error log:"
    cat /var/log/xray/error.log 2>/dev/null | tail -30
    exit 1
fi

echo "================================================"
echo "  ✅ All services started successfully!"
echo "  - Flask panel: http://127.0.0.1:${PANEL_PORT:-5000}"
echo "  - Xray public: http://0.0.0.0:${XRAY_PORT:-80}"
echo "  - Panel URL:   https://${PUBLIC_DOMAIN:-your-domain}/"
echo "  - VLESS URL:   wss://${PUBLIC_DOMAIN:-your-domain}/vless"
echo "================================================"

# ---------- Step 10: Wait for either process to exit -----------------------
wait -n ${PANEL_PID} ${XRAY_PID} 2>/dev/null || wait ${PANEL_PID} ${XRAY_PID}

echo "[WARN] A process exited. Shutting down..."
kill ${PANEL_PID} ${XRAY_PID} 2>/dev/null || true
exit 0
