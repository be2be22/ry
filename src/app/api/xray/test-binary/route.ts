// /api/xray/test-binary — quick diagnostic endpoint to check if the Xray binary works
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const XRAY_DIR =
    process.env.XRAY_DIR ||
    (process.cwd().startsWith("/app") ? "/app/xray-core" : path.join(process.cwd(), "xray-core"));
  const BINARY_PATH = path.join(XRAY_DIR, "xray");

  const result: Record<string, unknown> = {
    cwd: process.cwd(),
    xrayDir: XRAY_DIR,
    binaryPath: BINARY_PATH,
    binaryExists: false,
    binaryExecutable: false,
    versionOutput: null as string | null,
    error: null as string | null,
  };

  try {
    const stat = await fs.stat(BINARY_PATH);
    result.binaryExists = true;
    result.binaryExecutable = (stat.mode & 0o111) !== 0;
    result.size = stat.size;
  } catch (e) {
    result.error = `باینری یافت نشد: ${e instanceof Error ? e.message : String(e)}`;
    return NextResponse.json(result);
  }

  // Try to run `xray --version`
  try {
    const { stdout, stderr } = await execFileAsync(BINARY_PATH, ["-version"], {
      cwd: XRAY_DIR,
      timeout: 5000,
    });
    result.versionOutput = (stdout + stderr).trim();
  } catch (e) {
    result.error = `اجرای باینری شکست خورد: ${
      e instanceof Error ? e.message : String(e)
    }`;
    if ("stderr" in (e as object)) {
      result.versionOutput = String((e as { stderr?: string }).stderr || "");
    }
  }

  // Also list directory contents
  try {
    const files = await fs.readdir(XRAY_DIR);
    result.dirContents = files;
  } catch {
    /* ignore */
  }

  return NextResponse.json(result);
}
