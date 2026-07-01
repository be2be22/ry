// /api/users/[id] — get/update/delete a single user
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { regenerateXrayConfigWithUsers } from "@/lib/xray";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const user = await db.vpnUser.findUnique({ where: { id }, include: { plan: true } });
  if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    ...user,
    dataLimitBytes: user.dataLimitBytes.toString(),
    usedBytes: user.usedBytes.toString(),
  });
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const existing = await db.vpnUser.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.username !== undefined) data.username = body.username;
  if (body.notes !== undefined) data.notes = body.notes || null;
  if (body.tags !== undefined) data.tags = body.tags || null;
  if (body.maxDevices !== undefined) data.maxDevices = Number(body.maxDevices);
  if (body.enabled !== undefined) data.enabled = Boolean(body.enabled);
  if (body.suspended !== undefined) data.suspended = Boolean(body.suspended);
  if (body.allowedIps !== undefined) data.allowedIps = body.allowedIps || null;
  if (body.planId !== undefined) data.planId = body.planId || null;
  if (body.expireAt !== undefined)
    data.expireAt = body.expireAt ? new Date(body.expireAt) : null;
  if (body.dataLimitGb !== undefined) {
    data.dataLimitBytes =
      Number(body.dataLimitGb) > 0
        ? BigInt(Math.floor(Number(body.dataLimitGb) * 1024 * 1024 * 1024))
        : BigInt(0);
  }
  // Reset usage if requested
  if (body.resetUsage === true) {
    data.usedBytes = BigInt(0);
  }

  const updated = await db.vpnUser.update({ where: { id }, data });
  await regenerateXrayConfigWithUsers();
  await writeAudit({
    adminId: session.user.id,
    action: "USER_UPDATE",
    target: existing.username,
    detail: JSON.stringify(body).slice(0, 200),
  });

  return NextResponse.json({
    ...updated,
    dataLimitBytes: updated.dataLimitBytes.toString(),
    usedBytes: updated.usedBytes.toString(),
  });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.vpnUser.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.vpnUser.delete({ where: { id } });
  await regenerateXrayConfigWithUsers();
  await writeAudit({
    adminId: session.user.id,
    action: "USER_DELETE",
    target: existing.username,
  });
  return NextResponse.json({ ok: true });
}
