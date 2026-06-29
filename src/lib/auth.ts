import { db } from "@/lib/db";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "fastapicloud_session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export interface AdminSession {
  id: string;
  username: string;
  role: string;
  email?: string | null;
}

/**
 * Hash a plain password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify a plain password against a hash
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

/**
 * Generate a simple session token (base64-encoded JSON with timestamp)
 */
export function createSessionToken(admin: AdminSession): string {
  const payload = {
    ...admin,
    iat: Date.now(),
    exp: Date.now() + SESSION_MAX_AGE * 1000,
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

/**
 * Decode and validate a session token
 */
export function verifySessionToken(token: string): AdminSession | null {
  try {
    const decoded = JSON.parse(
      Buffer.from(token, "base64").toString("utf8")
    ) as AdminSession & { iat?: number; exp?: number };
    if (!decoded.id || !decoded.username) return null;
    if (decoded.exp && Date.now() > decoded.exp) return null;
    return {
      id: decoded.id,
      username: decoded.username,
      role: decoded.role,
      email: decoded.email,
    };
  } catch {
    return null;
  }
}

/**
 * URL-encode a cookie value (RFC 6265 compliant)
 */
function encodeCookieValue(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Build a Set-Cookie header value with given name/value/options
 */
function buildCookieString(
  name: string,
  value: string,
  options: {
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: "lax" | "strict" | "none";
    path?: string;
    maxAge?: number;
  } = {}
): string {
  const parts: string[] = [`${name}=${encodeCookieValue(value)}`];
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  return parts.join("; ");
}

/**
 * Set the session cookie header value
 */
export function buildSessionCookie(token: string): string {
  return buildCookieString(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

/**
 * Build a clear-cookie header value
 */
export function buildClearSessionCookie(): string {
  return buildCookieString(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Parse cookies from a Cookie header string into a simple object
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const idx = pair.indexOf("=");
    if (idx === -1) continue;
    const name = pair.slice(0, idx).trim();
    const value = pair.slice(idx + 1).trim();
    try {
      result[name] = decodeURIComponent(value);
    } catch {
      result[name] = value;
    }
  }
  return result;
}

/**
 * Parse cookies from a Request and return the admin session (if valid)
 */
export async function getAdminFromRequest(
  req: Request
): Promise<AdminSession | null> {
  const cookieHeader = req.headers.get("cookie") || "";
  const cookies = parseCookies(cookieHeader);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Ensure a default admin exists in the database.
 * Default credentials: admin / admin123 (only if no admin exists yet)
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const count = await db.admin.count();
  if (count > 0) return;
  const password = await hashPassword("admin123");
  await db.admin.create({
    data: {
      username: "admin",
      password,
      email: "admin@fastapicloud.com",
      role: "admin",
    },
  });
}
