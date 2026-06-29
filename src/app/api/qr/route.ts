import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getAdminFromRequest } from "@/lib/auth";
import { generateShareLink } from "@/lib/v2ray";

// GET /api/qr?id=<configId> — returns PNG image of QR code for the config share link
export async function GET(req: NextRequest) {
  const admin = await getAdminFromRequest(req);
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: "احراز هویت نشده‌اید" },
      { status: 401 }
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const text = url.searchParams.get("text");

  let content = text;
  if (id) {
    const config = await db.config.findUnique({
      where: { id },
      include: { server: true },
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
    content = generateShareLink(shareConfig);
  }

  if (!content) {
    return NextResponse.json(
      { ok: false, error: "متن یا شناسه کانفیگ ارسال نشده است" },
      { status: 400 }
    );
  }

  try {
    const pngBuffer = await QRCode.toBuffer(content, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 512,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });

    return new NextResponse(pngBuffer, {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    console.error("[qr] error", err);
    return NextResponse.json(
      { ok: false, error: "خطا در تولید QR Code" },
      { status: 500 }
    );
  }
}
