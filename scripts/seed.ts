// Seed script — initialize the DB with default admin, inbounds, and plans
// اسکریپت Seed — راه‌اندازی اولیه دیتابیس با ادمین پیش‌فرض، اینباندها و بسته‌ها

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

const db = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1) Default super-admin (username: admin, password from env or admin12345)
  const adminPassword = process.env.DEFAULT_ADMIN_PASSWORD || "admin12345";
  const existingAdmin = await db.admin.findUnique({ where: { username: "admin" } });
  if (!existingAdmin) {
    const hash = await bcrypt.hash(adminPassword, 10);
    await db.admin.create({
      data: {
        username: "admin",
        passwordHash: hash,
        role: "SUPER_ADMIN",
      },
    });
    console.log(`✓ Created default admin (admin / ${adminPassword})`);
  } else {
    console.log("• Admin already exists, skipping");
  }

  // 2) Default inbounds (matching the 8 protocols)
  const PORT = Number(process.env.XRAY_PORT || 8443);
  const inbounds = [
    { tag: "vless-ws", protocol: "vless", port: PORT, network: "ws", security: "tls", path: "/vless-ws", serviceName: null, sni: process.env.XRAY_DOMAIN || "localhost", note: "VLESS + WebSocket + TLS" },
    { tag: "vless-grpc", protocol: "vless", port: PORT, network: "grpc", security: "tls", path: null, serviceName: "vless-grpc", sni: process.env.XRAY_DOMAIN || "localhost", note: "VLESS + gRPC + TLS" },
    { tag: "vmess-ws", protocol: "vmess", port: PORT, network: "ws", security: "tls", path: "/vmess-ws", serviceName: null, sni: process.env.XRAY_DOMAIN || "localhost", note: "VMess + WebSocket + TLS" },
    { tag: "trojan-ws", protocol: "trojan", port: PORT, network: "ws", security: "tls", path: "/trojan-ws", serviceName: null, sni: process.env.XRAY_DOMAIN || "localhost", note: "Trojan + WebSocket + TLS" },
    { tag: "trojan-grpc", protocol: "trojan", port: PORT, network: "grpc", security: "tls", path: null, serviceName: "trojan-grpc", sni: process.env.XRAY_DOMAIN || "localhost", note: "Trojan + gRPC + TLS" },
    { tag: "vless-reality", protocol: "vless", port: PORT + 1, network: "tcp", security: "reality", path: null, serviceName: null, sni: "www.microsoft.com", note: "VLESS + XTLS-Reality (raw TCP required)" },
    { tag: "vless-xhttp", protocol: "vless", port: PORT, network: "xhttp", security: "tls", path: "/vless-xhttp", serviceName: null, sni: process.env.XRAY_DOMAIN || "localhost", note: "VLESS + xHTTP + TLS" },
    { tag: "vless-tcp-xtls", protocol: "vless", port: PORT + 2, network: "tcp", security: "tls", path: null, serviceName: null, sni: process.env.XRAY_DOMAIN || "localhost", note: "VLESS + TCP + XTLS-Vision" },
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
      console.log(`✓ Created plan ${p.name}`);
    }
  }

  // 4) Default settings
  const settings = [
    { key: "domain", value: process.env.XRAY_DOMAIN || "localhost" },
    { key: "language", value: "fa" },
    { key: "telegram_bot_token", value: "" },
    { key: "telegram_chat_id", value: "" },
    { key: "telegram_enabled", value: "false" },
    { key: "ssl_auto", value: "true" },
    { key: "backup_auto_enabled", value: "false" },
    { key: "backup_interval_hours", value: "24" },
    { key: "country_restrict_default", value: "" },
  ];
  for (const s of settings) {
    const existing = await db.setting.findUnique({ where: { key: s.key } });
    if (!existing) {
      await db.setting.create({ data: s });
    }
  }

  // 5) Sample VPN user (for demo purposes)
  const existingUser = await db.vpnUser.findUnique({ where: { username: "demo-user" } });
  if (!existingUser) {
    const expireAt = new Date();
    expireAt.setDate(expireAt.getDate() + 30);
    await db.vpnUser.create({
      data: {
        uuid: randomUUID(),
        username: "demo-user",
        subToken: randomUUID(),
        dataLimitBytes: BigInt(30 * 1024 * 1024 * 1024), // 30 GB
        usedBytes: BigInt(Math.floor(2.4 * 1024 * 1024 * 1024)),
        expireAt,
        maxDevices: 3,
        enabled: true,
        notes: "کاربر نمونه برای نمایش",
        tags: "ویژه,تست",
      },
    });
    console.log("✓ Created sample user 'demo-user'");
  }

  console.log("✅ Seed complete");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
