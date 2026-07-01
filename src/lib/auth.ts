// NextAuth config — credentials provider with bcrypt + optional TOTP 2FA
// تنظیمات NextAuth — احراز هویت با bcrypt و ۲FA اختیاری

import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { verifyToken } from "@/lib/totp";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";

// In-memory rate-limit table (per IP) — simple brute-force protection
// In production use Redis, but for Railway single-instance this is fine
const loginAttempts = new Map<string, { count: number; last: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 min

function checkRateLimit(ip: string): { ok: boolean; remaining: number; waitMs: number } {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now - entry.last > WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, last: now });
    return { ok: true, remaining: MAX_ATTEMPTS - 1, waitMs: 0 };
  }
  entry.count += 1;
  entry.last = now;
  if (entry.count > MAX_ATTEMPTS) {
    const waitMs = WINDOW_MS - (now - entry.last);
    return { ok: false, remaining: 0, waitMs: Math.max(0, waitMs) };
  }
  return { ok: true, remaining: MAX_ATTEMPTS - entry.count, waitMs: 0 };
}

function clearRateLimit(ip: string) {
  loginAttempts.delete(ip);
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // 12h
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
        totp: { label: "TOTP", type: "text" },
      },
      async authorize(creds, req) {
        const username = creds?.username?.trim();
        const password = creds?.password ?? "";
        const totp = creds?.totp?.trim();
        const ip =
          (req?.headers?.["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
          (req?.headers?.["x-real-ip"] as string) ||
          "unknown";

        if (!username || !password) return null;

        const rl = checkRateLimit(ip);
        if (!rl.ok) {
          throw new Error("TOO_MANY_ATTEMPTS");
        }

        const admin = await db.admin.findUnique({ where: { username } });
        if (!admin) {
          await writeAudit({
            action: "LOGIN_FAIL",
            target: username,
            detail: "user not found",
            ip,
          });
          return null;
        }

        const ok = await bcrypt.compare(password, admin.passwordHash);
        if (!ok) {
          await writeAudit({
            action: "LOGIN_FAIL",
            adminId: admin.id,
            target: username,
            ip,
          });
          return null;
        }

        // 2FA check
        if (admin.totpEnabled && admin.totpSecret) {
          if (!totp) {
            throw new Error("TOTP_REQUIRED");
          }
          const valid = await verifyToken(totp, admin.totpSecret);
          if (!valid) {
            await writeAudit({
              action: "LOGIN_FAIL",
              adminId: admin.id,
              target: username,
              detail: "invalid TOTP",
              ip,
            });
            return null;
          }
        }

        clearRateLimit(ip);
        await writeAudit({
          action: "LOGIN",
          adminId: admin.id,
          target: username,
          ip,
        });

        return {
          id: admin.id,
          name: admin.username,
          role: admin.role,
        } as unknown as { id: string; name: string; email: string };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = (user as { id: string }).id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string }).id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Helper: returns the current admin from the session, or null
export async function getCurrentAdmin(
  session: { user?: { id?: string; name?: string | null; role?: string } } | null
) {
  if (!session?.user?.id) return null;
  return db.admin.findUnique({ where: { id: session.user.id } });
}
