import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest, ensureDefaultAdmin } from "@/lib/auth";

export async function GET(req: NextRequest) {
  await ensureDefaultAdmin();
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json({ ok: false, admin: null }, { status: 200 });
  }
  return NextResponse.json({ ok: true, admin });
}
