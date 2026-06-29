/**
 * Xray config.json generator (local mode)
 *
 * Builds a complete Xray-core config.json based on the configs stored in
 * our database. The panel owns the config — every add/update/delete of a
 * config regenerates this file and reloads Xray.
 *
 * Architecture:
 *   - One inbound per protocol type (vmess / vless / trojan), all on port 443
 *     with WebSocket + TLS. This is the recommended pattern from Xray docs:
 *     a single inbound with multiple "clients" entries, each identified by
 *     its UUID (vmess/vless) or password (trojan).
 *   - An API inbound on 127.0.0.1:15490 (dokodemo-door) for runtime stats.
 *   - Stats enabled so we can query per-user uplink/downlink bytes.
 *
 * Note: For TLS to actually work, the host needs valid certificates. In
 * production this means Caddy (or certbot) fronting Xray on 443. For local
 * testing the panel can run Xray without TLS on a different port.
 */

import path from "path";
import fs from "fs";
import { db } from "@/lib/db";

export const XRAY_BIN = path.join(process.cwd(), "bin", "xray");
export const XRAY_DATA_DIR = path.join(process.cwd(), "xray-data");
export const XRAY_CONFIG_DIR = path.join(process.cwd(), "xray-data");
export const XRAY_CONFIG_PATH = path.join(XRAY_CONFIG_DIR, "config.json");
export const XRAY_LOG_PATH = path.join(XRAY_CONFIG_DIR, "xray.log");
export const XRAY_ERROR_LOG_PATH = path.join(XRAY_CONFIG_DIR, "xray-error.log");
export const XRAY_ACCESS_LOG_PATH = path.join(XRAY_CONFIG_DIR, "xray-access.log");
export const XRAY_PID_PATH = path.join(XRAY_CONFIG_DIR, "xray.pid");

// Runtime API (dokodemo-door) — used for QueryStats / SysStats
export const XRAY_API_PORT = 15490;
export const XRAY_API_TAG = "api";

// Public-facing port. In production this should be 443; for local dev we
// can use a higher port to avoid needing root.
export const XRAY_PUBLIC_PORT = Number(process.env.XRAY_PUBLIC_PORT || 8443);

// The hostname clients should connect to (used for SNI / Host header).
export const XRAY_PUBLIC_HOST =
  process.env.XRAY_PUBLIC_HOST || "fastapicloud.com";

// Whether TLS is enabled in the generated config.
export const XRAY_TLS_ENABLED = process.env.XRAY_TLS_ENABLED !== "false";

// Path to TLS cert files (if TLS is enabled).
export const XRAY_CERT_PATH =
  process.env.XRAY_CERT_PATH || path.join(XRAY_CONFIG_DIR, "cert.pem");
export const XRAY_KEY_PATH =
  process.env.XRAY_KEY_PATH || path.join(XRAY_CONFIG_DIR, "key.pem");

interface BuildOptions {
  /** Override the public host (otherwise uses env / default). */
  host?: string;
  /** Override the public port (otherwise uses env / default). */
  port?: number;
  /** Override TLS enabled flag. */
  tls?: boolean;
}

/**
 * Build the complete Xray config object from the current database state.
 */
