/**
 * V2Ray / Xray share link generators
 * Supports: VMess, VLESS, Trojan — all with WebSocket transport
 */

export interface ShareConfig {
  type: "vmess" | "vless" | "trojan";
  uuid: string;
  host: string; // server address
  port: number;
  path: string; // websocket path
  hostHeader?: string; // Host header (SNI for ws)
  sni?: string; // TLS SNI
  tls: "tls" | "none";
  network: "ws" | "tcp" | "grpc" | "h2";
  security?: string;
  alterId?: number; // vmess
  encryption?: string; // vless
  flow?: string; // vless xtls
  remark?: string; // display name
}

/**
 * Generate vmess:// link (base64-encoded JSON)
 * Format: vmess://<base64>
 */
export function generateVmessLink(c: ShareConfig): string {
  const json = {
    v: "2",
    ps: c.remark || `${c.host}:${c.port}`,
    add: c.host,
    port: String(c.port),
    id: c.uuid,
    aid: String(c.alterId ?? 0),
    scy: "auto",
    net: c.network,
    type: "none",
    host: c.hostHeader || c.host,
    path: c.path,
    tls: c.tls,
    sni: c.sni || c.hostHeader || c.host,
    alpn: "",
    fp: "",
  };
  const b64 = Buffer.from(JSON.stringify(json), "utf8").toString("base64");
  return `vmess://${b64}`;
}

/**
 * Generate vless:// link
 * Format: vless://uuid@host:port?params#remark
 */
export function generateVlessLink(c: ShareConfig): string {
  const params = new URLSearchParams();
  params.set("encryption", c.encryption || "none");
  params.set("type", c.network);
  if (c.network === "ws") {
    params.set("host", c.hostHeader || c.host);
    params.set("path", c.path);
  }
  if (c.tls === "tls") {
    params.set("security", "tls");
    params.set("sni", c.sni || c.hostHeader || c.host);
    params.set("fp", "chrome");
    params.set("alpn", "h2,http/1.1");
  } else {
    params.set("security", "none");
  }
  if (c.flow) params.set("flow", c.flow);

  const remark = c.remark
    ? encodeURIComponent(c.remark)
    : encodeURIComponent(`${c.host}:${c.port}`);
  return `vless://${c.uuid}@${c.host}:${c.port}?${params.toString()}#${remark}`;
}

/**
 * Generate trojan:// link
 * Format: trojan://password@host:port?params#remark
 */
export function generateTrojanLink(c: ShareConfig): string {
  const params = new URLSearchParams();
  params.set("type", c.network);
  if (c.network === "ws") {
    params.set("host", c.hostHeader || c.host);
    params.set("path", c.path);
  }
  if (c.tls === "tls") {
    params.set("security", "tls");
    params.set("sni", c.sni || c.hostHeader || c.host);
    params.set("fp", "chrome");
  }
  const remark = c.remark
    ? encodeURIComponent(c.remark)
    : encodeURIComponent(`${c.host}:${c.port}`);
  return `trojan://${c.uuid}@${c.host}:${c.port}?${params.toString()}#${remark}`;
}

/**
 * Generate the proper share link based on type
 */
export function generateShareLink(c: ShareConfig): string {
  switch (c.type) {
    case "vmess":
      return generateVmessLink(c);
    case "vless":
      return generateVlessLink(c);
    case "trojan":
      return generateTrojanLink(c);
    default:
      throw new Error(`Unsupported config type: ${c.type}`);
  }
}

/**
 * Generate an Xray/V2Ray JSON inbound configuration snippet for the given config.
 * Useful for server-side configuration export.
 */
export function generateInboundJson(c: ShareConfig): Record<string, unknown> {
  const base: Record<string, unknown> = {
    listen: "0.0.0.0",
    port: c.port,
    protocol: c.type,
    settings: {},
    streamSettings: {
      network: c.network,
      security: c.tls === "tls" ? "tls" : "none",
      tlsSettings:
        c.tls === "tls"
          ? {
              serverName: c.sni || c.hostHeader || c.host,
              alpn: ["h2", "http/1.1"],
            }
          : undefined,
      wsSettings:
        c.network === "ws"
          ? {
              path: c.path,
              headers: { Host: c.hostHeader || c.host },
            }
          : undefined,
    },
    sniffing: {
      enabled: true,
      destOverride: ["http", "tls", "quic"],
    },
  };

  if (c.type === "vmess") {
    base.settings = {
      clients: [{ id: c.uuid, alterId: c.alterId ?? 0 }],
      disableInsecureEncryption: false,
    };
  } else if (c.type === "vless") {
    base.settings = {
      clients: [{ id: c.uuid, flow: c.flow || "" }],
      decryption: "none",
    };
  } else if (c.type === "trojan") {
    base.settings = {
      clients: [{ password: c.uuid }],
    };
  }

  return base;
}

/**
 * Generate a Clash/Meta proxy YAML configuration block for the given config
 */
export function generateClashYaml(c: ShareConfig): string {
  const name = c.remark || `${c.host}:${c.port}`;
  const lines: string[] = [`- name: "${name}"`];

  if (c.type === "vmess") {
    lines.push(`  type: vmess`);
    lines.push(`  server: ${c.host}`);
    lines.push(`  port: ${c.port}`);
    lines.push(`  uuid: ${c.uuid}`);
    lines.push(`  alterId: ${c.alterId ?? 0}`);
    lines.push(`  cipher: auto`);
  } else if (c.type === "vless") {
    lines.push(`  type: vless`);
    lines.push(`  server: ${c.host}`);
    lines.push(`  port: ${c.port}`);
    lines.push(`  uuid: ${c.uuid}`);
    if (c.flow) lines.push(`  flow: ${c.flow}`);
  } else if (c.type === "trojan") {
    lines.push(`  type: trojan`);
    lines.push(`  server: ${c.host}`);
    lines.push(`  port: ${c.port}`);
    lines.push(`  password: ${c.uuid}`);
  }

  lines.push(`  network: ${c.network}`);
  if (c.network === "ws") {
    lines.push(`  ws-opts:`);
    lines.push(`    path: "${c.path}"`);
    lines.push(`    headers:`);
    lines.push(`      Host: ${c.hostHeader || c.host}`);
  }
  if (c.tls === "tls") {
    lines.push(`  tls: true`);
    lines.push(`  servername: ${c.sni || c.hostHeader || c.host}`);
    lines.push(`  skip-cert-verify: false`);
  }

  return lines.join("\n");
}

/**
 * Format bytes to human-readable string.
 * Accepts number, string (from BigInt serialization), or BigInt.
 */
export function formatBytes(bytes: number | string | bigint | null | undefined): string {
  if (bytes === null || bytes === undefined) return "۰ بایت";
  const num = typeof bytes === "bigint" ? Number(bytes) : Number(bytes);
  if (!num || isNaN(num) || num === 0) return "۰ بایت";
  const units = ["بایت", "کیلوبایت", "مگابایت", "گیگابایت", "ترابایت"];
  const i = Math.floor(Math.log(num) / Math.log(1024));
  const value = num / Math.pow(1024, i);
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${units[i]}`;
}

/**
 * Convert English digits to Persian digits
 */
export function toPersianDigits(input: string | number): string {
  const map = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/\d/g, (d) => map[Number(d)]);
}

/**
 * Format a date to Persian/Jalali-like display (using Intl with fa-IR)
 */
export function formatPersianDate(date: Date | string | null): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  try {
    return new Intl.DateTimeFormat("fa-IR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toLocaleString();
  }
}
