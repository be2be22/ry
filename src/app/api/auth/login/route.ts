import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  buildSessionCookie,
  createSessionToken,
  ensureDefaultAdmin,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    await ensureDefaultAdmin();
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { ok: false, error: "نام کاربری و رمز عبور الزامی است" },
        { status: 400 }
      );
    }

    const admin = await db.admin.findUnique({
      where: { username: String(username).trim() },
    });
    if (!admin) {
      return NextResponse.json(
        { ok: false, error: "نام کاربری یا رمز عبور نادرست است" },
        { status: 401 }
      );
    }

    const ok = await verifyPassword(password, admin.password);
    if (!ok) {
      return NextResponse.json(
        { ok: false, error: "نام کاربری یا رمز عبور نادرست است" },
        { status: 401 }
      );
    }

    const token = createSessionToken({
      id: admin.id,
      username: admin.username,
      role: admin.role,
      email: admin.email,
    });

    const res = NextResponse.json({
      ok: true,
      admin: { id: admin.id, username: admin.username, role: admin.role, email: admin.email },
    });
    res.headers.set("set-cookie", buildSessionCookie(token));
    return res;
  } catch (err) {
    console.error("[auth/login] error", err);
    return NextResponse.json(
      { ok: false, error: "خطای سرور هنگام ورود" },
      { status: 500 }
    );
  }
}
