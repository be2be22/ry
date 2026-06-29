import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { serializeForJSON, toBigInt } from "@/lib/serialize";

async function requireAuth(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return {
      error: NextResponse.json(
        { ok: false, error: "احراز هویت نشده‌اید" },
        { status: 401 }
      ),
    };
  }
  return { admin };
}

// GET /api/users/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    include: { configs: { include: { server: true } } },
  });
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "کاربر یافت نشد" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, user: serializeForJSON(user) });
}

// PUT /api/users/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "کاربر یافت نشد" },
      { status: 404 }
    );
  }

  const { username, email, phone, status, dataLimit, expireDays, dataUsed } = body;
  let expiresAt = existing.expiresAt;
  if (expireDays !== undefined) {
    expiresAt = expireDays > 0
      ? new Date(Date.now() + Number(expireDays) * 24 * 60 * 60 * 1000)
      : null;
  }

  const user = await db.user.update({
    where: { id },
    data: {
      ...(username !== undefined && { username }),
      ...(email !== undefined && { email: email || null }),
      ...(phone !== undefined && { phone: phone || null }),
      ...(status !== undefined && { status }),
      ...(dataLimit !== undefined && { dataLimit: toBigInt(dataLimit) }),
      ...(expireDays !== undefined && { expireDays: Number(expireDays) || 0 }),
      ...(dataUsed !== undefined && { dataUsed: toBigInt(dataUsed) }),
      expiresAt,
    },
  });

  await db.activityLog.create({
    data: {
      action: "update",
      entity: "user",
      entityId: id,
      detail: `ویرایش کاربر ${user.username}`,
      adminId: auth.admin.id,
    },
  });

  return NextResponse.json({ ok: true, user: serializeForJSON(user) });
}

// DELETE /api/users/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const existing = await db.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "کاربر یافت نشد" },
      { status: 404 }
    );
  }

  await db.user.delete({ where: { id } });

  await db.activityLog.create({
    data: {
      action: "delete",
      entity: "user",
      entityId: id,
      detail: `حذف کاربر ${existing.username}`,
      adminId: auth.admin.id,
    },
  });

  return NextResponse.json({ ok: true });
}
