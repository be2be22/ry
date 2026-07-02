#!/bin/bash
# docker-entrypoint.sh — start Xray + Next.js + nginx
# اسکریپت راه‌اندازی داکر — اجرای Xray، Next.js و nginx
#
# Architecture:
#   Railway (443 HTTPS) → nginx (PORT=3000) → Next.js (3001) OR Xray (8443)

set -e

echo "🚀 CyberX VPN Panel starting up..."
echo "============================================"

cd /app

# 1) Make sure runtime dirs exist
mkdir -p /app/db /app/backups /app/xray-core /app/data /var/log/nginx /var/run

# 2) Apply Prisma schema
echo "📦 Applying database schema..."
node node_modules/prisma/build/index.js db push --skip-generate --accept-data-loss 2>&1 | tail -5 || true

# 3) Seed initial data
echo "🌱 Seeding database..."
node scripts/seed-runtime.cjs

# 4) Generate Xray config from DB (with users injected)
echo "⚙ Generating Xray config from database..."
node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const fs = require('fs');

(async () => {
  const inbounds = await db.inbound.findMany({ where: { enabled: true } });

  // Load Reality keys
  const [privKeySetting, shortIdSetting] = await Promise.all([
    db.setting.findUnique({ where: { key: 'xray_reality_private_key' } }),
    db.setting.findUnique({ where: { key: 'xray_reality_short_id' } }),
  ]);
  const realityKeys = {
    privateKey: privKeySetting?.value || '',
    shortId: shortIdSetting?.value || '',
  };

  const realityValid = realityKeys.privateKey && realityKeys.privateKey.length >= 40 && realityKeys.shortId && /^[0-9a-f]{1,16}\$/i.test(realityKeys.shortId);

  // Filter inbounds — only WebSocket and (valid) Reality work behind nginx → Railway HTTPS
  // gRPC and xHTTP don't work (nginx can't proxy them properly)
  const validInbounds = inbounds.filter(ib => {
    if (ib.network === 'ws') return true; // WebSocket works perfectly
    if (ib.security === 'reality') return realityValid; // Reality needs valid keys + TCP Proxy
    return false; // Skip gRPC, xHTTP, TCP+TLS
  });

  const PORT = Number(process.env.XRAY_PORT || 8443);
  const config = {
    log: { loglevel: 'warning', access: '/app/xray-core/xray.log', error: '/app/xray-core/xray.log' },
    inbounds: validInbounds.map(ib => {
      const base = {
        tag: ib.tag,
        listen: '0.0.0.0',
        port: PORT,
        protocol: ib.protocol,
      };
      const ss = { network: ib.network };

      // Security
      if (ib.security === 'none' || (ib.security === 'tls' && ['ws','grpc','xhttp'].includes(ib.network))) {
        ss.security = 'none';
      } else if (ib.security === 'reality' && realityValid) {
        ss.security = 'reality';
        ss.realitySettings = {
          show: false,
          dest: 'www.microsoft.com:443',
          xver: 0,
          serverNames: [ib.sni || 'www.microsoft.com'],
          privateKey: realityKeys.privateKey,
          shortIds: [realityKeys.shortId],
        };
      }

      // Transport
      if (ib.network === 'ws') {
        ss.wsSettings = { path: ib.path || '/', headers: {} };
      } else if (ib.network === 'grpc') {
        ss.grpcSettings = { serviceName: ib.serviceName || ib.tag, multiMode: true };
      } else if (ib.network === 'xhttp') {
        ss.xhttpSettings = { path: ib.path || '/xhttp', mode: 'auto' };
      } else if (ib.network === 'tcp') {
        ss.tcpSettings = { header: { type: 'none' } };
      }

      base.streamSettings = ss;

      // Protocol settings
      if (ib.protocol === 'vless') {
        base.settings = { decryption: 'none', clients: [] };
      } else if (ib.protocol === 'vmess') {
        base.settings = { clients: [] };
      } else if (ib.protocol === 'trojan') {
        base.settings = { clients: [] };
      }
      base.sniffing = { enabled: true, destOverride: ['http', 'tls', 'quic'] };
      return base;
    }),
    outbounds: [
      { tag: 'direct', protocol: 'freedom' },
      { tag: 'block', protocol: 'blackhole' },
    ],
    routing: { rules: [{ type: 'field', ip: ['geoip:private'], outboundTag: 'block' }] },
  };

  fs.writeFileSync('/app/xray-core/config.json', JSON.stringify(config, null, 2));
  console.log('✓ Xray config written with', config.inbounds.length, 'inbounds');
  await db.\$disconnect();
})();
" 2>&1 || echo "⚠ Config generation failed, using minimal config"

# 5) Start Xray in background
echo "⚡ Starting Xray-core on port ${XRAY_PORT}..."
cd /app/xray-core
nohup ./xray run -c config.json > xray.log 2>&1 &
XRAY_PID=$!
cd /app

# 5.5) Wait for Xray to be ready
echo "⏳ Waiting for Xray to be ready..."
XRAY_READY=false
for i in $(seq 1 15); do
  if ! kill -0 $XRAY_PID 2>/dev/null; then
    echo "❌ Xray process died! Log:"
    tail -20 /app/xray-core/xray.log 2>/dev/null
    break
  fi
  if curl -s -o /dev/null http://127.0.0.1:${XRAY_PORT}/ 2>/dev/null; then
    echo "✓ Xray is listening on port ${XRAY_PORT}"
    XRAY_READY=true
    break
  fi
  sleep 1
done

if [ "$XRAY_READY" = false ]; then
  echo "⚠ Xray may not be ready, continuing anyway..."
  tail -10 /app/xray-core/xray.log 2>/dev/null || true
fi

# 6) Start Next.js in background on port NEXT_PORT (3001)
echo "🌐 Starting Next.js on port ${NEXT_PORT}..."
NEXT_PORT=${NEXT_PORT:-3001} HOSTNAME=127.0.0.1 PORT=${NEXT_PORT} nohup node server.js > nextjs.log 2>&1 &
NEXT_PID=$!

# 7) Wait for Next.js
echo "⏳ Waiting for Next.js to be ready..."
for i in $(seq 1 30); do
  if curl -s -o /dev/null http://127.0.0.1:${NEXT_PORT}/ 2>/dev/null; then
    echo "✓ Next.js is ready"
    break
  fi
  sleep 1
done

# 8) Start nginx in foreground
echo "🔧 Starting nginx reverse proxy on port ${PORT}..."
echo "   Routing: /vless-ws, /vmess-ws, /trojan-ws, /vless-xhttp, gRPC → Xray:${XRAY_PORT}"
echo "   Routing: everything else → Next.js:${NEXT_PORT}"

cleanup() {
  echo "🛑 Shutting down..."
  kill $XRAY_PID 2>/dev/null || true
  kill $NEXT_PID 2>/dev/null || true
  nginx -s quit 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

# Test nginx config first — show full error if it fails
echo "🧪 Testing nginx config..."
nginx -t 2>&1
if [ $? -ne 0 ]; then
  echo "❌ nginx config test failed!"
  echo "=== nginx.conf content ==="
  cat /etc/nginx/nginx.conf
  exit 1
fi

# Run nginx in foreground (this is the main process)
exec nginx -g 'daemon off;'
