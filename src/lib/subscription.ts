// Subscription link generator — produces 8 protocol URIs per user
// تولید لینک اشتراک — ۸ پروتکل برای هر کاربر
//
// Each user gets the following 8 configs:
//   1. VLESS + WS + TLS        (via Railway HTTPS reverse proxy — port 443)
//   2. VLESS + gRPC + TLS      (via Railway HTTPS reverse proxy — port 443)
//   3. VMess + WS + TLS        (via Railway HTTPS reverse proxy — port 443)
//   4. Trojan + WS + TLS       (via Railway HTTPS reverse proxy — port 443)
//   5. Trojan + gRPC + TLS     (via Railway HTTPS reverse proxy — port 443)
//   6. VLESS + XTLS-Reality    (via Railway TCP Proxy — needs RAILWAY_TCP_PROXY_*)
//   7. VLESS + xHTTP + TLS     (via Railway HTTPS reverse proxy — port 443)
//   8. VLESS + TCP + XTLS-Vision (via Railway TCP Proxy)
//
// IMPORTANT: Path values like "/vless-ws" must NOT be URL-encoded in the URI.
// URLSearchParams.toString() encodes "/" as "%2F" which breaks the path on
// the server side (returns 404). We build the query string manually instead.

import { db } from "@/lib/db";
import {
  getRailwayTcpProxyDomain,
  getRailwayTcpProxyPort,
} from "@/lib/xray";

export interface ProtocolConfig {
  index: number;
  name: string;
  protocol: "vless" | "vmess" | "trojan";
  transport: "ws" | "grpc" | "xhttp" | "tcp" | "reality";
  security: "tls" | "reality" | "none";
  uri: string;
  tag: string;
  color: string;
  remark: string;
  needsTcpProxy: boolean;
  warning?: string;
}

/**
 * Generate all 8 config URIs for a VPN user.
 */
