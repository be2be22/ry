#!/bin/bash
# docker-entrypoint.sh — initialize DB, seed, start Xray, then start Next.js
# اسکریپت راه‌اندازی داکر — دیتابیس، Xray و Next.js را اجرا می‌کند

set -e

echo "🚀 CyberX VPN Panel starting up..."
echo "============================================"

# 1) Push Prisma schema to DB (idempotent — creates tables if missing)
echo "📦 Initializing database..."
cd /app
npx prisma db push --skip-generate --accept-data-loss || true

# 2) Seed default admin, inbounds, plans
echo "🌱 Seeding database..."
node -e "
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');
const db = new PrismaClient();
(async () => {
  const admin = await db.admin.findUnique({ where: { username: 'admin' } });
  if (!admin) {
    const hash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin12345', 10);
    await db.admin.create({ data: { username: 'admin', passwordHash: hash, role: 'SUPER_ADMIN' } });
    console.log('✓ Created default admin');
  }
  const PORT = Number(process.env.XRAY_PORT || 8443);
  const DOMAIN = process.env.XRAY_DOMAIN || 'localhost';
  const inbounds = [
    { tag: 'vless-ws', protocol: 'vless', port: PORT, network: 'ws', security: 'tls', path: '/vless-ws', serviceName: null, sni: DOMAIN, note: 'VLESS+WS+TLS' },
    { tag: 'vless-grpc', protocol: 'vless', port: PORT, network: 'grpc', security: 'tls', path: null, serviceName: 'vless-grpc', sni: DOMAIN, note: 'VLESS+gRPC+TLS' },
    { tag: 'vmess-ws', protocol: 'vmess', port: PORT, network: 'ws', security: 'tls', path: '/vmess-ws', serviceName: null, sni: DOMAIN, note: 'VMess+WS+TLS' },
    { tag: 'trojan-ws', protocol: 'trojan', port: PORT, network: 'ws', security: 'tls', path: '/trojan-ws', serviceName: null, sni: DOMAIN, note: 'Trojan+WS+TLS' },
    { tag: 'trojan-grpc', protocol: 'trojan', port: PORT, network: 'grpc', security: 'tls', path: null, serviceName: 'trojan-grpc', sni: DOMAIN, note: 'Trojan+gRPC+TLS' },
    { tag: 'vless-reality', protocol: 'vless', port: PORT+1, network: 'tcp', security: 'reality', path: null, serviceName: null, sni: 'www.microsoft.com', note: 'VLESS+Reality' },
    { tag: 'vless-xhttp', protocol: 'vless', port: PORT, network: 'xhttp', security: 'tls', path: '/vless-xhttp', serviceName: null, sni: DOMAIN, note: 'VLESS+xHTTP+TLS' },
    { tag: 'vless-tcp-xtls', protocol: 'vless', port: PORT+2, network: 'tcp', security: 'tls', path: null, serviceName: null, sni: DOMAIN, note: 'VLESS+TCP+XTLS-Vision' },
  ];
  for (const ib of inbounds) {
    const ex = await db.inbound.findUnique({ where: { tag: ib.tag } });
    if (!ex) await db.inbound.create({ data: ib });
  }
  const plans = [
    { name: 'آزمایشی', dataLimitGb: 5, durationDays: 7, maxDevices: 2, price: 0 },
    { name: 'پایه', dataLimitGb: 30, durationDays: 30, maxDevices: 3, price: 50000 },
    { name: 'حرفه‌ای', dataLimitGb: 80, durationDays: 30, maxDevices: 5, price: 120000 },
    { name: 'نامحدود', dataLimitGb: 0, durationDays: 30, maxDevices: 5, price: 200000 },
  ];
  for (const p of plans) {
    const ex = await db.plan.findUnique({ where: { name: p.name } });
    if (!ex) await db.plan.create({ data: p });
  }
  const settings = [
    { key: 'domain', value: DOMAIN },
    { key: 'language', value: 'fa' },
    { key: 'ssl_auto', value: 'true' },
  ];
  for (const s of settings) {
    const ex = await db.setting.findUnique({ where: { key: s.key } });
    if (!ex) await db.setting.create({ data: s });
  }
  console.log('✓ Seed complete');
  await db.\$disconnect();
})();
" || echo "(seed failed — likely already seeded)"

# 3) Start Xray-core in background
echo "⚡ Starting Xray-core..."
if [ -f /app/xray-core/xray ]; then
  nohup /app/xray-core/xray run -c /app/xray-core/config.json > /app/xray-core/xray.log 2>&1 &
  echo "✓ Xray started in background"
else
  echo "⚠ Xray binary not found — running in simulated mode"
fi

# 4) Start Next.js
echo "🌐 Starting Next.js on port ${PORT}..."
exec node server.js
