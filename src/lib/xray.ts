// Xray process manager — spawns Xray-core as a child process inside the container
// مدیر پردازش Xray — Xray-core را به عنوان فرآیند فرزند اجرا می‌کند
//
// On Railway: the Xray binary is at /app/xray-core/xray (baked into the image at build time).
// The config is generated from the inbounds in the DB and written to /app/xray-core/config.json.
//
// In this sandbox: the binary is not present, so we run in SIMULATED mode and
// return plausible stats. The real deployment will spawn the actual binary.

import { spawn, type ChildProcess } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { db } from "@/lib/db";

export type XrayMode = "live" | "simulated";

export interface XrayState {
  mode: XrayMode;
  running: boolean;
  pid: number | null;
  startedAt: Date | null;
  uptimeSeconds: number;
  lastError: string | null;
  configPath: string;
  binaryPath: string;
  lastLogTail: string | null;
}

// Use absolute paths — important because Next.js standalone server may have a
// different cwd than the project root.
const XRAY_DIR =
  process.env.XRAY_DIR ||
  (process.cwd().startsWith("/app") ? "/app/xray-core" : path.join(process.cwd(), "xray-core"));

const BINARY_PATH = path.join(XRAY_DIR, "xray");
const CONFIG_PATH = path.join(XRAY_DIR, "config.json");
const LOG_PATH = path.join(XRAY_DIR, "xray.log");

let childProc: ChildProcess | null = null;
let startedAt: Date | null = null;
let lastError: string | null = null;
let lastLogTail: string | null = null;
let mode: XrayMode = "simulated";

// Detect once at startup whether the binary exists
let binaryExistsCache: boolean | null = null;
async function binaryExists(): Promise<boolean> {
  if (binaryExistsCache !== null) return binaryExistsCache;
  try {
    await fs.access(BINARY_PATH);
    binaryExistsCache = true;
    mode = "live";
  } catch {
    binaryExistsCache = false;
    mode = "simulated";
  }
  return binaryExistsCache;
}

export async function getXrayState(): Promise<XrayState> {
  await binaryExists();
  const uptime = startedAt ? Math.floor((Date.now() - startedAt.getTime()) / 1000) : 0;

  // Try to read last log lines for debugging
  try {
    const log = await fs.readFile(LOG_PATH, "utf-8");
    const lines = log.trim().split("\n").filter(Boolean);
    lastLogTail = lines.slice(-15).join("\n");
  } catch {
    /* log file may not exist yet */
  }

  return {
    mode,
    running: childProc !== null && !childProc.killed,
    pid: childProc?.pid ?? null,
    startedAt,
    uptimeSeconds: uptime,
    lastError,
    configPath: CONFIG_PATH,
    binaryPath: BINARY_PATH,
    lastLogTail,
  };
}