export async function generateUserConfigs(
  userUuid: string,
  username: string,
  host: string
): Promise<ProtocolConfig[]> {
  // Railway TCP Proxy info — needed for Reality and raw-TCP protocols
  const tcpHost = getRailwayTcpProxyDomain();
  const tcpPort = getRailwayTcpProxyPort();

  // Reality key info — validate length and format
  const realityPubKeyRaw =
    process.env.XRAY_REALITY_PUBLIC_KEY ||
    (await db.setting.findUnique({ where: { key: "xray_reality_public_key" } }))?.value ||
    "";
  const realityShortIdRaw =
    process.env.XRAY_REALITY_SHORT_ID ||
    (await db.setting.findUnique({ where: { key: "xray_reality_short_id" } }))?.value ||
    "";
  const realityPubKey =
    realityPubKeyRaw && realityPubKeyRaw.length >= 40 ? realityPubKeyRaw : "";
  const realityShortId =
    realityShortIdRaw && /^[0-9a-f]{1,16}$/i.test(realityShortIdRaw)
      ? realityShortIdRaw
      : "";
  const realitySni = "www.microsoft.com";

  const configs: ProtocolConfig[] = [
    {
      index: 1,
      name: "VLESS + WS + TLS",
      protocol: "vless",
      transport: "ws",
      security: "tls",
      tag: "vless-ws",
      color: "cyan",
      remark: `${username}-vless-ws`,
      needsTcpProxy: false,
      uri: buildVlessWs(userUuid, host, host, "/vless-ws", 443),
    },
    {
      index: 2,
      name: "VLESS + gRPC + TLS",
      protocol: "vless",
      transport: "grpc",
      security: "tls",
      tag: "vless-grpc",
      color: "yellow",
      remark: `${username}-vless-grpc`,
      needsTcpProxy: false,
      warning:
        "gRPC روی Railway پشتیبانی نمی‌شود — nginx نمی‌تواند ترافیک gRPC را به Xray فوروارد کند. از کانفیگ‌های WebSocket استفاده کنید.",
      uri: "", // Empty — config won't be generated
    },
    {
      index: 3,
      name: "VMess + WS + TLS",
      protocol: "vmess",
      transport: "ws",
      security: "tls",
      tag: "vmess-ws",
      color: "purple",
      remark: `${username}-vmess-ws`,
      needsTcpProxy: false,
      uri: buildVmessWs(userUuid, host, host, "/vmess-ws", 443),
    },
    {
      index: 4,
      name: "Trojan + WS + TLS",
      protocol: "trojan",
      transport: "ws",
      security: "tls",
      tag: "trojan-ws",
      color: "magenta",
      remark: `${username}-trojan-ws`,
      needsTcpProxy: false,
      uri: buildTrojanWs(userUuid, host, host, "/trojan-ws", 443),
    },
    {
      index: 5,
      name: "Trojan + gRPC + TLS",
      protocol: "trojan",
      transport: "grpc",
      security: "tls",
      tag: "trojan-grpc",
      color: "yellow",
      remark: `${username}-trojan-grpc`,
      needsTcpProxy: false,
      warning:
        "gRPC روی Railway پشتیبانی نمی‌شود — از کانفیگ‌های WebSocket استفاده کنید.",
      uri: "",
    },
    {
      index: 6,
      name: "VLESS + XTLS-Reality",
      protocol: "vless",
      transport: "tcp",
      security: "reality",
      tag: "vless-reality",
      color: "green",
      remark: `${username}-vless-reality`,
      needsTcpProxy: true,
      warning:
        !tcpHost || !tcpPort
          ? "برای Reality باید Railway TCP Proxy فعال باشد (متغیرهای RAILWAY_TCP_PROXY_DOMAIN/PORT)"
          : !realityPubKey
          ? "برای Reality باید کلید عمومی Reality را در تنظیمات وارد کنید"
          : undefined,
      uri:
        tcpHost && tcpPort && realityPubKey
          ? buildVlessReality(
              userUuid,
              tcpHost,
              tcpPort,
              realitySni,
              realityPubKey,
              realityShortId
            )
          : "",
    },
    {
      index: 7,
      name: "VLESS + xHTTP + TLS",
      protocol: "vless",
      transport: "xhttp",
      security: "tls",
      tag: "vless-xhttp",
      color: "yellow",
      remark: `${username}-vless-xhttp`,
      needsTcpProxy: false,
      warning:
        "xHTTP روی Railway پشتیبانی نمی‌شود — nginx نمی‌تواند ترافیک xHTTP را به Xray فوروارد کند. از کانفیگ‌های WebSocket استفاده کنید.",
      uri: "",
    },
    {
      index: 8,
      name: "VLESS + TCP + XTLS-Vision",
      protocol: "vless",
      transport: "tcp",
      security: "tls",
      tag: "vless-tcp-xtls",
      color: "green",
      remark: `${username}-vless-xtls`,
      needsTcpProxy: true,
      warning:
        !tcpHost || !tcpPort
          ? "برای XTLS-Vision باید Railway TCP Proxy فعال باشد (متغیرهای RAILWAY_TCP_PROXY_DOMAIN/PORT)"
          : undefined,
      uri:
        tcpHost && tcpPort
          ? buildVlessXtlsVision(userUuid, tcpHost, tcpPort, host)
          : "",
    },
  ];

  return configs;
}

/**
 * Build a query string from key-value pairs WITHOUT URL-encoding the values.
 * This prevents "/" from being encoded as "%2F" which breaks path-based
 * protocols like WebSocket and xHTTP.
 */
function buildQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== "" && v !== undefined && v !== null)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
}

function buildVlessWs(uuid: string, host: string, sni: string, path: string, port: number) {
  const query = buildQuery({
    encryption: "none",
    security: "tls",
    sni,
    type: "ws",
    host,
    path,
    fp: "chrome",
    alpn: "h2,http/1.1",
  });
  return `vless://${uuid}@${host}:${port}?${query}#${encodeURIComponent("VLESS-WS-TLS")}`;
}

