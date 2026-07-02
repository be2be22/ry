// /api/xray/state — current Xray process state (with debug info)
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getXrayState } from "@/lib/xray";
import { promises as fs } from "fs";
import path from "path";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const state = await getXrayState();

  // Also return whether the binary actually exists on disk
  let binaryStat: { exists: boolean; size?: number; path: string } = {
    exists: false,
    path: state.binaryPath,
  };
  try {
    const s = await fs.stat(state.binaryPath);
    binaryStat = { exists: true, size: s.size, path: state.binaryPath };
  } catch {
    /* not found */
  }

  // Also return whether config.json exists
  let configStat: { exists: boolean; path: string; size?: number } = {
    exists: false,
    path: state.configPath,
  };
  try {
    const s = await fs.stat(state.configPath);
    configStat = { exists: true, size: s.size, path: state.configPath };
  } catch {
    /* not found */
  }

  // Railway TCP Proxy info
  const railwayTcp = {
    domain: process.env.RAILWAY_TCP_PROXY_DOMAIN || null,
    port: process.env.RAILWAY_TCP_PROXY_PORT || null,
    applicationPort: process.env.RAILWAY_TCP_APPLICATION_PORT || null,
  };

  return NextResponse.json({
    ...state,
    binaryStat,
    configStat,
    railwayTcp,
    env: {
      XRAY_DIR: process.env.XRAY_DIR || null,
      XRAY_DOMAIN: process.env.XRAY_DOMAIN || null,
      RAILWAY_STATIC_URL: process.env.RAILWAY_STATIC_URL || null,
      XRAY_REALITY_PUBLIC_KEY: process.env.XRAY_REALITY_PUBLIC_KEY ? "[SET]" : null,
      XRAY_REALITY_PRIVATE_KEY: process.env.XRAY_REALITY_PRIVATE_KEY ? "[SET]" : null,
    },
  });
}
