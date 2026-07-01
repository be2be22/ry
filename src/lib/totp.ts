// TOTP wrapper around otplib v13 (which removed the legacy `authenticator` singleton)
// پوشش TOTP برای otplib نسخه ۱۳

import { OTP } from "otplib";

// Default TOTP configuration: 6 digits, 30s period, SHA1
export const totp = new OTP({ strategy: "totp" });

// Helper functions for backward compatibility
export function generateSecret(): string {
  return totp.generateSecret();
}

export function generateURI(opts: {
  label: string;
  issuer: string;
  secret: string;
}): string {
  return totp.generateURI({
    label: opts.label,
    issuer: opts.issuer,
    secret: opts.secret,
  });
}

export async function verifyToken(token: string, secret: string): Promise<boolean> {
  try {
    return await totp.verify({ token, secret });
  } catch {
    return false;
  }
}

export async function generateToken(secret: string): Promise<string> {
  return totp.generate({ secret });
}
