// /api/sub/[token] — public subscription endpoint
// Returns base64 sub blob for v2rayNG/Hiddify/Streisand, OR JSON for the web page.
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateUserConfigs, buildBase64Subscription, getEffectiveHost } from "@/lib/subscription";

interface RouteParams {
  params: Promise<{ token: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  const { token } = await params;
  const url = new URL(req.url);

  const user = await db.vpnUser.findUnique({ where: { subToken: token } });
  if (!user) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const host = await getEffectiveHost();

  // If `?format=base64` or User-Agent looks like a sub client → return base64
  const ua = req.headers.get("user-agent") || "";
  const wantsBase64 =
    url.searchParams.get("format") === "base64" ||
    /v2rayng|hidify|streisand|napsternetv|shadowrocket|quantumult|surge|clash/i.test(ua);

  if (wantsBase64) {
    const blob = await buildBase64Subscription(user.uuid, user.username, host);
    return new NextResponse(blob, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${user.username}.txt"`,
        "Cache-Control": "no-store",
        "Subscription-Userinfo": `upload=0; download=${user.usedBytes}; total=${user.dataLimitBytes}; expire=${
          user.expireAt ? Math.floor(new Date(user.expireAt).getTime() / 1000) : 0
        }`,
        "Profile-Update-Interval": "24",
      },
    });
  }

  // Otherwise return JSON for the web UI
  const configs = await generateUserConfigs(user.uuid, user.username, host);
  return NextResponse.json({
    user: {
      username: user.username,
      enabled: user.enabled,
      suspended: user.suspended,
      expireAt: user.expireAt,
      dataLimitBytes: user.dataLimitBytes.toString(),
      usedBytes: user.usedBytes.toString(),
      maxDevices: user.maxDevices,
      notes: user.notes,
      tags: user.tags,
    },
    host,
    subscriptionUrl: `https://${host}/sub/${user.subToken}`,
    configs,
  });
}
