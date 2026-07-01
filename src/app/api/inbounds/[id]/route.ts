// /api/inbounds/[id] — update / delete
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { regenerateXrayConfigWithUsers } from "@/lib/xray";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const existing = await db.inbound.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const k of [
    "tag",
    "protocol",
    "network",
    "security",
    "path",
    "serviceName",
    "sni",
    "note",
    "enabled",
  ]) {
    if (body[k] !== undefined) data[k] = body[k];
  }
  if (body.port !== undefined) data.port = Number(body.port);

  const updated = await db.inbound.update({ where: { id }, data });
  await regenerateXrayConfigWithUsers();
  await writeAudit({
    adminId: session.user.id,
    action: "INBOUND_UPDATE",
    target: existing.tag,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.inbound.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.inbound.delete({ where: { id } });
  await regenerateXrayConfigWithUsers();
  await writeAudit({
    adminId: session.user.id,
    action: "INBOUND_DELETE",
    target: existing.tag,
  });
  return NextResponse.json({ ok: true });
}
