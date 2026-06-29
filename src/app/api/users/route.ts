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

// GET /api/users
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const users = await db.user.findMany({
    include: {
      _count: { select: { configs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, users: serializeForJSON(users) });
}

// POST /api/users
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { username, email, phone, status = "active", dataLimit = 0, expireDays = 30 } = body;

    if (!username) {
      return NextResponse.json(
        { ok: false, error: "نام کاربری الزامی است" },
        { status: 400 }
      );
    }

    const exists = await db.user.findUnique({ where: { username } });
    if (exists) {
      return NextResponse.json(
        { ok: false, error: "این نام کاربری قبلا ثبت شده است" },
        { status: 400 }
      );
    }

    const expiresAt = expireDays > 0
      ? new Date(Date.now() + Number(expireDays) * 24 * 60 * 60 * 1000)
      : null;

    const user = await db.user.create({
      data: {
        username,
        email: email || null,
        phone: phone || null,
        status,
        dataLimit: toBigInt(dataLimit),
        expireDays: Number(expireDays) || 0,
        expiresAt,
      },
    });

    await db.activityLog.create({
      data: {
        action: "create",
        entity: "user",
        entityId: user.id,
        detail: `افزودن کاربر ${username}`,
        adminId: auth.admin.id,
      },
    });

    return NextResponse.json({ ok: true, user: serializeForJSON(user) });
  } catch (err) {
    console.error("[users/create] error", err);
    return NextResponse.json(
      { ok: false, error: "خطا در ساخت کاربر" },
      { status: 500 }
    );
  }
}
