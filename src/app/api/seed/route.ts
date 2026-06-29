import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminFromRequest, hashPassword, ensureDefaultAdmin } from "@/lib/auth";
import { randomUUID } from "crypto";

// POST /api/seed — populate demo data (servers, users, configs)
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "احراز هویت نشده‌اید" },
      { status: 401 }
    );
  }

  await ensureDefaultAdmin();

  // Always reset and reseed (idempotent for demo purposes)
  await db.config.deleteMany({});
  await db.user.deleteMany({});
  await db.server.deleteMany({});

  // Create demo servers
  const servers = await Promise.all([
    db.server.create({
      data: {
        name: "FastApiCloud-DE-01",
        host: "de1.fastapicloud.com",
        port: 443,
        protocol: "ws",
        location: "آلمان - فرانکفورت",
        remark: "سرور اصلی آلمان با TLS",
      },
    }),
    db.server.create({
      data: {
        name: "FastApiCloud-NL-02",
        host: "nl2.fastapicloud.com",
        port: 443,
        protocol: "ws",
        location: "هلند - آمستردام",
        remark: "سرور هلند با CDN Cloudflare",
      },
    }),
    db.server.create({
      data: {
        name: "FastApiCloud-FI-03",
        host: "fi3.fastapicloud.com",
        port: 8443,
        protocol: "ws",
        location: "فنلاند - هلسینکی",
        remark: "سرور فنلاند با پورت ۸۴۴۳",
      },
    }),
  ]);

  // Create demo users
  const users = await Promise.all([
    db.user.create({
      data: {
        username: "client_ali",
        email: "ali@example.com",
        phone: "09120000001",
        status: "active",
        dataLimit: BigInt(50 * 1024 * 1024 * 1024), // 50GB
        dataUsed: BigInt(12 * 1024 * 1024 * 1024),
        expireDays: 30,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
    db.user.create({
      data: {
        username: "client_sara",
        email: "sara@example.com",
        phone: "09120000002",
        status: "active",
        dataLimit: BigInt(100 * 1024 * 1024 * 1024), // 100GB
        dataUsed: BigInt(78 * 1024 * 1024 * 1024),
        expireDays: 60,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      },
    }),
    db.user.create({
      data: {
        username: "client_reza",
        email: "reza@example.com",
        phone: "09120000003",
        status: "suspended",
        dataLimit: BigInt(30 * 1024 * 1024 * 1024),
        dataUsed: BigInt(30 * 1024 * 1024 * 1024),
        expireDays: 30,
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // expired
      },
    }),
  ]);

  // Create demo configs
  const configsData = [
    { type: "vmess", serverIdx: 0, userIdx: 0, name: "ali-vmess-de" },
    { type: "vless", serverIdx: 1, userIdx: 0, name: "ali-vless-nl" },
    { type: "trojan", serverIdx: 2, userIdx: 1, name: "sara-trojan-fi" },
    { type: "vmess", serverIdx: 1, userIdx: 1, name: "sara-vmess-nl" },
    { type: "vless", serverIdx: 0, userIdx: 2, name: "reza-vless-de" },
  ];

  for (const cd of configsData) {
    const server = servers[cd.serverIdx];
    const user = users[cd.userIdx];
    await db.config.create({
      data: {
        name: cd.name,
        type: cd.type,
        uuid: randomUUID(),
        serverId: server.id,
        path: "/" + cd.type + "-" + Math.random().toString(36).slice(2, 8),
        host: server.host,
        sni: server.host,
        tls: "tls",
        network: "ws",
        security: "auto",
        encryption: cd.type === "vless" ? "none" : "none",
        alterId: cd.type === "vmess" ? 0 : 0,
        port: server.port,
        status: user.status === "suspended" ? "disabled" : "active",
        uploadBytes: BigInt(Math.floor(Math.random() * 5 * 1024 * 1024 * 1024)),
        downloadBytes: BigInt(Math.floor(Math.random() * 20 * 1024 * 1024 * 1024)),
        totalUsageBytes: BigInt(Math.floor(Math.random() * 25 * 1024 * 1024 * 1024)),
        assignedUserId: user.id,
        expiresAt: user.expiresAt,
      },
    });
  }

  await db.activityLog.create({
    data: {
      action: "seed",
      entity: "system",
      detail: "ایجاد داده‌های نمونه اولیه",
      adminId: admin.id,
    },
  });

  return NextResponse.json({
    ok: true,
    message: "داده‌های نمونه با موفقیت ایجاد شدند",
    counts: {
      servers: servers.length,
      users: users.length,
      configs: configsData.length,
    },
  });
}
