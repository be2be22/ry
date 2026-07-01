// Subscription link generator — produces 8 protocol URIs per user
// تولید لینک اشتراک — ۸ پروتکل برای هر کاربر
//
// Each user gets the following 8 configs (TLS terminated at Railway edge):
//   1. VLESS + WS + TLS
//   2. VLESS + gRPC + TLS
//   3. VMess + WS + TLS
//   4. Trojan + WS + TLS
//   5. Trojan + gRPC + TLS
//   6. VLESS + XTLS-Reality
//   7. VLESS + xHTTP + TLS
//   8. VLESS + TCP + XTLS-Vision + TLS  (the "best additional" choice — high throughput)
//
// No Shadowsocks. No SOCKS/HTTP. No plain VLESS+TCP+TLS without XTLS.

import { db } from "@/lib/db";

export interface ProtocolConfig {
  index: number;
  name: string;
  protocol: "vless" | "vmess" | "trojan";
  transport: "ws" | "grpc" | "xhttp" | "tcp" | "reality";
  security: "tls" | "reality" | "none";
  uri: string;
  tag: string;
  color: string; // for UI chip color
  remark: string;
}

/**
 * Generate all 8 config URIs for a VPN user.
 * The `host` is the public-facing domain (Railway domain).
 */
export async function generateUserConfigs(
  userUuid: string,
  username: string,
  host: string
): Promise<ProtocolConfig[]> {
  const sni = host;
  const PORT = 443; // clients connect on 443 (Railway HTTPS)

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
      uri: buildVlessWs(userUuid, host, sni, "/vless-ws", PORT),
    },
    {
      index: 2,
      name: "VLESS + gRPC + TLS",
      protocol: "vless",
      transport: "grpc",
      security: "tls",
      tag: "vless-grpc",
      color: "cyan",
      remark: `${username}-vless-grpc`,
      uri: buildVlessGrpc(userUuid, host, sni, "vless-grpc", PORT),
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
      uri: buildVmessWs(userUuid, host, sni, "/vmess-ws", PORT),
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
      uri: buildTrojanWs(userUuid, host, sni, "/trojan-ws", PORT),
    },
    {
      index: 5,
      name: "Trojan + gRPC + TLS",
      protocol: "trojan",
      transport: "grpc",
      security: "tls",
      tag: "trojan-grpc",
      color: "magenta",
      remark: `${username}-trojan-grpc`,
      uri: buildTrojanGrpc(userUuid, host, sni, "trojan-grpc", PORT),
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
      uri: buildVlessReality(userUuid, host, PORT),
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
      uri: buildVlessXhttp(userUuid, host, sni, "/vless-xhttp", PORT),
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
      uri: buildVlessXtlsVision(userUuid, host, sni, PORT),
    },
  ];

  return configs;
}

function buildVlessWs(uuid: string, host: string, sni: string, path: string, port: number) {
  const params = new URLSearchParams({
    encryption: "none",
    security: "tls",
    sni,
    type: "ws",
    host,
    path: encodeURIComponent(path),
    fp: "chrome",
    alpn: "h2,http/1.1",
  });
  return `vless://${uuid}@${host}:${port}?${params.toString()}#${encodeURIComponent(
    "VLESS-WS-TLS"
  )}`;
}

function buildVlessGrpc(uuid: string, host: string, sni: string, serviceName: string, port: number) {
  const params = new URLSearchParams({
    encryption: "none",
    security: "tls",
    sni,
    type: "grpc",
    serviceName,
    mode: "gun",
    fp: "chrome",
    alpn: "h2",
  });
  return `vless://${uuid}@${host}:${port}?${params.toString()}#${encodeURIComponent(
    "VLESS-gRPC-TLS"
  )}`;
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
  const params = new URLSearchParams({
    security: "tls",
    sni,
    type: "ws",
    host,
    path: encodeURIComponent(path),
    fp: "chrome",
    alpn: "h2,http/1.1",
  });
  return `trojan://${password}@${host}:${port}?${params.toString()}#${encodeURIComponent(
    "Trojan-WS-TLS"
  )}`;
}

function buildTrojanGrpc(password: string, host: string, sni: string, serviceName: string, port: number) {
  const params = new URLSearchParams({
    security: "tls",
    sni,
    type: "grpc",
    serviceName,
    mode: "gun",
    fp: "chrome",
    alpn: "h2",
  });
  return `trojan://${password}@${host}:${port}?${params.toString()}#${encodeURIComponent(
    "Trojan-gRPC-TLS"
  )}`;
}

function buildVlessReality(uuid: string, host: string, port: number) {
  // Reality uses a "borrowed" SNI (serverName) — clients connect to `host`
  // but pretend it's the dest server. In Railway this won't actually work
  // over the public HTTPS port (Reality needs raw TCP), but the config is
  // generated for completeness; it'll work if you expose a raw TCP port.
  const params = new URLSearchParams({
    encryption: "none",
    security: "reality",
    sni: "www.microsoft.com",
    fp: "chrome",
    pbk: "", // public key — filled at install time
    sid: "",
    type: "tcp",
    flow: "xtls-rprx-vision",
  });
  return `vless://${uuid}@${host}:${port}?${params.toString()}#${encodeURIComponent(
    "VLESS-Reality"
  )}`;
}

function buildVlessXhttp(uuid: string, host: string, sni: string, path: string, port: number) {
  const params = new URLSearchParams({
    encryption: "none",
    security: "tls",
    sni,
    type: "xhttp",
    host,
    path: encodeURIComponent(path),
    mode: "auto",
    fp: "chrome",
    alpn: "h2,http/1.1",
  });
  return `vless://${uuid}@${host}:${port}?${params.toString()}#${encodeURIComponent(
    "VLESS-xHTTP-TLS"
  )}`;
}

function buildVlessXtlsVision(uuid: string, host: string, sni: string, port: number) {
  const params = new URLSearchParams({
    encryption: "none",
    security: "tls",
    sni,
    type: "tcp",
    flow: "xtls-rprx-vision",
    fp: "chrome",
    alpn: "h2,http/1.1",
  });
  return `vless://${uuid}@${host}:${port}?${params.toString()}#${encodeURIComponent(
    "VLESS-XTLS-Vision"
  )}`;
}

/**
 * Build the full base64 subscription blob for a user (for v2rayNG/Hiddify/etc).
 */
export async function buildBase64Subscription(
  userUuid: string,
  username: string,
  host: string
): Promise<string> {
  const configs = await generateUserConfigs(userUuid, username, host);
  const blob = configs.map((c) => c.uri).join("\n");
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
