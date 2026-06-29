import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { startXray } from "@/lib/xray-process";

/**
 * POST /api/xray/start
 * Starts the local Xray process. Regenerates config.json from DB state first.
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
    const result = await startXray();

    if (result.ok) {
      // Mark all active configs as xrayActive=true
      await db.config.updateMany({
        where: { status: "active" },
        data: { xrayActive: true, xrayAddedAt: new Date() },
      });

      await db.activityLog.create({
        data: {
          action: "xray_start",
          entity: "system",
          detail: `اجرای Xray (PID: ${result.pid})`,
          adminId: admin.id,
        },
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[xray/start] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای ناشناخته" },
      { status: 500 }
    );
  }
}
