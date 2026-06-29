/**
 * Xray process manager (local mode)
 *
 * Manages the Xray-core binary as a child process spawned from the Next.js
 * server. The panel owns the entire lifecycle:
 *   - start()   : write config.json, spawn xray, persist PID
 *   - stop()    : kill the running process
 *   - restart() : stop + start (used after config regeneration)
 *   - status()  : is the process alive? what port? how many clients?
 *   - reload()  : regenerate config + restart
 *
 * The Xray binary lives at <project>/bin/xray and its config / logs / PID
 * file all live under <project>/xray-data/.
 */

import { spawn, type ChildProcess } from "child_process";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import {
  XRAY_BIN,
  XRAY_CONFIG_PATH,
  XRAY_LOG_PATH,
  XRAY_PID_PATH,
  XRAY_PUBLIC_HOST,
  XRAY_PUBLIC_PORT,
  XRAY_TLS_ENABLED,
  writeXrayConfig,
} from "@/lib/xray-config";

// In-memory handle to the running process (so we don't rely solely on PID)
let xrayProcess: ChildProcess | null = null;

interface XrayStatus {
  running: boolean;
  pid?: number;
  startedAt?: string;
  publicHost: string;
  publicPort: number;
  tls: boolean;
  configPath: string;
  logPath: string;
  clientCount?: number;
  inboundCount?: number;
  error?: string;
}

/**
 * Read PID from the PID file (if any).
 */
function readPidFile(): number | null {
  try {
    if (!fs.existsSync(XRAY_PID_PATH)) return null;
    const content = fs.readFileSync(XRAY_PID_PATH, "utf8").trim();
    const pid = Number(content);
    if (!pid || isNaN(pid)) return null;
    return pid;
  } catch {
    return null;
  }
}

/**
 * Check whether a process with the given PID is alive.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0); // signal 0 = existence check
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the start time of a running process (best-effort, used for status display).
 */
function getProcessStartTime(pid: number): string | undefined {
  try {
    const statPath = `/proc/${pid}/stat`;
    if (fs.existsSync(statPath)) {
      const stat = fs.readFileSync(statPath, "utf8").split(" ");
      const starttime = Number(stat[21]) * 1000; // clock ticks → ms
      // Adjust by system boot time (we'll approximate using current time minus uptime)
      const uptimePath = `/proc/${pid}/io`;
      if (fs.existsSync(uptimePath)) {
        // Simple fallback: use the file mtime of /proc/<pid>
        const mtime = fs.statSync(`/proc/${pid}`).mtime;
        return mtime.toISOString();
      }
      return new Date(starttime).toISOString();
    }
  } catch {
    // ignore
  }
  return undefined;
}

/**
 * Get current status of the local Xray process.
 */
export async function getXrayStatus(): Promise<XrayStatus> {
  const base: XrayStatus = {
    running: false,
    publicHost: XRAY_PUBLIC_HOST,
    publicPort: XRAY_PUBLIC_PORT,
    tls: XRAY_TLS_ENABLED,
    configPath: XRAY_CONFIG_PATH,
    logPath: XRAY_LOG_PATH,
  };

  // Check in-memory handle first
  if (xrayProcess && !xrayProcess.killed) {
    const pid = xrayProcess.pid;
    if (pid && isProcessAlive(pid)) {
      base.running = true;
      base.pid = pid;
      base.startedAt = getProcessStartTime(pid);
    }
  }

  // Fallback: check PID file
  if (!base.running) {
    const pid = readPidFile();
    if (pid && isProcessAlive(pid)) {
      base.running = true;
      base.pid = pid;
      base.startedAt = getProcessStartTime(pid);
    } else if (pid) {
      // Stale PID file — clean it up
      try { fs.unlinkSync(XRAY_PID_PATH); } catch {}
    }
  }

  // If running, count active clients
  if (base.running) {
    try {
      const activeCount = await db.config.count({ where: { status: "active", xrayActive: true } });
      base.clientCount = activeCount;
      const activeByType = await db.config.groupBy({
        by: ["type"],
        where: { status: "active", xrayActive: true },
        _count: { _all: true },
      });
      base.inboundCount = activeByType.length;
    } catch {
      // ignore — DB may not be ready yet
    }
  }

  return base;
}

/**
 * Start the Xray process. Regenerates the config first so it always
 * reflects the latest DB state.
 */
