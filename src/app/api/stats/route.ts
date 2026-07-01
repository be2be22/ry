// /api/stats — live server stats + user counters + traffic history
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { getServerStats } from "@/lib/stats";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const stats = await getServerStats();

  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

  // User counters
  const totalUsers = await db.vpnUser.count();
  const expiredUsers = await db.vpnUser.count({
    where: { expireAt: { lt: new Date() } },
  });
  const enabledUsers = await db.vpnUser.count({ where: { enabled: true } });
  // Online = seen in the last 2 minutes
  const twoMinAgo = new Date(now - 2 * 60 * 1000);
  const onlineUsers = await db.vpnUser.count({
    where: { lastSeenAt: { gte: twoMinAgo } },
  });

  // Aggregate traffic totals
  const agg = await db.vpnUser.aggregate({
    _sum: { usedBytes: true },
  });

  // Hourly traffic for the last 24h (sum up/down per hour bucket)
  const recentRecords = await db.trafficRecord.findMany({
    where: { createdAt: { gte: new Date(weekAgo) } },
    select: { upBytes: true, downBytes: true, createdAt: true },
  });

  // Bucket into 24 hourly points
  const buckets: { ts: number; up: number; down: number }[] = [];
  for (let i = 23; i >= 0; i--) {
    const start = now - i * 60 * 60 * 1000;
    const end = start + 60 * 60 * 1000;
    const inBucket = recentRecords.filter(
      (r) => r.createdAt.getTime() >= start && r.createdAt.getTime() < end
    );
    const up = inBucket.reduce((s, r) => s + Number(r.upBytes), 0);
    const down = inBucket.reduce((s, r) => s + Number(r.downBytes), 0);
    buckets.push({ ts: start, up, down });
  }

  return NextResponse.json({
    server: stats,
    users: {
      total: totalUsers,
      expired: expiredUsers,
      enabled: enabledUsers,
      online: onlineUsers,
      totalUsedBytes: agg._sum.usedBytes?.toString() ?? "0",
    },
    traffic: {
      hourly: buckets,
      totalUpBytes: buckets.reduce((s, b) => s + b.up, 0),
      totalDownBytes: buckets.reduce((s, b) => s + b.down, 0),
    },
  });
}
