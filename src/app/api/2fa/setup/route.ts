// /api/2fa/setup — generate TOTP secret + QR for current admin
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateSecret, generateURI } from "@/lib/totp";
import QRCode from "qrcode";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const adminId = session.user.id;
  const admin = await db.admin.findUnique({ where: { id: adminId } });
  if (!admin) return NextResponse.json({ error: "admin not found" }, { status: 404 });

  const secret = generateSecret();
  const otpauth = generateURI({ label: admin.username, issuer: "CyberX-VPN-Panel", secret });
  const qrDataUrl = await QRCode.toDataURL(otpauth, {
    width: 240,
    color: { dark: "#2de8d0", light: "#050810" },
    margin: 1,
  });

  // Save secret to DB but don't enable yet
  await db.admin.update({ where: { id: adminId }, data: { totpSecret: secret } });

  return NextResponse.json({ secret, qrDataUrl });
}
