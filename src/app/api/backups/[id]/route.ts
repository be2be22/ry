// /api/backups/[id] — download a backup file
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { promises as fs } from "fs";
import path from "path";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await db.backup.findUnique({ where: { id } });
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });

  const filepath = path.join(process.cwd(), "backups", rec.filename);
  try {
    const data = await fs.readFile(filepath);
    return new NextResponse(data, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${rec.filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "file not on disk" }, { status: 404 });
  }
}

export async function DELETE(_req: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const rec = await db.backup.findUnique({ where: { id } });
  if (!rec) return NextResponse.json({ error: "not found" }, { status: 404 });
  const filepath = path.join(process.cwd(), "backups", rec.filename);
  try {
    await fs.unlink(filepath);
  } catch {
    /* ignore */
  }
  await db.backup.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
