import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { writeXrayConfig } from "@/lib/xray-config";
import { serializeForJSON } from "@/lib/serialize";

/**
 * GET  /api/xray/config — return the current generated config.json (preview)
 * POST /api/xray/config — regenerate config.json from DB state (without restarting)
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
    const info = await writeXrayConfig();
    return NextResponse.json({
      ok: true,
      config: serializeForJSON(info.config),
      path: info.path,
      inboundCount: info.inboundCount,
      clientCount: info.clientCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای ناشناخته" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "احراز هویت نشده‌اید" },
      { status: 401 }
    );
  }

  try {
    const info = await writeXrayConfig();
    return NextResponse.json({
      ok: true,
      path: info.path,
      inboundCount: info.inboundCount,
      clientCount: info.clientCount,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای ناشناخته" },
      { status: 500 }
    );
  }
}
