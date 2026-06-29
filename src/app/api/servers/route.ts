import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { serializeForJSON } from "@/lib/serialize";

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

// GET /api/servers
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const servers = await db.server.findMany({
    include: {
      _count: { select: { configs: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, servers: serializeForJSON(servers) });
}

// POST /api/servers
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const { name, host, port = 443, protocol = "ws", remark, location } = body;

    if (!name || !host) {
      return NextResponse.json(
        { ok: false, error: "نام و آدرس سرور الزامی است" },
        { status: 400 }
      );
    }

    const server = await db.server.create({
      data: {
        name,
        host,
        port: Number(port),
        protocol,
        remark: remark || null,
        location: location || null,
      },
    });

    await db.activityLog.create({
      data: {
        action: "create",
        entity: "server",
        entityId: server.id,
        detail: `افزودن سرور ${name}`,
        adminId: auth.admin.id,
      },
    });

    return NextResponse.json({ ok: true, server: serializeForJSON(server) });
  } catch (err) {
    console.error("[servers/create] error", err);
    return NextResponse.json(
      { ok: false, error: "خطا در ساخت سرور" },
      { status: 500 }
    );
  }
}
