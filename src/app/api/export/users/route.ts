// /api/export/users — CSV export of users + usage
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

function csvEscape(s: string | null | undefined): string {
  if (s == null) return "";
  const str = String(s);
  if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const users = await db.vpnUser.findMany({
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  const header = [
    "نام کاربری",
    "UUID",
    "سهمیه (GB)",
    "مصرف‌شده (GB)",
    "باقی‌مانده (GB)",
    "تاریخ انقضا (میلادی)",
    "حداکثر دستگاه",
    "فعال",
    "معلق",
    "بسته",
    "برچسب‌ها",
    "یادداشت",
    "لینک اشتراک",
  ].join(",");

  const rows = users.map((u) => {
    const limitGb = Number(u.dataLimitBytes) / 1e9;
    const usedGb = Number(u.usedBytes) / 1e9;
    const remainGb = limitGb > 0 ? Math.max(0, limitGb - usedGb) : 0;
    const host = process.env.XRAY_DOMAIN || process.env.RAILWAY_STATIC_URL || "localhost";
    return [
      csvEscape(u.username),
      csvEscape(u.uuid),
      limitGb > 0 ? limitGb.toFixed(2) : "نامحدود",
      usedGb.toFixed(2),
      limitGb > 0 ? remainGb.toFixed(2) : "نامحدود",
      csvEscape(u.expireAt ? new Date(u.expireAt).toISOString() : "نامحدود"),
      u.maxDevices,
      u.enabled ? "بله" : "خیر",
      u.suspended ? "بله" : "خیر",
      csvEscape(u.plan?.name ?? ""),
      csvEscape(u.tags),
      csvEscape(u.notes),
      csvEscape(`https://${host}/sub/${u.subToken}`),
    ].join(",");
  });

  const csv = "\uFEFF" + [header, ...rows].join("\n"); // BOM for Excel UTF-8
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cyberx-users-${new Date()
        .toISOString()
        .slice(0, 10)}.csv"`,
    },
  });
}
