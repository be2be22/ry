// /api/admins — list & create admins
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const admins = await db.admin.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      totpEnabled: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ admins });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // Only super-admins can create
  if ((session.user as { role?: string }).role !== "SUPER_ADMIN") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.username || !body.password) {
    return NextResponse.json({ error: "username و password الزامی است" }, { status: 400 });
  }
  const dup = await db.admin.findUnique({ where: { username: body.username } });
  if (dup) return NextResponse.json({ error: "نام کاربری تکراری است" }, { status: 400 });

  const hash = await bcrypt.hash(body.password, 10);
  const admin = await db.admin.create({
    data: {
      username: body.username,
      passwordHash: hash,
      role: body.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "ADMIN",
    },
  });
  await writeAudit({
    adminId: session.user.id,
    action: "ADMIN_CREATE",
    target: body.username,
  });
  return NextResponse.json({
    id: admin.id,
    username: admin.username,
    role: admin.role,
  });
}
