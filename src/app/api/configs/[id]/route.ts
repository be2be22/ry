import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { generateShareLink, generateInboundJson, generateClashYaml } from "@/lib/v2ray";
import { serializeForJSON } from "@/lib/serialize";
import { writeXrayConfig, setConfigXrayActive } from "@/lib/xray-config";
import { getXrayStatus } from "@/lib/xray-process";

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

// GET /api/configs/[id] — fetch single config (with share link, inbound json, clash yaml)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const config = await db.config.findUnique({
    where: { id },
    include: { server: true, assignedUser: true },
  });
  if (!config) {
    return NextResponse.json(
      { ok: false, error: "کانفیگ یافت نشد" },
      { status: 404 }
    );
  }

  const shareConfig = {
    type: config.type as "vmess" | "vless" | "trojan",
    uuid: config.uuid,
    host: config.host || config.server.host,
    port: config.port || config.server.port,
    path: config.path,
    hostHeader: config.host || undefined,
    sni: config.sni || undefined,
    tls: config.tls as "tls" | "none",
    network: config.network as "ws" | "tcp" | "grpc" | "h2",
    security: config.security,
    alterId: config.alterId,
    encryption: config.encryption,
    flow: config.flow || undefined,
    remark: config.name,
  };

  const shareLink = generateShareLink(shareConfig);
  const inboundJson = generateInboundJson(shareConfig);
  const clashYaml = generateClashYaml(shareConfig);

  return NextResponse.json({
    ok: true,
    config: serializeForJSON(config),
    shareLink,
    inboundJson,
    clashYaml,
  });
}

// PUT /api/configs/[id] — update config
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const body = await req.json();

  const existing = await db.config.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "کانفیگ یافت نشد" },
      { status: 404 }
    );
  }

  const {
    name,
    type,
    serverId,
    path,
    host,
    sni,
    tls,
    network,
    security,
    encryption,
    alterId,
    port,
    flow,
    status,
    uuid,
    expiresAt,
    assignedUserId,
  } = body;

  const config = await db.config.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(serverId !== undefined && { serverId }),
      ...(path !== undefined && { path }),
      ...(host !== undefined && { host }),
      ...(sni !== undefined && { sni }),
      ...(tls !== undefined && { tls }),
      ...(network !== undefined && { network }),
      ...(security !== undefined && { security }),
      ...(encryption !== undefined && { encryption }),
      ...(alterId !== undefined && { alterId: Number(alterId) }),
      ...(port !== undefined && { port: Number(port) }),
      ...(flow !== undefined && { flow }),
      ...(status !== undefined && { status }),
      ...(uuid !== undefined && { uuid }),
      ...(expiresAt !== undefined && {
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      }),
      ...(assignedUserId !== undefined && {
        assignedUserId: assignedUserId || null,
      }),
    },
    include: { server: true, assignedUser: true },
  });

  await db.activityLog.create({
    data: {
      action: "update",
      entity: "config",
      entityId: id,
      detail: `ویرایش کانفیگ ${config.name}`,
      adminId: auth.admin.id,
    },
  });

  // If Xray is running, regenerate config + sync xrayActive flag
  const xrayStatus = await getXrayStatus();
  let xrayReloaded = false;
  if (xrayStatus.running) {
    await writeXrayConfig();
    if (config.status === "active") {
      await setConfigXrayActive(config.id, true);
    } else {
      await setConfigXrayActive(config.id, false);
    }
    xrayReloaded = true;
  }

  return NextResponse.json({
    ok: true,
    config: serializeForJSON(config),
    xrayReloaded,
    xrayRunning: xrayStatus.running,
  });
}

// DELETE /api/configs/[id] — delete config
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const existing = await db.config.findUnique({
    where: { id },
    include: { server: true },
  });
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: "کانفیگ یافت نشد" },
      { status: 404 }
    );
  }

  await db.config.delete({ where: { id } });

  await db.activityLog.create({
    data: {
      action: "delete",
      entity: "config",
      entityId: id,
      detail: `حذف کانفیگ ${existing.name}`,
      adminId: auth.admin.id,
    },
  });

  // Regenerate config if Xray is running (user was removed)
  const xrayStatus = await getXrayStatus();
  let xrayReloaded = false;
  if (xrayStatus.running) {
    await writeXrayConfig();
    xrayReloaded = true;
  }

  return NextResponse.json({
    ok: true,
    xrayReloaded,
    xrayRunning: xrayStatus.running,
  });
}
