import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminFromRequest, hashPassword } from "@/lib/auth";

// POST /api/auth/password — change the current admin's password
export async function POST(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "احراز هویت نشده‌اید" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { newPassword } = body;
    if (!newPassword || String(newPassword).length < 6) {
      return NextResponse.json(
        { ok: false, error: "رمز جدید باید حداقل ۶ کاراکتر باشد" },
        { status: 400 }
      );
    }

    const hash = await hashPassword(String(newPassword));
    await db.admin.update({
      where: { id: admin.id },
      data: { password: hash },
    });

    await db.activityLog.create({
      data: {
        action: "update",
        entity: "admin",
        entityId: admin.id,
        detail: "تغییر رمز عبور",
        adminId: admin.id,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[auth/password] error", err);
    return NextResponse.json(
      { ok: false, error: "خطا در تغییر رمز عبور" },
      { status: 500 }
    );
  }
}
