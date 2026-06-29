import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth";
import { readFullLog, readLogTail } from "@/lib/xray-process";

/**
 * GET /api/xray/logs?lines=50  — return the last N lines of Xray log
 *     /api/xray/logs?full=1    — return the full log (capped at 100KB)
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
    const url = new URL(req.url);
    const full = url.searchParams.get("full") === "1";
    const lines = Number(url.searchParams.get("lines") || 50);

    const content = full ? readFullLog() : readLogTail(lines);

    return NextResponse.json({
      ok: true,
      content,
      full,
      lines: full ? undefined : lines,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "خطای ناشناخته" },
      { status: 500 }
    );
  }
}
