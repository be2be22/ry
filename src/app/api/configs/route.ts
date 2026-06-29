import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { randomUUID } from "crypto";
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

/**
 * If Xray is running, regenerate config.json so changes take effect.
 * Returns true if the config was regenerated, false otherwise.
 */
async function maybeReloadXray(): Promise<boolean> {
  const status = await getXrayStatus();
  if (!status.running) return false;
  await writeXrayConfig();
  // Note: SIGHUP would reload in-place, but Xray's config reload requires
  // restart for inbound client changes. The UI calls /api/xray/restart
  // explicitly when needed — here we just make sure config.json is fresh.
  return true;
}

// GET /api/configs — list all configs with server + user relations
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  const url = new URL(req.url);
  const search = url.searchParams.get("search") || "";
  const status = url.searchParams.get("status") || "";
  const type = url.searchParams.get("type") || "";
  const serverId = url.searchParams.get("serverId") || "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { uuid: { contains: search } },
    ];
  }
  if (status) where.status = status;
  if (type) where.type = type;
  if (serverId) where.serverId = serverId;

  const configs = await db.config.findMany({
    where,
    include: {
      server: true,
      assignedUser: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ ok: true, configs: serializeForJSON(configs) });
}

// POST /api/configs — create a new config
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();

    const {
      name,
      type = "vmess",
      serverId,
      path = "/",
      host,
      sni,
      tls = "tls",
      network = "ws",
      security = "auto",
      encryption = "none",
      alterId = 0,
      port,
      flow,
      status = "active",
      uuid,
      expiresAt,
      assignedUserId,
    } = body;

    if (!name) {
      return NextResponse.json(
        { ok: false, error: "نام کانفیگ الزامی است" },
        { status: 400 }
      );
    }
    if (!serverId) {
      return NextResponse.json(
        { ok: false, error: "انتخاب سرور الزامی است" },
        { status: 400 }
      );
    }

    const server = await db.server.findUnique({ where: { id: serverId } });
    if (!server) {
      return NextResponse.json(
        { ok: false, error: "سرور انتخاب شده یافت نشد" },
        { status: 404 }
      );
    }

    const finalUuid = uuid || randomUUID();
    const finalPort = port || server.port;

    const config = await db.config.create({
      data: {
        name,
        type,
        uuid: finalUuid,
        serverId,
        path,
        host: host || server.host,
        sni: sni || host || server.host,
        tls,
        network,
        security,
        encryption,
        alterId: Number(alterId) || 0,
        port: Number(finalPort) || 443,
        flow: flow || null,
        status,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        assignedUserId: assignedUserId || null,
        xrayActive: false, // will be set to true after Xray reload
      },
      include: {
        server: true,
        assignedUser: true,
      },
    });

    await db.activityLog.create({
      data: {
        action: "create",
        entity: "config",
        entityId: config.id,
        detail: `ساخت کانفیگ ${name} (${type})`,
        adminId: auth.admin.id,
      },
    });

    // If Xray is running, regenerate config and mark this config as active
    const xrayStatus = await getXrayStatus();
    let xrayReloaded = false;
    if (xrayStatus.running && status === "active") {
      await writeXrayConfig();
      await setConfigXrayActive(config.id, true);
      xrayReloaded = true;
    }

    return NextResponse.json({
      ok: true,
      config: serializeForJSON(config),
      xrayReloaded,
      xrayRunning: xrayStatus.running,
    });
  } catch (err) {
    console.error("[configs/create] error", err);
    return NextResponse.json(
      { ok: false, error: "خطا در ساخت کانفیگ" },
      { status: 500 }
    );
  }
}
