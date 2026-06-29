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

// GET /api/servers/[id]
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const server = await db.server.findUnique({
    where: { id },
    include: { configs: true },
  });
  if (!server) {
    return NextResponse.json(
      { ok: false, error: "سرور یافت نشد" },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true, server: serializeForJSON(server) });
}

// PUT /api/servers/[id]
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await req.json();
  const existing = await db.server.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "سرور یافت نشد" },
      { status: 404 }
    );
  }

  const { name, host, port, protocol, remark, location, isActive } = body;
  const server = await db.server.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(host !== undefined && { host }),
      ...(port !== undefined && { port: Number(port) }),
      ...(protocol !== undefined && { protocol }),
      ...(remark !== undefined && { remark }),
      ...(location !== undefined && { location }),
      ...(isActive !== undefined && { isActive: Boolean(isActive) }),
    },
  });

  await db.activityLog.create({
    data: {
      action: "update",
      entity: "server",
      entityId: id,
      detail: `ویرایش سرور ${server.name}`,
      adminId: auth.admin.id,
    },
  });

  return NextResponse.json({ ok: true, server: serializeForJSON(server) });
}

// DELETE /api/servers/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const existing = await db.server.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "سرور یافت نشد" },
      { status: 404 }
    );
  }

  const count = await db.config.count({ where: { serverId: id } });
  if (count > 0) {
    return NextResponse.json(
      {
        ok: false,
        error: `این سرور ${count} کانفیگ دارد. ابتدا کانفیگ‌ها را حذف یا منتقل کنید.`,
      },
      { status: 400 }
    );
  }

  await db.server.delete({ where: { id } });

  await db.activityLog.create({
    data: {
      action: "delete",
      entity: "server",
      entityId: id,
      detail: `حذف سرور ${existing.name}`,
      adminId: auth.admin.id,
    },
  });

  return NextResponse.json({ ok: true });
}
