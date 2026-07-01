"use client";

import { useEffect, useState } from "react";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { MicroLabel } from "@/components/cyber/micro-label";
import { GlowCard } from "@/components/cyber/glow-card";
import { ScrollText, User, Shield } from "lucide-react";
import { formatJalaliDateTime } from "@/lib/jalali";

interface AuditLog {
  id: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: string;
  admin: { username: string } | null;
}

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "green",
  LOGIN_FAIL: "magenta",
  LOGOUT: "yellow",
  USER_CREATE: "green",
  USER_UPDATE: "cyan",
  USER_DELETE: "magenta",
  USER_TOGGLE: "yellow",
  USER_RESET: "cyan",
  XRAY_START: "green",
  XRAY_STOP: "magenta",
  XRAY_RESTART: "yellow",
  INBOUND_CREATE: "green",
  INBOUND_UPDATE: "cyan",
  INBOUND_DELETE: "magenta",
  SETTINGS_UPDATE: "cyan",
  PLAN_CREATE: "green",
  PLAN_UPDATE: "cyan",
  PLAN_DELETE: "magenta",
  ADMIN_CREATE: "green",
  ADMIN_UPDATE: "cyan",
  ADMIN_DELETE: "magenta",
  BACKUP_CREATE: "cyan",
  BACKUP_RESTORE: "cyan",
  "2FA_ENABLE": "green",
  "2FA_DISABLE": "magenta",
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: "ورود موفق",
  LOGIN_FAIL: "ورود ناموفق",
  LOGOUT: "خروج",
  USER_CREATE: "ایجاد کاربر",
  USER_UPDATE: "ویرایش کاربر",
  USER_DELETE: "حذف کاربر",
  USER_TOGGLE: "تغییر وضعیت کاربر",
  USER_RESET: "صفر کردن مصرف",
  USER_SUSPEND: "تعلیق کاربر",
  XRAY_START: "اجراهای Xray",
  XRAY_STOP: "توقف Xray",
  XRAY_RESTART: "ری‌استارت Xray",
  INBOUND_CREATE: "ایجاد اینباند",
  INBOUND_UPDATE: "ویرایش اینباند",
  INBOUND_DELETE: "حذف اینباند",
  SETTINGS_UPDATE: "به‌روزرسانی تنظیمات",
  PLAN_CREATE: "ایجاد بسته",
  PLAN_UPDATE: "ویرایش بسته",
  PLAN_DELETE: "حذف بسته",
  ADMIN_CREATE: "ایجاد ادمین",
  ADMIN_UPDATE: "ویرایش ادمین",
  ADMIN_DELETE: "حذف ادمین",
  BACKUP_CREATE: "ساخت بکاپ",
  BACKUP_RESTORE: "بازیابی بکاپ",
  "2FA_ENABLE": "فعال‌سازی ۲FA",
  "2FA_DISABLE": "غیرفعال‌سازی ۲FA",
};

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/audit?limit=200", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLogs(d.logs || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6 animate-fade-slide">
      <div>
        <PixelHeading as="h1" color="cyan">
          لاگ ممیزی
        </PixelHeading>
        <MicroLabel className="mt-1 block">تاریخچه کامل اکشن‌های ادمین‌ها</MicroLabel>
      </div>

      <GlowCard className="overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh] overflow-y-auto">
          <table className="cyber-table">
            <thead className="sticky top-0 bg-[#0a0e1a] z-10">
              <tr>
                <th>زمان</th>
                <th>ادمین</th>
                <th>اکشن</th>
                <th>هدف</th>
                <th>جزئیات</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-muted-foreground py-12">
                    {loading ? "در حال بارگذاری..." : "هیچ لاگی وجود ندارد"}
                  </td>
                </tr>
              )}
              {logs.map((log) => {
                const color = ACTION_COLORS[log.action] || "cyan";
                const colorClass = {
                  cyan: "neon-text-cyan",
                  magenta: "neon-text-magenta",
                  yellow: "neon-text-yellow",
                  green: "neon-text-green",
                  purple: "neon-text-purple",
                }[color];
                return (
                  <tr key={log.id}>
                    <td className="text-xs whitespace-nowrap">
                      {formatJalaliDateTime(log.createdAt)}
                    </td>
                    <td>
                      {log.admin ? (
                        <span className="flex items-center gap-1 text-sm">
                          <User className="w-3 h-3" /> {log.admin.username}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">سیستم</span>
                      )}
                    </td>
                    <td>
                      <span className={`protocol-chip ${color === "cyan" ? "" : color}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="font-mono-cyber text-xs" dir="ltr">
                      {log.target || "—"}
                    </td>
                    <td className="text-xs text-muted-foreground max-w-xs truncate">
                      {log.detail || "—"}
                    </td>
                    <td className="font-mono-cyber text-xs" dir="ltr">
                      {log.ip || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlowCard>

      <div className="cyber-card p-4 flex items-center gap-2 text-xs text-muted-foreground">
        <ScrollText className="w-4 h-4 neon-text-cyan" />
        <Shield className="w-4 h-4 neon-text-magenta" />
        <span>۲۰۰ لاگ آخر نمایش داده می‌شود — برای مشاهده لاگ‌های قدیمی‌تر از بکاپ‌ها استفاده کنید</span>
      </div>
    </div>
  );
}
