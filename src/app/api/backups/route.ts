// /api/backups — list & create DB backups
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DB_PATH = path.join(process.cwd(), "db", "custom.db");

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const backups = await db.backup.findMany({ orderBy: { createdAt: "desc" }, take: 50 });
  return NextResponse.json({
    backups: backups.map((b) => ({ ...b, size: b.size.toString() })),
  });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const backupDir = path.join(process.cwd(), "backups");
  await fs.mkdir(backupDir, { recursive: true });
  const filename = `backup-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}.db`;
  const filepath = path.join(backupDir, filename);

  // Copy the SQLite file
  try {
    const data = await fs.readFile(DB_PATH);
    await fs.writeFile(filepath, data);
  } catch (e) {
    return NextResponse.json({ error: "backup failed: " + String(e) }, { status: 500 });
  }

  const stat = await fs.stat(filepath);
  const rec = await db.backup.create({
    data: { filename, size: BigInt(stat.size) },
  });
  await writeAudit({
    adminId: session.user.id,
    action: "BACKUP_CREATE",
    target: filename,
  });

  return NextResponse.json({ ...rec, size: rec.size.toString() });
}
