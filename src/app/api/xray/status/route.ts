import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { getXrayStatus } from "@/lib/xray-process";
import { serializeForJSON } from "@/lib/serialize";

/**
 * GET /api/xray/status
 * Returns the current status of the local Xray process.
 */
export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "احراز هویت نشده‌اید" },
      { status: 401 }
    );
  }

  try {
    const status = await getXrayStatus();
    return NextResponse.json({ ok: true, status: serializeForJSON(status) });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای ناشناخته" },
      { status: 500 }
    );
  }
}
