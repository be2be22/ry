// /api/users/clone — clone an existing user
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { regenerateXrayConfigWithUsers } from "@/lib/xray";
import { randomUUID } from "crypto";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { sourceId, newUsername } = await req.json();
  if (!sourceId || !newUsername) {
    return NextResponse.json({ error: "sourceId و newUsername الزامی است" }, { status: 400 });
  }

  const existing = await db.vpnUser.findUnique({ where: { id: sourceId } });
  if (!existing) {
    return NextResponse.json({ error: "کاربر مبقب یافت نشد" }, { status: 404 });
  }

  const dup = await db.vpnUser.findUnique({ where: { username: newUsername } });
  if (dup) {
    return NextResponse.json({ error: "نام کاربری تکراری است" }, { status: 400 });
  }

  // Clone with new UUID + subToken + reset usage
  const cloned = await db.vpnUser.create({
    data: {
      uuid: randomUUID(),
      subToken: randomUUID(),
      username: newUsername,
      notes: existing.notes,
      tags: existing.tags,
      dataLimitBytes: existing.dataLimitBytes,
      usedBytes: BigInt(0),
      expireAt: existing.expireAt
        ? new Date(existing.expireAt.getTime() + 30 * 24 * 60 * 60 * 1000)
        : null,
      maxDevices: existing.maxDevices,
      enabled: true,
      suspended: false,
      allowedIps: existing.allowedIps,
      planId: existing.planId,
    },
  });

  await regenerateXrayConfigWithUsers();
  await writeAudit({
    adminId: session.user.id,
    action: "USER_CREATE",
    target: newUsername,
    detail: `cloned from ${existing.username}`,
  });

  return NextResponse.json({
    ...cloned,
    dataLimitBytes: cloned.dataLimitBytes.toString(),
    usedBytes: cloned.usedBytes.toString(),
  });
}
