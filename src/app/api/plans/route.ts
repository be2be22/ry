// /api/plans — list & create
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const plans = await db.plan.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ plans });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: "name الزامی است" }, { status: 400 });

  const dup = await db.plan.findUnique({ where: { name: body.name } });
  if (dup) return NextResponse.json({ error: "نام بسته تکراری است" }, { status: 400 });

  const plan = await db.plan.create({
    data: {
      name: body.name,
      dataLimitGb: Number(body.dataLimitGb) || 0,
      durationDays: Number(body.durationDays) || 30,
      maxDevices: Number(body.maxDevices) || 3,
      price: Number(body.price) || 0,
      enabled: body.enabled !== false,
    },
  });
  await writeAudit({
    adminId: session.user.id,
    action: "PLAN_CREATE",
    target: body.name,
  });
  return NextResponse.json(plan);
}
