// scripts/seed-runtime.cjs
// Runtime seed script — runs inside the production container at startup.
// Uses ONLY node + the prisma client + bcryptjs from node_modules.
// No bun required.
//
// اسکریپت seed زمان اجرا — در ابتدای راه‌اندازی کانتینر اجرا می‌شود
// فقط از node و prisma client و bcryptjs استفاده می‌کند (بدون نیاز به bun)

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");

const db = new PrismaClient({
  log: ["error"],
});

async function main() {
  console.log("🌱 Seeding database (runtime)...");

  // Apply schema: create all tables if missing (idempotent)
  // We use Prisma's internal executeSqlRaw for that — but Prisma SQLite
  // doesn't expose DDL. Instead we use the prisma CLI binary directly:
  // (see docker-entrypoint.sh which runs `prisma db push` first)

  // 1) Default admin
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin12345";
  const existingAdmin = await db.admin.findUnique({ where: { username: "admin" } });
  if (!existingAdmin) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await db.admin.create({
      data: { username: "admin", passwordHash: hash, role: "SUPER_ADMIN" },
    });
    console.log(`✓ Created default admin (admin / ${adminPassword})`);
  } else {
    console.log("• Admin already exists, skipping");
  }

  // 2) Default inbounds (matching the 8 protocols)
  const PORT = Number(process.env.XRAY_PORT || 8443);
  const DOMAIN = process.env.XRAY_DOMAIN || "localhost";
  const inbounds = [
    { tag: "vless-ws", protocol: "vless", port: PORT, network: "ws", security: "tls", path: "/vless-ws", serviceName: null, sni: DOMAIN, note: "VLESS + WebSocket + TLS" },
    { tag: "vless-grpc", protocol: "vless", port: PORT, network: "grpc", security: "tls", path: null, serviceName: "vless-grpc", sni: DOMAIN, note: "VLESS + gRPC + TLS" },
    { tag: "vmess-ws", protocol: "vmess", port: PORT, network: "ws", security: "tls", path: "/vmess-ws", serviceName: null, sni: DOMAIN, note: "VMess + WebSocket + TLS" },
    { tag: "trojan-ws", protocol: "trojan", port: PORT, network: "ws", security: "tls", path: "/trojan-ws", serviceName: null, sni: DOMAIN, note: "Trojan + WebSocket + TLS" },
    { tag: "trojan-grpc", protocol: "trojan", port: PORT, network: "grpc", security: "tls", path: null, serviceName: "trojan-grpc", sni: DOMAIN, note: "Trojan + gRPC + TLS" },
    { tag: "vless-reality", protocol: "vless", port: PORT + 1, network: "tcp", security: "reality", path: null, serviceName: null, sni: "www.microsoft.com", note: "VLESS + XTLS-Reality (raw TCP required)" },
    { tag: "vless-xhttp", protocol: "vless", port: PORT, network: "xhttp", security: "tls", path: "/vless-xhttp", serviceName: null, sni: DOMAIN, note: "VLESS + xHTTP + TLS" },
    { tag: "vless-tcp-xtls", protocol: "vless", port: PORT + 2, network: "tcp", security: "tls", path: null, serviceName: null, sni: DOMAIN, note: "VLESS + TCP + XTLS-Vision" },
  ];
  for (const ib of inbounds) {
    const existing = await db.inbound.findUnique({ where: { tag: ib.tag } });
    if (!existing) {
      await db.inbound.create({ data: ib });
      console.log(`✓ Created inbound ${ib.tag}`);
    }
  }

  // 3) Default plans
  const plans = [
    { name: "آزمایشی", dataLimitGb: 5, durationDays: 7, maxDevices: 2, price: 0 },
    { name: "پایه", dataLimitGb: 30, durationDays: 30, maxDevices: 3, price: 50000 },
    { name: "حرفه‌ای", dataLimitGb: 80, durationDays: 30, maxDevices: 5, price: 120000 },
    { name: "نامحدود", dataLimitGb: 0, durationDays: 30, maxDevices: 5, price: 200000 },
  ];
  for (const p of plans) {
    const existing = await db.plan.findUnique({ where: { name: p.name } });
    if (!existing) {
      await db.plan.create({ data: p });
    }
  }

  // 4) Default settings
  const settings = [
    { key: "domain", value: DOMAIN },
    { key: "language", value: "fa" },
    { key: "ssl_auto", value: "true" },
    { key: "telegram_enabled", value: "false" },
    { key: "backup_auto_enabled", value: "false" },
    // Reality keys default to empty — admin will generate them from the UI
    { key: "xray_reality_public_key", value: "" },
    { key: "xray_reality_private_key", value: "" },
    { key: "xray_reality_short_id", value: "" },
  ];
  for (const s of settings) {
    const existing = await db.setting.findUnique({ where: { key: s.key } });
    if (!existing) {
      await db.setting.create({ data: s });
    }
  }

  // 5) Try to generate Reality keys automatically at first run
  //    (only if Xray binary is available and keys are empty)
  try {
    const existingKey = await db.setting.findUnique({
      where: { key: "xray_reality_public_key" },
    });
    if (!existingKey?.value) {
      const { execFile } = require("child_process");
      const { promisify } = require("util");
      const execFileAsync = promisify(execFile);
      const path = require("path");
      const xrayDir = process.env.XRAY_DIR || "/app/xray-core";
      const xrayBin = path.join(xrayDir, "xray");
      try {
        const { stdout } = await execFileAsync(xrayBin, ["x25519"], {
          cwd: xrayDir,
          timeout: 10000,
        });
        const privateMatch = stdout.match(/Private\s*key:\s*([A-Za-z0-9_\-+=/]+)/i);
        const publicMatch = stdout.match(/Public\s*key:\s*([A-Za-z0-9_\-+=/]+)/i);
        if (privateMatch && publicMatch) {
          const shortId = Math.random().toString(16).substring(2, 10);
          await db.setting.update({
            where: { key: "xray_reality_public_key" },
            data: { value: publicMatch[1] },
          });
          await db.setting.update({
            where: { key: "xray_reality_private_key" },
            data: { value: privateMatch[1] },
          });
          await db.setting.update({
            where: { key: "xray_reality_short_id" },
            data: { value: shortId },
          });
          console.log("✓ Auto-generated Reality keys");
        }
      } catch (e) {
        console.log("• Could not auto-generate Reality keys (binary not ready yet)");
      }
    }
  } catch {
    /* ignore — admin can generate from UI */
  }

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error("Seed error:", e.message);
    // Don't exit with error — let Next.js start anyway (admin can re-seed from UI)
    process.exit(0);
  })
  .finally(() => db.$disconnect());
