// /api/public/status — public, no-auth system status (for the status page)
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getXrayState } from "@/lib/xray";
import os from "os";

export async function GET() {
  const xray = await getXrayState();
  const totalUsers = await db.vpnUser.count();
  const enabledUsers = await db.vpnUser.count({ where: { enabled: true } });

  return NextResponse.json({
    online: true,
    xrayRunning: xray.running,
    xrayMode: xray.mode,
    uptimeSeconds: os.uptime(),
    totalUsers,
    enabledUsers,
    timestamp: new Date().toISOString(),
  });
}