export async function buildXrayConfig(opts: BuildOptions = {}): Promise<Record<string, unknown>> {
  const host = opts.host || XRAY_PUBLIC_HOST;
  const port = opts.port || XRAY_PUBLIC_PORT;
  const tls = opts.tls ?? XRAY_TLS_ENABLED;

  // Group active configs by protocol type
  const activeConfigs = await db.config.findMany({
    where: { status: "active" },
    include: { server: true },
  });

  const byType: Record<string, typeof activeConfigs> = {
    vmess: [],
    vless: [],
    trojan: [],
  };
  for (const c of activeConfigs) {
    if (!byType[c.type]) byType[c.type] = [];
    byType[c.type].push(c);
  }

  // Build inbounds — one per protocol type that has at least one client
  const inbounds: Record<string, unknown>[] = [];

  // 1. API inbound (for stats queries)
  inbounds.push({
    tag: XRAY_API_TAG,
    listen: "127.0.0.1",
    port: XRAY_API_PORT,
    protocol: "dokodemo-door",
    settings: {
      address: "127.0.0.1",
    },
  });

  // 2. VMess WS inbound (if any vmess configs exist)
  if (byType.vmess.length > 0) {
    inbounds.push({
      tag: "vmess-ws",
      listen: "0.0.0.0",
      port,
      protocol: "vmess",
      settings: {
        clients: byType.vmess.map((c) => ({
          id: c.uuid,
          alterId: c.alterId || 0,
          level: 0,
          email: c.uuid, // we use uuid as email for stats identification
        })),
        decryption: "none",
      },
      streamSettings: buildStreamSettings(host, "/", tls),
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic"],
      },
    });
  }

  // 3. VLESS WS inbound
  if (byType.vless.length > 0) {
    inbounds.push({
      tag: "vless-ws",
      listen: "0.0.0.0",
      port,
      protocol: "vless",
      settings: {
        clients: byType.vless.map((c) => ({
          id: c.uuid,
          flow: c.flow || "",
          level: 0,
          email: c.uuid,
        })),
        decryption: "none",
      },
      streamSettings: buildStreamSettings(host, "/vless", tls),
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic"],
      },
    });
  }

  // 4. Trojan WS inbound
  if (byType.trojan.length > 0) {
    inbounds.push({
      tag: "trojan-ws",
      listen: "0.0.0.0",
      port,
      protocol: "trojan",
      settings: {
        clients: byType.trojan.map((c) => ({
          password: c.uuid,
          level: 0,
          email: c.uuid,
        })),
      },
      streamSettings: buildStreamSettings(host, "/trojan", tls),
      sniffing: {
        enabled: true,
        destOverride: ["http", "tls", "quic"],
      },
    });
  }

  const config: Record<string, unknown> = {
    log: {
      loglevel: "warning",
      access: XRAY_ACCESS_LOG_PATH,
      error: XRAY_ERROR_LOG_PATH,
    },
    api: {
      tag: "api",
      services: ["HandlerService", "StatsService", "LoggerService"],
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
      },
    },
    routing: {
      domainStrategy: "AsIs",
      rules: [
        // Block private/local access from public inbounds
        {
          type: "field",
          ip: ["geoip:private"],
          outboundTag: "block",
        },
      ],
    },
    inbounds,
    outbounds: [
      {
        tag: "direct",
        protocol: "freedom",
      },
      {
        tag: "block",
        protocol: "blackhole",
      },
    ],
  };

  return config;
}

/**
 * Build streamSettings for a WS+TLS inbound.
 */
function buildStreamSettings(host: string, wsPath: string, tls: boolean): Record<string, unknown> {
  const stream: Record<string, unknown> = {
    network: "ws",
    security: tls ? "tls" : "none",
  };
  if (tls) {
    stream.tlsSettings = {
      serverName: host,
      minVersion: "1.2",
      certificates: [
        {
          certificateFile: XRAY_CERT_PATH,
          keyFile: XRAY_KEY_PATH,
        },
      ],
    };
  }
  stream.wsSettings = {
    path: wsPath,
    headers: {
      Host: host,
    },
  };
  return stream;
}

/**
 * Generate the config, write it to disk, and return the path.
 */
export async function writeXrayConfig(opts: BuildOptions = {}): Promise<{
  path: string;
  config: Record<string, unknown>;
  inboundCount: number;
  clientCount: number;
}> {
  const config = await buildXrayConfig(opts);
  const inboundCount = (config.inbounds as Record<string, unknown>[]).length - 1; // exclude API
  let clientCount = 0;
  for (const ib of config.inbounds as Record<string, unknown>[]) {
    if (ib.tag === XRAY_API_TAG) continue;
    const settings = ib.settings as { clients?: unknown[] };
    if (settings?.clients) clientCount += settings.clients.length;
  }

  // Ensure data dir exists
  if (!fs.existsSync(XRAY_CONFIG_DIR)) {
    fs.mkdirSync(XRAY_CONFIG_DIR, { recursive: true });
  }

  fs.writeFileSync(XRAY_CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");

  return {
    path: XRAY_CONFIG_PATH,
    config,
    inboundCount,
    clientCount,
  };
}

/**
 * Mark a config as active (or inactive) in the running Xray instance.
 * In our local model, we just update the DB and regenerate the config —
 * the caller is responsible for reloading Xray afterwards.
 */
export async function setConfigXrayActive(configId: string, active: boolean): Promise<void> {
  await db.config.update({
    where: { id: configId },
    data: {
      xrayActive: active,
      xrayAddedAt: active ? new Date() : null,
    },
  });
}
