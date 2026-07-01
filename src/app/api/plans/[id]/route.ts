// /api/plans/[id]
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const existing = await db.plan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const updated = await db.plan.update({
    where: { id },
    data: {
      name: body.name ?? existing.name,
      dataLimitGb: body.dataLimitGb !== undefined ? Number(body.dataLimitGb) : existing.dataLimitGb,
      durationDays:
        body.durationDays !== undefined ? Number(body.durationDays) : existing.durationDays,
      maxDevices: body.maxDevices !== undefined ? Number(body.maxDevices) : existing.maxDevices,
      price: body.price !== undefined ? Number(body.price) : existing.price,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : existing.enabled,
    },
  });
  await writeAudit({
    adminId: session.user.id,
    action: "PLAN_UPDATE",
    target: existing.name,
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const existing = await db.plan.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.plan.delete({ where: { id } });
  await writeAudit({
    adminId: session.user.id,
    action: "PLAN_DELETE",
    target: existing.name,
  });
  return NextResponse.json({ ok: true });
}
