import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { stopXray } from "@/lib/xray-process";

/**
 * POST /api/xray/stop
 * Stops the local Xray process gracefully.
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
    const result = await stopXray();

    if (result.ok) {
      // Mark all configs as xrayActive=false
      await db.config.updateMany({
        where: { xrayActive: true },
        data: { xrayActive: false, xrayAddedAt: null },
      });

      await db.activityLog.create({
        data: {
          action: "xray_stop",
          entity: "system",
          detail: "توقف Xray",
          adminId: admin.id,
        },
      });
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[xray/stop] error", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای ناشناخته" },
      { status: 500 }
    );
  }
}
