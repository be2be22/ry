import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { restartXray } from "@/lib/xray-process";

/**
 * POST /api/xray/restart
 * Regenerates config.json from DB state, then restarts the Xray process.
 * Use this after creating/updating/deleting configs to apply changes.
 */
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "احراز هویت نشده‌اید" },
      { status: 401 }
    );
  }

  try {
    const result = await restartXray();

    if (result.ok) {
      // Refresh xrayActive flags
      await db.config.updateMany({
        where: { status: "active" },
        data: { xrayActive: true, xrayAddedAt: new Date() },
      });
      await db.config.updateMany({
        where: { status: { not: "active" } },
        data: { xrayActive: false, xrayAddedAt: null },
      });

      await db.activityLog.create({
        data: {
          action: "xray_restart",
          entity: "system",
          detail: `Restart Xray (PID: ${result.pid})`,
          adminId: admin.id,
        },
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[xray/restart] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای ناشناخته" },
      { status: 500 }
    );
  }
}
