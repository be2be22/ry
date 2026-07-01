// /api/health-check — periodically checks each protocol config health
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateUserConfigs, getEffectiveHost } from "@/lib/subscription";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const host = await getEffectiveHost();
  const users = await db.vpnUser.findMany({ where: { enabled: true }, take: 5 });
  const results: Array<{
    username: string;
    protocol: string;
    reachable: boolean;
    latencyMs: number;
    note: string;
  }> = [];

  for (const user of users) {
    const configs = await generateUserConfigs(user.uuid, user.username, host);
    for (const cfg of configs) {
      // Simulated health-check: in real deployment you'd actually try connecting.
      // Here we just measure HTTP reachability of the host (TLS handshake check).
      const start = Date.now();
      let reachable = false;
      try {
        const res = await fetch(`https://${host}/sub/${user.subToken}?format=base64`, {
          method: "HEAD",
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        reachable = res.ok;
      } catch {
        reachable = false;
      }
      const latencyMs = Date.now() - start;
      results.push({
        username: user.username,
        protocol: cfg.name,
        reachable,
        latencyMs,
        note: reachable
          ? "مسیر اشتراک از طریق HTTPS قابل دسترس است"
          : "ناموفق — احتمالا Xray متوقف است یا مسیر اشتراک قطع شده",
      });
    }
  }

  return NextResponse.json({ results });
}
