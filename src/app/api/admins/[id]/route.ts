// /api/admins/[id] — update / delete admin
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const existing = await db.admin.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (body.username) data.username = body.username;
  if (body.role && (session.user as { role?: string }).role === "SUPER_ADMIN") {
    data.role = body.role;
  }
  if (body.password) {
    data.passwordHash = await bcrypt.hash(body.password, 10);
  }

  const updated = await db.admin.update({ where: { id }, data });
  await writeAudit({
    adminId: session.user.id,
    action: "ADMIN_UPDATE",
    target: existing.username,
  });
  return NextResponse.json({
    id: updated.id,
    username: updated.username,
    role: updated.role,
  });
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { id } = await params;
  if (id === session.user.id) {
    return NextResponse.json({ error: "نمی‌توانید خودتان را حذف کنید" }, { status: 400 });
  }
  const existing = await db.admin.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  await db.admin.delete({ where: { id } });
  await writeAudit({
    adminId: session.user.id,
    action: "ADMIN_DELETE",
    target: existing.username,
  });
  return NextResponse.json({ ok: true });
}
