// Audit log helper — writes admin actions to the DB
// لاگ ممیزی — اکشن‌های ادمین را در دیتابیس ذخیره می‌کند

import { db } from "@/lib/db";

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAIL"
  | "LOGOUT"
  | "USER_CREATE"
  | "USER_UPDATE"
  | "USER_DELETE"
  | "USER_TOGGLE"
  | "USER_RESET"
  | "USER_SUSPEND"
  | "XRAY_START"
  | "XRAY_STOP"
  | "XRAY_RESTART"
  | "INBOUND_CREATE"
  | "INBOUND_UPDATE"
  | "INBOUND_DELETE"
  | "SETTINGS_UPDATE"
  | "PLAN_CREATE"
  | "PLAN_UPDATE"
  | "PLAN_DELETE"
  | "ADMIN_CREATE"
  | "ADMIN_UPDATE"
  | "ADMIN_DELETE"
  | "BACKUP_CREATE"
  | "BACKUP_RESTORE"
  | "2FA_ENABLE"
  | "2FA_DISABLE";

export async function writeAudit(opts: {
  adminId?: string;
  action: AuditAction;
  target?: string;
  detail?: string;
  ip?: string;
}): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        adminId: opts.adminId ?? null,
        action: opts.action,
        target: opts.target ?? null,
        detail: opts.detail ?? null,
        ip: opts.ip ?? null,
      },
    });
  } catch (e) {
    console.error("audit write failed", e);
  }
}
