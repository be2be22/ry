// /api/2fa/verify — verify a TOTP code and enable 2FA
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { verifyToken } from "@/lib/totp";
import { writeAudit } from "@/lib/audit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { code } = await req.json();
  const adminId = session.user.id;
  const admin = await db.admin.findUnique({ where: { id: adminId } });
  if (!admin || !admin.totpSecret) {
    return NextResponse.json({ error: "ابتدا تنظیمات ۲FA را شروع کنید" }, { status: 400 });
  }
  const ok = await verifyToken(code, admin.totpSecret);
  if (!ok) return NextResponse.json({ error: "کد اشتباه است" }, { status: 400 });
  await db.admin.update({ where: { id: adminId }, data: { totpEnabled: true } });
  await writeAudit({ adminId, action: "2FA_ENABLE" });
  return NextResponse.json({ ok: true });
}
