// /api/inbounds — list & create
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { regenerateXrayConfigWithUsers } from "@/lib/xray";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const inbounds = await db.inbound.findMany({ orderBy: { tag: "asc" } });
  return NextResponse.json({ inbounds });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (!body.tag || !body.protocol) {
    return NextResponse.json({ error: "tag و protocol الزامی است" }, { status: 400 });
  }
  const dup = await db.inbound.findUnique({ where: { tag: body.tag } });
  if (dup) return NextResponse.json({ error: "tag تکراری است" }, { status: 400 });

  const ib = await db.inbound.create({
    data: {
      tag: body.tag,
      protocol: body.protocol,
      port: Number(body.port) || 8443,
      network: body.network || "ws",
      security: body.security || "tls",
      path: body.path || null,
      serviceName: body.serviceName || null,
      sni: body.sni || null,
      note: body.note || null,
      enabled: body.enabled !== false,
    },
  });
  await regenerateXrayConfigWithUsers();
  await writeAudit({
    adminId: session.user.id,
    action: "INBOUND_CREATE",
    target: body.tag,
  });
  return NextResponse.json(ib);
}
