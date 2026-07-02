// /api/xray/reality-keys — generate a new Reality keypair
// The admin runs `xray x25519` to get a private/public keypair.
// We spawn the binary, capture the output, and return it.
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";

const execFileAsync = promisify(execFile);

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const XRAY_DIR =
    process.env.XRAY_DIR ||
    (process.cwd().startsWith("/app") ? "/app/xray-core" : path.join(process.cwd(), "xray-core"));
  const BINARY_PATH = path.join(XRAY_DIR, "xray");

  // Check binary exists
  try {
    await fs.access(BINARY_PATH);
  } catch {
    return NextResponse.json(
      {
        error: "باینری Xray در مسیر مورد نظر یافت نشد. در محیط Railway باید موجود باشد.",
        binaryPath: BINARY_PATH,
      },
      { status: 500 }
    );
  }

  try {
    const { stdout } = await execFileAsync(BINARY_PATH, ["x25519"], {
      cwd: XRAY_DIR,
      timeout: 10000,
    });
    // Output looks like:
    // Private key: <key>
    // Public key: <key>
    // Keys use base64url which includes _ and - characters
    const privateMatch = stdout.match(/Private\s*key:\s*([A-Za-z0-9_\-+=/]+)/i);
    const publicMatch = stdout.match(/Public\s*key:\s*([A-Za-z0-9_\-+=/]+)/i);

    if (!privateMatch || !publicMatch) {
      return NextResponse.json(
        { error: "خروجی باینری قابل parse نبود", raw: stdout },
        { status: 500 }
      );
    }

    // Also generate a random short id (8 hex chars)
    const shortId = Math.random().toString(16).substring(2, 10);

    return NextResponse.json({
      privateKey: privateMatch[1],
      publicKey: publicMatch[1],
      shortId,
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: e instanceof Error ? e.message : String(e),
      },
      { status: 500 }
    );
  }
}
