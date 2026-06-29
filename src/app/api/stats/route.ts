import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { bigIntToJSON } from "@/lib/serialize";

export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "احراز هویت نشده‌اید" },
      { status: 401 }
    );
  }

  const [
    totalConfigs,
    activeConfigs,
    disabledConfigs,
    expiredConfigs,
    totalServers,
    activeServers,
    totalUsers,
    activeUsers,
    totalUsageAgg,
  ] = await Promise.all([
    db.config.count(),
    db.config.count({ where: { status: "active" } }),
    db.config.count({ where: { status: "disabled" } }),
    db.config.count({ where: { status: "expired" } }),
    db.server.count(),
    db.server.count({ where: { isActive: true } }),
    db.user.count(),
    db.user.count({ where: { status: "active" } }),
    db.config.aggregate({
      _sum: { totalUsageBytes: true, uploadBytes: true, downloadBytes: true },
    }),
  ]);

  // Configs by type
  const byType = await db.config.groupBy({
    by: ["type"],
    _count: { _all: true },
  });

  // Configs by status
  const byStatus = await db.config.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  // Recent activity logs
  const recentLogs = await db.activityLog.findMany({
    take: 10,
    orderBy: { createdAt: "desc" },
  });

  // Top servers by config count
  const topServers = await db.server.findMany({
    take: 5,
    orderBy: { configs: { _count: "desc" } },
    include: { _count: { select: { configs: true } } },
  });

  // Last 7 days config creation counts (simple grouping by date string)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentConfigs = await db.config.findMany({
    where: { createdAt: { gte: sevenDaysAgo } },
    select: { createdAt: true },
  });

  const dailyCounts: Record<string, number> = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const key = d.toISOString().slice(0, 10);
    dailyCounts[key] = 0;
  }
  for (const c of recentConfigs) {
    const key = c.createdAt.toISOString().slice(0, 10);
    if (key in dailyCounts) dailyCounts[key]++;
  }

  return NextResponse.json({
    ok: true,
    stats: {
      configs: {
        total: totalConfigs,
        active: activeConfigs,
        disabled: disabledConfigs,
        expired: expiredConfigs,
      },
      servers: {
        total: totalServers,
        active: activeServers,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
      },
      traffic: {
        total: bigIntToJSON(totalUsageAgg._sum.totalUsageBytes ?? 0n),
        upload: bigIntToJSON(totalUsageAgg._sum.uploadBytes ?? 0n),
        download: bigIntToJSON(totalUsageAgg._sum.downloadBytes ?? 0n),
      },
      byType: byType.map((t) => ({ type: t.type, count: t._count._all })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      dailyCounts: Object.entries(dailyCounts).map(([date, count]) => ({ date, count })),
      topServers: topServers.map((s) => ({
        id: s.id,
        name: s.name,
        location: s.location,
        configCount: s._count.configs,
      })),
      recentLogs,
    },
  });
}
