// /api/xray/port-check — check if Xray is actually listening on its port
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Socket } from "net";

async function checkPort(host: string, port: number): Promise<{ open: boolean; error?: string }> {
  return new Promise((resolve) => {
    const socket = new Socket();
    const timeout = 3000;

    socket.setTimeout(timeout);
    socket.on("connect", () => {
      socket.destroy();
      resolve({ open: true });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ open: false, error: "timeout" });
    });
    socket.on("error", (err) => {
      resolve({ open: false, error: err.message });
    });

    socket.connect(port, host);
  });
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const xrayPort = Number(process.env.XRAY_PORT || 8443);
  const nextPort = Number(process.env.NEXT_PORT || 3001);

  const [xrayCheck, nextCheck] = await Promise.all([
    checkPort("127.0.0.1", xrayPort),
    checkPort("127.0.0.1", nextPort),
  ]);

  return NextResponse.json({
    xray: {
      port: xrayPort,
      portOpen: xrayCheck.open,
      portError: xrayCheck.error || null,
    },
    nextjs: {
      port: nextPort,
      portOpen: nextCheck.open,
      portError: nextCheck.error || null,
    },
    caddy: {
      port: Number(process.env.PORT || 3000),
    },
  });
}
