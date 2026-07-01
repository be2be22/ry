// Xray process manager — spawns Xray-core as a child process inside the container
// مدیر پردازش Xray — Xray-core را به عنوان فرآیند فرزند اجرا می‌کند
//
// On Railway: the Xray binary is downloaded at Docker build time and placed at
// /home/z/my-project/xray-core/xray. The config is generated from the inbounds
// in the database and written to /home/z/my-project/xray-core/config.json.
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
}

const BINARY_PATH = path.join(process.cwd(), "xray-core", "xray");
const CONFIG_PATH = path.join(process.cwd(), "xray-core", "config.json");
const LOG_PATH = path.join(process.cwd(), "xray-core", "xray.log");

let childProc: ChildProcess | null = null;
let startedAt: Date | null = null;
let lastError: string | null = null;
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
  return {
    mode,
    running: childProc !== null && !childProc.killed,
    pid: childProc?.pid ?? null,
    startedAt,
    uptimeSeconds: uptime,
    lastError,
    configPath: CONFIG_PATH,
    binaryPath: BINARY_PATH,
  };
}

export async function startXray(): Promise<{ ok: boolean; message: string }> {
  await binaryExists();
  if (childProc && !childProc.killed) {
    return { ok: true, message: "Xray is already running" };
  }

  try {
    // Generate config from DB
    const config = await generateXrayConfig();
    await fs.mkdir(path.dirname(CONFIG_PATH), { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");

    if (mode === "live") {
      // Spawn actual Xray binary
      childProc = spawn(BINARY_PATH, ["run", "-c", CONFIG_PATH], {
        cwd: path.dirname(BINARY_PATH),
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      const logStream = await fs.open(LOG_PATH, "a");
      childProc.stdout?.on("data", (d) => logStream.write(d));
      childProc.stderr?.on("data", (d) => logStream.write(d));

      childProc.on("error", (err) => {
        lastError = err.message;
        childProc = null;
      });
      childProc.on("exit", (code) => {
        if (code !== 0) lastError = `Xray exited with code ${code}`;
        childProc = null;
      });

      startedAt = new Date();
      lastError = null;
      return { ok: true, message: `Xray started (PID ${childProc.pid})` };
    } else {
      // Simulated mode — pretend to run
      childProc = spawn("sleep", ["999999"], { stdio: "ignore" });
      startedAt = new Date();
      lastError = null;
      return {
        ok: true,
        message: "Xray started in SIMULATED mode (binary not available in sandbox)",
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
    return { ok: true, message: "Xray stopped" };
  }
  return { ok: true, message: "Xray was not running" };
}

export async function restartXray(): Promise<{ ok: boolean; message: string }> {
  await stopXray();
  await new Promise((r) => setTimeout(r, 500));
  return startXray();
}

/**
 * Generate the Xray JSON config from the inbounds in the DB.
 * All inbounds listen on 0.0.0.0 with the configured port, but since Railway
 * only exposes HTTPS/WSS, the actual TLS termination happens at Railway's
 * reverse proxy. For protocols that need TLS, we configure Xray to listen
 * with security "none" on the path/stream, and rely on Railway's TLS.
 *
 * For WebSocket / gRPC / xHTTP transports, Xray can run plaintext behind
 * Railway's TLS-terminating reverse proxy — clients connect via WSS/HTTPS
 * to Railway's domain, which forwards to Xray's plaintext listener.
 */
export async function generateXrayConfig(): Promise<Record<string, unknown>> {
  const inbounds = await db.inbound.findMany({ where: { enabled: true } });

  // If no inbounds defined yet, use sensible defaults
  const inboundsConfig = inbounds.length
    ? inbounds.map(buildInboundConfig)
    : defaultInbounds();

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

function buildInboundConfig(inbound: {
  tag: string;
  protocol: string;
  port: number;
  network: string;
  security: string;
  path: string | null;
  serviceName: string | null;
  sni: string | null;
}): Record<string, unknown> {
  const base: Record<string, unknown> = {
    tag: inbound.tag,
    listen: "0.0.0.0",
    port: inbound.port,
    protocol: inbound.protocol,
  };

  // Stream settings — Railway terminates TLS, so Xray runs plaintext
  const streamSettings: Record<string, unknown> = {
    network: inbound.network,
    security: "none", // TLS handled by Railway reverse proxy
  };

  if (inbound.network === "ws") {
    streamSettings.wsSettings = {
      path: inbound.path || "/",
      headers: {},
    };
  } else if (inbound.network === "grpc") {
    streamSettings.grpcSettings = {
      serviceName: inbound.serviceName || inbound.tag,
      multiMode: false,
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

  // For Reality (used when not behind Railway TLS) — kept as a separate inbound type
  if (inbound.security === "reality") {
    streamSettings.security = "reality";
    streamSettings.realitySettings = {
      show: false,
      dest: "www.microsoft.com:443",
      xver: 0,
      serverNames: ["www.microsoft.com"],
      privateKey: "", // generated at install time
      shortIds: [""],
    };
  }

  base.streamSettings = streamSettings;

  // Protocol-specific settings
  if (inbound.protocol === "vless") {
    base.settings = {
      decryption: "none",
      clients: [], // populated by user data at config-write time
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
 * HTTPS/WSS reverse proxy. All listeners run plaintext (security: none)
 * because Railway terminates TLS at the edge.
 *
 * Ports chosen are arbitrary; in Railway you'll map each port via the
 * `railway.json` configuration OR use a single port with path-based
 * routing for the WS / xHTTP variants. For simplicity and to avoid
 * burning multiple ports, we use ONE port per protocol-family with
 * different paths/services.
 */
function defaultInbounds() {
  const PORT = Number(process.env.XRAY_PORT || 8443);
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
        grpcSettings: { serviceName: "vless-grpc", multiMode: false },
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
        grpcSettings: { serviceName: "trojan-grpc", multiMode: false },
      },
      sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
    },
    {
      tag: "vless-reality",
      listen: "0.0.0.0",
      port: PORT + 1,
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
          privateKey: "",
          shortIds: [""],
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
      port: PORT + 2,
      protocol: "vless",
      settings: { decryption: "none", clients: [] },
      streamSettings: {
        network: "tcp",
        security: "tls",
        tlsSettings: {
          serverName: process.env.XRAY_DOMAIN || "localhost",
          certificates: [], // auto from Railway
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
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  } catch (e) {
    lastError = e instanceof Error ? e.message : String(e);
  }
}
