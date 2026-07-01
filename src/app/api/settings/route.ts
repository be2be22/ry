// /api/settings — get & update settings
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const settings = await db.setting.findMany();
  const obj: Record<string, string> = {};
  for (const s of settings) obj[s.key] = s.value;
  return NextResponse.json(obj);
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  for (const [k, v] of Object.entries(body)) {
    const existing = await db.setting.findUnique({ where: { key: k } });
    if (existing) {
      await db.setting.update({ where: { key: k }, data: { value: String(v) } });
    } else {
      await db.setting.create({ data: { key: k, value: String(v) } });
    }
  }
  await writeAudit({
    adminId: session.user.id,
    action: "SETTINGS_UPDATE",
    detail: JSON.stringify(body).slice(0, 200),
  });
  return NextResponse.json({ ok: true });
}