function buildVlessGrpc(
  uuid: string,
  host: string,
  sni: string,
  serviceName: string,
  port: number
) {
  const query = buildQuery({
    encryption: "none",
    security: "tls",
    sni,
    type: "grpc",
    serviceName,
    mode: "gun",
    fp: "chrome",
    alpn: "h2",
  });
  return `vless://${uuid}@${host}:${port}?${query}#${encodeURIComponent("VLESS-gRPC-TLS")}`;
}

function buildVmessWs(uuid: string, host: string, sni: string, path: string, port: number) {
  const cfg = {
    v: "2",
    ps: "VMess-WS-TLS",
    add: host,
    port: String(port),
    id: uuid,
    aid: "0",
    scy: "auto",
    net: "ws",
    type: "none",
    host,
    path,
    tls: "tls",
    sni,
    alpn: "h2,http/1.1",
    fp: "chrome",
  };
  return `vmess://${Buffer.from(JSON.stringify(cfg), "utf-8").toString("base64")}`;
}

function buildTrojanWs(password: string, host: string, sni: string, path: string, port: number) {
  const query = buildQuery({
    security: "tls",
    sni,
    type: "ws",
    host,
    path,
    fp: "chrome",
    alpn: "h2,http/1.1",
  });
  return `trojan://${password}@${host}:${port}?${query}#${encodeURIComponent("Trojan-WS-TLS")}`;
}

function buildTrojanGrpc(
  password: string,
  host: string,
  sni: string,
  serviceName: string,
  port: number
) {
  const query = buildQuery({
    security: "tls",
    sni,
    type: "grpc",
    serviceName,
    mode: "gun",
    fp: "chrome",
    alpn: "h2",
  });
  return `trojan://${password}@${host}:${port}?${query}#${encodeURIComponent("Trojan-gRPC-TLS")}`;
}

function buildVlessReality(
  uuid: string,
  host: string,
  port: number,
  sni: string,
  publicKey: string,
  shortId: string
) {
  const query = buildQuery({
    encryption: "none",
    security: "reality",
    sni,
    fp: "chrome",
    pbk: publicKey,
    sid: shortId,
    type: "tcp",
    flow: "xtls-rprx-vision",
  });
  return `vless://${uuid}@${host}:${port}?${query}#${encodeURIComponent("VLESS-Reality")}`;
}

function buildVlessXhttp(uuid: string, host: string, sni: string, path: string, port: number) {
  const query = buildQuery({
    encryption: "none",
    security: "tls",
    sni,
    type: "xhttp",
    host,
    path,
    mode: "auto",
    fp: "chrome",
    alpn: "h2,http/1.1",
  });
  return `vless://${uuid}@${host}:${port}?${query}#${encodeURIComponent("VLESS-xHTTP-TLS")}`;
}

function buildVlessXtlsVision(uuid: string, host: string, port: number, sni: string) {
  const query = buildQuery({
    encryption: "none",
    security: "tls",
    sni,
    type: "tcp",
    flow: "xtls-rprx-vision",
    fp: "chrome",
    alpn: "h2,http/1.1",
  });
  return `vless://${uuid}@${host}:${port}?${query}#${encodeURIComponent("VLESS-XTLS-Vision")}`;
}

/**
 * Build the full base64 subscription blob for a user.
 * Filters out configs with empty URIs (e.g., Reality when TCP proxy not configured).
 */
export async function buildBase64Subscription(
  userUuid: string,
  username: string,
  host: string
): Promise<string> {
  const configs = await generateUserConfigs(userUuid, username, host);
  const blob = configs
    .filter((c) => c.uri)
    .map((c) => c.uri)
    .join("\n");
  return Buffer.from(blob, "utf-8").toString("base64");
}

/**
 * Get the effective host from env or DB settings.
 */
export async function getEffectiveHost(): Promise<string> {
  if (process.env.XRAY_DOMAIN) return process.env.XRAY_DOMAIN;
  if (process.env.RAILWAY_STATIC_URL) return process.env.RAILWAY_STATIC_URL;
  const setting = await db.setting.findUnique({ where: { key: "domain" } });
  if (setting?.value) return setting.value;
  return "localhost";
}
