// /api/2fa/disable
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const adminId = session.user.id;
  await db.admin.update({
    where: { id: adminId },
    data: { totpEnabled: false, totpSecret: null },
  });
  await writeAudit({ adminId, action: "2FA_DISABLE" });
  return NextResponse.json({ ok: true });
}