export async function startXray(): Promise<{ ok: boolean; message: string }> {
  await binaryExists();
  if (childProc && !childProc.killed) {
    return { ok: true, message: "Xray از قبل در حال اجرا است" };
  }

  try {
    // Generate config from DB
    const config = await generateXrayConfig();
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");

    // Clear old log
    try {
      await fs.unlink(LOG_PATH);
    } catch {
      /* ignore */
    }

    if (mode === "live") {
      // Spawn actual Xray binary
      childProc = spawn(BINARY_PATH, ["run", "-c", CONFIG_PATH], {
        cwd: XRAY_DIR,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Wait briefly to see if it starts OK (catch immediate crashes)
      const startResult = await new Promise<{ ok: boolean; msg: string }>((resolve) => {
        let resolved = false;

        const logChunks: string[] = [];
        childProc!.stdout?.on("data", (d) => logChunks.push(d.toString()));
        childProc!.stderr?.on("data", (d) => logChunks.push(d.toString()));

        childProc!.on("error", (err) => {
          if (!resolved) {
            resolved = true;
            resolve({ ok: false, msg: `خطای اجرای باینری: ${err.message}` });
          }
          lastError = err.message;
          childProc = null;
        });

        childProc!.on("exit", (code, signal) => {
          if (!resolved) {
            resolved = true;
            const tail = logChunks.join("").slice(-500);
            if (code === 0 || code === null) {
              resolve({ ok: false, msg: `Xray بلافاصله بسته شد (code=${code} signal=${signal}). لاگ:\n${tail}` });
            } else {
              resolve({
                ok: false,
                msg: `Xray با کد ${code} بسته شد. لاگ:\n${tail}`,
              });
            }
          }
          if (code !== 0 && code !== null) lastError = `Xray exited with code ${code}`;
          childProc = null;
        });

        // If still alive after 1.5s, consider it started successfully
        setTimeout(() => {
          if (!resolved && childProc && !childProc.killed) {
            resolved = true;
            resolve({ ok: true, msg: `Xray با موفقیت شروع شد (PID ${childProc!.pid})` });
          }
        }, 1500);
      });

      if (startResult.ok) {
        startedAt = new Date();
        lastError = null;
      } else {
        lastError = startResult.msg;
      }
      return startResult;
    } else {
      // Simulated mode — pretend to run
      childProc = spawn("sleep", ["999999"], { stdio: "ignore" });
      startedAt = new Date();
      lastError = null;
      return {
        ok: true,
        message:
          "Xray در حالت شبیه‌سازی شروع شد (باینری در sandbox موجود نیست — در Railway واقعی کار می‌کند)",
      };
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
    return { ok: false, message: lastError };
  }
}

export async function stopXray(): Promise<{ ok: boolean; message: string }> {
  if (childProc && !childProc.killed) {
    try {
      childProc.kill("SIGTERM");
      // Force-kill after 2s if still alive
      setTimeout(() => {
        if (childProc && !childProc.killed) childProc.kill("SIGKILL");
      }, 2000);
    } catch {
      /* ignore */
    }
    childProc = null;
    startedAt = null;
    return { ok: true, message: "Xray متوقف شد" };
  }
  return { ok: true, message: "Xray از قبل متوقف بود" };
}

export async function restartXray(): Promise<{ ok: boolean; message: string }> {
  await stopXray();
  await new Promise((r) => setTimeout(r, 500));
  return startXray();
}

/**
 * Get the public-facing host for client configs.
 * Priority: XRAY_DOMAIN env > RAILWAY_STATIC_URL > RAILWAY_TCP_PROXY_DOMAIN (for reality) > DB setting > localhost
 */
export async function getEffectiveHost(): Promise<string> {
  if (process.env.XRAY_DOMAIN) return process.env.XRAY_DOMAIN;
  if (process.env.RAILWAY_STATIC_URL) return process.env.RAILWAY_STATIC_URL;
  const setting = await db.setting.findUnique({ where: { key: "domain" } });
  if (setting?.value) return setting.value;
  return "localhost";
}

/**
 * Get the Railway TCP proxy host (for Reality/raw-TCP protocols).
 * Railway exposes raw TCP via the `RAILWAY_TCP_PROXY_DOMAIN` env var when you
 * add a "TCP Proxy" port to your service.
 */
export function getRailwayTcpProxyDomain(): string | null {
  return (
    process.env.RAILWAY_TCP_PROXY_DOMAIN ||
    process.env.RAILWAY_TCP_HOST ||
    null
  );
}

export function getRailwayTcpProxyPort(): number | null {
  const p = process.env.RAILWAY_TCP_PROXY_PORT;
  if (p) return Number(p);
  return null;
}

/**
 * Generate the Xray JSON config from the inbounds in the DB.
 * All inbounds listen on 0.0.0.0 with the configured port.
 *
 * For protocols that use Railway's HTTPS/WSS reverse proxy (WS, gRPC, xHTTP):
 *   - Xray listens with security: "none" (plaintext)
 *   - Railway terminates TLS at the edge
 *   - Clients connect via WSS/HTTPS to Railway's domain on port 443
 *
 * For Reality / raw-TCP protocols:
 *   - Xray listens with security: "reality" (or "tls" for XTLS-Vision)
 *   - Railway's TCP Proxy forwards raw TCP to the container
 *   - Clients connect via the TCP proxy domain:port
 */
export async function generateXrayConfig(): Promise<Record<string, unknown>> {
  const allInbounds = await db.inbound.findMany({ where: { enabled: true } });

  // Load Reality keys from DB (set by admin via UI) — fallback to env vars
  const [privKeySetting, shortIdSetting, pubKeySetting] = await Promise.all([
    db.setting.findUnique({ where: { key: "xray_reality_private_key" } }),
    db.setting.findUnique({ where: { key: "xray_reality_short_id" } }),
    db.setting.findUnique({ where: { key: "xray_reality_public_key" } }),
  ]);
  const realityKeys = {
    privateKey:
      process.env.XRAY_REALITY_PRIVATE_KEY || privKeySetting?.value || "",
    shortId: process.env.XRAY_REALITY_SHORT_ID || shortIdSetting?.value || "",
    publicKey: process.env.XRAY_REALITY_PUBLIC_KEY || pubKeySetting?.value || "",
  };

  // Validate Reality keys — only include Reality inbounds if keys are present and valid.
  // A valid x25519 key is 43-char base64url (ends with "=").
  const realityValid =
    realityKeys.privateKey &&
    realityKeys.privateKey.length >= 40 &&
    realityKeys.shortId &&
    /^[0-9a-f]{1,16}$/i.test(realityKeys.shortId);

  // Filter out inbounds that don't work behind Railway's HTTPS reverse proxy:
  // - Reality/XTLS-Vision: need raw TCP (Railway TCP Proxy)
  // - gRPC: nginx can't proxy gRPC to Xray reliably (frame size issues)
  // - xHTTP: nginx can't proxy xHTTP (custom protocol, not standard HTTP)
  // Only WebSocket-based inbounds work behind nginx → Railway HTTPS
  const inbounds = allInbounds.filter((ib) => {
    // Only allow WebSocket transport (works perfectly behind nginx)
    if (ib.network === "ws") return true;
    // Reality needs valid keys AND Railway TCP Proxy
    if (ib.security === "reality") return Boolean(realityValid);
    // Skip gRPC, xHTTP, and TCP+TLS (don't work behind nginx)
    return false;
  });

  // If no inbounds defined yet, use sensible defaults (filtered)
  let inboundsConfig;
  if (inbounds.length === 0 && allInbounds.length === 0) {
    inboundsConfig = defaultInbounds().filter((ib) => {
      const nw = (ib.streamSettings as { network: string })?.network;
      const ss = (ib.streamSettings as { security: string })?.security;
      // Only WebSocket and (valid) Reality
      if (nw === "ws") return true;
      if (ss === "reality") return Boolean(realityValid);
      return false;
    });
  } else {
    inboundsConfig = inbounds.map((ib) => buildInboundConfig(ib, realityKeys));
  }

  return {
    log: {
      loglevel: "warning",
      access: LOG_PATH,
      error: LOG_PATH,
    },
    inbounds: inboundsConfig,
    outbounds: [
      { tag: "direct", protocol: "freedom" },
      { tag: "block", protocol: "blackhole" },
    ],
    routing: {
      rules: [
        {
          type: "field",
          ip: ["geoip:private"],
          outboundTag: "block",
        },
      ],
    },
    stats: {},
    policy: {
      levels: {
        "0": {
          statsUserUplink: true,
          statsUserDownlink: true,
        },
      },
      system: {
        statsInboundUplink: true,
        statsInboundDownlink: true,
        statsOutboundUplink: true,
        statsOutboundDownlink: true,
      },
    },
  };
}

function buildInboundConfig(
  inbound: {
    tag: string;
    protocol: string;
    port: number;
    network: string;
    security: string;
    path: string | null;
    serviceName: string | null;
    sni: string | null;
  },
  realityKeys: { privateKey: string; shortId: string } = { privateKey: "", shortId: "" }
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    tag: inbound.tag,
    listen: "0.0.0.0",
    port: inbound.port,
    protocol: inbound.protocol,
  };

  // Stream settings
  const streamSettings: Record<string, unknown> = {
    network: inbound.network,
  };

  // For WS/gRPC/xHTTP behind Railway's HTTPS reverse proxy: Xray runs plaintext
  // (Railway terminates TLS at the edge).
  if (
    inbound.security === "none" ||
    (inbound.security === "tls" &&
      (inbound.network === "ws" ||
        inbound.network === "grpc" ||
        inbound.network === "xhttp"))
  ) {
    streamSettings.security = "none";
  } else if (inbound.security === "reality") {
    // Reality needs raw TCP — Railway's TCP Proxy forwards to Xray directly.
    // Keys are loaded from DB (set by admin via UI) or env (fallback).
    streamSettings.security = "reality";
    streamSettings.realitySettings = {
      show: false,
      dest: "www.microsoft.com:443",
      xver: 0,
      serverNames: [inbound.sni || "www.microsoft.com"],
      privateKey: process.env.XRAY_REALITY_PRIVATE_KEY || realityKeys.privateKey || "",
      shortIds: [process.env.XRAY_REALITY_SHORT_ID || realityKeys.shortId || ""],
    };
  } else if (inbound.security === "tls") {
    // Raw-TCP + TLS (XTLS-Vision) — also needs Railway TCP Proxy
    streamSettings.security = "tls";
    streamSettings.tlsSettings = {
      serverName: inbound.sni || process.env.XRAY_DOMAIN || "localhost",
      certificates: [
        {
          certificateFile: process.env.XRAY_TLS_CERT_FILE || "",
          keyFile: process.env.XRAY_TLS_KEY_FILE || "",
        },
      ],
    };
  }

  if (inbound.network === "ws") {
    streamSettings.wsSettings = {
      path: inbound.path || "/",
      headers: {},
    };
  } else if (inbound.network === "grpc") {
    streamSettings.grpcSettings = {
      serviceName: inbound.serviceName || inbound.tag,
      multiMode: true,
    };
  } else if (inbound.network === "xhttp") {
    streamSettings.xhttpSettings = {
      path: inbound.path || "/xhttp",
      mode: "auto",
    };
  } else if (inbound.network === "tcp") {
    streamSettings.tcpSettings = {
      header: { type: "none" },
    };
  }

  base.streamSettings = streamSettings;

  // Protocol-specific settings
  if (inbound.protocol === "vless") {
    base.settings = {
      decryption: "none",
      clients: [],
    };
  } else if (inbound.protocol === "vmess") {
    base.settings = { clients: [] };
  } else if (inbound.protocol === "trojan") {
    base.settings = { clients: [] };
  }

  base.sniffing = {
    enabled: true,
    destOverride: ["http", "tls", "quic"],
  };

  return base;
}

/**
 * Default inbound set — 8 protocols designed to work behind Railway's
 * HTTPS/WSS reverse proxy (or TCP Proxy for Reality).
 */
function defaultInbounds() {
  const PORT = Number(process.env.XRAY_PORT || 8443);
  const REALITY_PORT = Number(process.env.RAILWAY_TCP_APPLICATION_PORT || PORT + 1);
  return [
    {
      tag: "vless-ws",
      listen: "0.0.0.0",
      port: PORT,
      protocol: "vless",
      settings: { decryption: "none", clients: [] },
      streamSettings: {
        network: "ws",
        security: "none",
        wsSettings: { path: "/vless-ws" },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    },
    {
      tag: "vless-grpc",
      listen: "0.0.0.0",
      port: PORT,
      protocol: "vless",
      settings: { decryption: "none", clients: [] },
      streamSettings: {
        network: "grpc",
        security: "none",
        grpcSettings: { serviceName: "vless-grpc", multiMode: true },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    },
    {
      tag: "vmess-ws",
      listen: "0.0.0.0",
      port: PORT,
      protocol: "vmess",
      settings: { clients: [] },
      streamSettings: {
        network: "ws",
        security: "none",
        wsSettings: { path: "/vmess-ws" },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    },
    {
      tag: "trojan-ws",
      listen: "0.0.0.0",
      port: PORT,
      protocol: "trojan",
      settings: { clients: [] },
      streamSettings: {
        network: "ws",
        security: "none",
        wsSettings: { path: "/trojan-ws" },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    },
    {
      tag: "trojan-grpc",
      listen: "0.0.0.0",
      port: PORT,
      protocol: "trojan",
      settings: { clients: [] },
      streamSettings: {
        network: "grpc",
        security: "none",
        grpcSettings: { serviceName: "trojan-grpc", multiMode: true },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    },
    {
      tag: "vless-reality",
      listen: "0.0.0.0",
      port: REALITY_PORT,
      protocol: "vless",
      settings: { decryption: "none", clients: [] },
      streamSettings: {
        network: "tcp",
        security: "reality",
        realitySettings: {
          show: false,
          dest: "www.microsoft.com:443",
          xver: 0,
          serverNames: ["www.microsoft.com"],
          privateKey: process.env.XRAY_REALITY_PRIVATE_KEY || "",
          shortIds: [process.env.XRAY_REALITY_SHORT_ID || ""],
        },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    },
    {
      tag: "vless-xhttp",
      listen: "0.0.0.0",
      port: PORT,
      protocol: "vless",
      settings: { decryption: "none", clients: [] },
      streamSettings: {
        network: "xhttp",
        security: "none",
        xhttpSettings: { path: "/vless-xhttp", mode: "auto" },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    },
    {
      tag: "vless-tcp-xtls",
      listen: "0.0.0.0",
      port: REALITY_PORT,
      protocol: "vless",
      settings: { decryption: "none", clients: [] },
      streamSettings: {
        network: "tcp",
        security: "tls",
        tlsSettings: {
          serverName: process.env.XRAY_DOMAIN || "localhost",
          certificates: [],
        },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    },
  ];
}

/**
 * Inject all enabled VPN users into the inbound configs.
 * Called whenever a user is created / updated / deleted.
 */
export async function regenerateXrayConfigWithUsers(): Promise<void> {
  try {
    const config = await generateXrayConfig();
    const users = await db.vpnUser.findMany({ where: { enabled: true, suspended: false } });

    const inbounds = (config.inbounds as Array<Record<string, unknown>>).map((inb) => {
      const tag = inb.tag as string;
      const protocol = inb.protocol as string;
      const settings = (inb.settings ?? {}) as Record<string, unknown>;

      if (protocol === "vless") {
        settings.clients = users.map((u) => ({
          id: u.uuid,
          email: `${u.username}@cyberx`,
          flow: tag.includes("reality") || tag.includes("xtls") ? "xtls-rprx-vision" : "",
          limitIp: u.maxDevices,
          totalGB: u.dataLimitBytes > 0 ? Number(u.dataLimitBytes) / 1e9 : 0,
          expiryTime: u.expireAt ? new Date(u.expireAt).getTime() : 0,
          enable: true,
        }));
      } else if (protocol === "vmess") {
        settings.clients = users.map((u) => ({
          id: u.uuid,
          email: `${u.username}@cyberx`,
          alterId: 0,
          limitIp: u.maxDevices,
          totalGB: u.dataLimitBytes > 0 ? Number(u.dataLimitBytes) / 1e9 : 0,
          expiryTime: u.expireAt ? new Date(u.expireAt).getTime() : 0,
          enable: true,
        }));
      } else if (protocol === "trojan") {
        settings.clients = users.map((u) => ({
          password: u.uuid,
          email: `${u.username}@cyberx`,
          limitIp: u.maxDevices,
          totalGB: u.dataLimitBytes > 0 ? Number(u.dataLimitBytes) / 1e9 : 0,
          expiryTime: u.expireAt ? new Date(u.expireAt).getTime() : 0,
          enable: true,
        }));
      }

      inb.settings = settings;
      return inb;
    });

    config.inbounds = inbounds;
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  }
}