export async function startXray(): Promise<{ ok: boolean; error?: string; pid?: number }> {
  // Already running?
  const status = await getXrayStatus();
  if (status.running) {
    return { ok: false, error: "Xray از قبل در حال اجراست", pid: status.pid };
  }

  // Make sure binary exists
  if (!fs.existsSync(XRAY_BIN)) {
    return { ok: false, error: `فایل اجرایی Xray یافت نشد: ${XRAY_BIN}` };
  }

  // Make sure binary is executable
  try {
    fs.chmodSync(XRAY_BIN, 0o755);
  } catch {}

  // Regenerate config
  let configInfo;
  try {
    configInfo = await writeXrayConfig();
  } catch (err: any) {
    return { ok: false, error: `خطا در تولید config: ${err?.message || err}` };
  }

  // Make sure data dir exists
  const dataDir = path.dirname(XRAY_CONFIG_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Open log file for stdout/stderr
  const logFd = fs.openSync(XRAY_LOG_PATH, "w");

  // Spawn xray
  try {
    xrayProcess = spawn(XRAY_BIN, ["run", "-c", XRAY_CONFIG_PATH], {
      cwd: dataDir,
      stdio: ["ignore", logFd, logFd],
      detached: false,
      env: {
        ...process.env,
        XRAY_LOCATION_ASSET: path.join(process.cwd(), "xray-data"),
      },
    });

    // Wait for the 'spawn' event so we have a PID, or capture the error
    const spawnResult = await new Promise<{ pid: number | null; error?: Error }>((resolve) => {
      const timeout = setTimeout(() => {
        // If spawn didn't error within 2s, treat it as success
        resolve({ pid: xrayProcess?.pid ?? null });
      }, 2000);

      xrayProcess!.on("spawn", () => {
        clearTimeout(timeout);
        resolve({ pid: xrayProcess?.pid ?? null });
      });

      xrayProcess!.on("error", (err) => {
        clearTimeout(timeout);
        resolve({ pid: null, error: err });
      });
    });

    if (spawnResult.error || !spawnResult.pid) {
      const logTail = readLogTail(30);
      return {
        ok: false,
        error: `spawning Xray ناموفق بود${spawnResult.error ? `: ${spawnResult.error.message}` : ""}. لاگ:\n${logTail}`,
      };
    }

    const pid = spawnResult.pid;

    // Persist PID
    fs.writeFileSync(XRAY_PID_PATH, String(pid), "utf8");

    // Handle process exit
    xrayProcess.on("exit", (code, signal) => {
      console.log(`[xray] process exited: code=${code} signal=${signal}`);
      xrayProcess = null;
      try { fs.unlinkSync(XRAY_PID_PATH); } catch {}
    });

    xrayProcess.on("error", (err) => {
      console.error(`[xray] process error:`, err);
      xrayProcess = null;
      try { fs.unlinkSync(XRAY_PID_PATH); } catch {}
    });

    // Give it a moment to start (or fail fast)
    await new Promise((resolve) => setTimeout(resolve, 800));

    // Verify still alive
    if (!isProcessAlive(pid)) {
      const logTail = readLogTail(30);
      return {
        ok: false,
        error: `Xray بلافاصله بسته شد. لاگ:\n${logTail}`,
      };
    }

    return {
      ok: true,
      pid,
    };
  } catch (err: any) {
    return { ok: false, error: `خطا در اجرای Xray: ${err?.message || err}` };
  }
}

/**
 * Stop the running Xray process.
 */
export async function stopXray(): Promise<{ ok: boolean; error?: string }> {
  // Try in-memory handle first
  if (xrayProcess && !xrayProcess.killed) {
    try {
      const killed = xrayProcess.kill("SIGTERM");
      if (killed) {
        // Wait a moment for graceful shutdown
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (xrayProcess && !xrayProcess.killed) {
          xrayProcess.kill("SIGKILL");
        }
      }
    } catch (err: any) {
      return { ok: false, error: `خطا در توقف Xray: ${err?.message || err}` };
    }
    xrayProcess = null;
    try { fs.unlinkSync(XRAY_PID_PATH); } catch {}
    return { ok: true };
  }

  // Fallback: kill by PID from file
  const pid = readPidFile();
  if (pid) {
    try {
      process.kill(pid, "SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (isProcessAlive(pid)) {
        process.kill(pid, "SIGKILL");
      }
    } catch (err: any) {
      return { ok: false, error: `خطا در kill PID ${pid}: ${err?.message || err}` };
    }
    try { fs.unlinkSync(XRAY_PID_PATH); } catch {}
    return { ok: true };
  }

  return { ok: false, error: "هیچ پردازش Xray در حال اجرا نیست" };
}

/**
 * Restart Xray — regenerates config and re-spawns the process.
 */
export async function restartXray(): Promise<{ ok: boolean; error?: string; pid?: number }> {
  await stopXray();
  await new Promise((resolve) => setTimeout(resolve, 300));
  return startXray();
}

/**
 * Reload Xray config without stopping the process.
 * Sends SIGHUP which causes Xray to re-read config.json.
 */
export async function reloadXrayConfig(): Promise<{ ok: boolean; error?: string }> {
  // Always regenerate config first
  try {
    await writeXrayConfig();
  } catch (err: any) {
    return { ok: false, error: `خطا در تولید config: ${err?.message || err}` };
  }

  // If process is running, send SIGHUP
  const pid = xrayProcess?.pid || readPidFile();
  if (pid && isProcessAlive(pid)) {
    try {
      process.kill(pid, "SIGHUP");
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: `خطا در SIGHUP: ${err?.message || err}` };
    }
  }

  // Not running — start it
  const r = await startXray();
  return { ok: r.ok, error: r.error };
}

/**
 * Read the last N lines of the Xray log file.
 */
export function readLogTail(lines = 50): string {
  try {
    if (!fs.existsSync(XRAY_LOG_PATH)) return "(log file not found)";
    const content = fs.readFileSync(XRAY_LOG_PATH, "utf8");
    const allLines = content.split("\n");
    return allLines.slice(-lines).join("\n");
  } catch (err: any) {
    return `(error reading log: ${err?.message || err})`;
  }
}

/**
 * Read the full log file (capped at 100KB for safety).
 */
export function readFullLog(): string {
  try {
    if (!fs.existsSync(XRAY_LOG_PATH)) return "(log file not found)";
    const stat = fs.statSync(XRAY_LOG_PATH);
    const size = Math.min(stat.size, 100 * 1024);
    const fd = fs.openSync(XRAY_LOG_PATH, "r");
    const buffer = Buffer.alloc(size);
    fs.readSync(fd, buffer, 0, size, Math.max(0, stat.size - size));
    fs.closeSync(fd);
    return buffer.toString("utf8");
  } catch (err: any) {
    return `(error reading log: ${err?.message || err})`;
  }
}
