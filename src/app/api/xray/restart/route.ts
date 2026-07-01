import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { restartXray } from "@/lib/xray";
import { writeAudit } from "@/lib/audit";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const result = await restartXray();
  await writeAudit({
    adminId: session.user.id,
    action: "XRAY_RESTART",
    detail: result.message,
  });
  return NextResponse.json(result);
}
