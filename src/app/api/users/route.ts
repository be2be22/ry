// /api/users — list & create users
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { regenerateXrayConfigWithUsers } from "@/lib/xray";
import { randomUUID } from "crypto";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") || "";
  const status = url.searchParams.get("status") || "";

  const where: Record<string, unknown> = {};
  if (q) {
    where.OR = [
      { username: { contains: q } },
      { notes: { contains: q } },
      { tags: { contains: q } },
    ];
  }
  if (status === "enabled") where.enabled = true;
  if (status === "disabled") where.enabled = false;
  if (status === "expired") where.expireAt = { lt: new Date() };

  const users = await db.vpnUser.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { plan: true },
  });

  // Serialize BigInt fields
  const out = users.map((u) => ({
    ...u,
    dataLimitBytes: u.dataLimitBytes.toString(),
    usedBytes: u.usedBytes.toString(),
    plan: u.plan
      ? {
          ...u.plan,
        }
      : null,
  }));

  return NextResponse.json({ users: out });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const {
    username,
    notes,
    tags,
    dataLimitGb,
    expireAt,
    maxDevices,
    enabled,
    allowedIps,
    planId,
  } = body;

  if (!username) {
    return NextResponse.json({ error: "نام کاربری الزامی است" }, { status: 400 });
  }

  // Check uniqueness
  const existing = await db.vpnUser.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json({ error: "نام کاربری تکراری است" }, { status: 400 });
  }

  const dataLimitBytes =
    dataLimitGb && Number(dataLimitGb) > 0
      ? BigInt(Math.floor(Number(dataLimitGb) * 1024 * 1024 * 1024))
      : BigInt(0);

  const user = await db.vpnUser.create({
    data: {
      uuid: randomUUID(),
      username,
      subToken: randomUUID(),
      notes: notes || null,
      tags: tags || null,
      dataLimitBytes,
      usedBytes: BigInt(0),
      expireAt: expireAt ? new Date(expireAt) : null,
      maxDevices: Number(maxDevices) || 3,
      enabled: enabled !== false,
      allowedIps: allowedIps || null,
      planId: planId || null,
    },
  });

  await regenerateXrayConfigWithUsers();
  await writeAudit({
    adminId: session.user.id,
    action: "USER_CREATE",
    target: username,
    detail: `dataLimitGb=${dataLimitGb} maxDevices=${maxDevices}`,
  });

  return NextResponse.json({
    ...user,
    dataLimitBytes: user.dataLimitBytes.toString(),
    usedBytes: user.usedBytes.toString(),
  });
}
