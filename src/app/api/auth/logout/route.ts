import { NextResponse } from "next/server";
import { buildClearSessionCookie } from "@/lib/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("set-cookie", buildClearSessionCookie());
  return res;
}
