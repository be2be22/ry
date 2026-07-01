// /api/xray/state — current Xray process state
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getXrayState } from "@/lib/xray";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const state = await getXrayState();
  return NextResponse.json(state);
}
