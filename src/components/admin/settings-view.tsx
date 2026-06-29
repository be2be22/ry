"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Cloud,
  ShieldCheck,
  Github,
  Globe,
  Server,
  Key,
  Bell,
  Palette,
  Database,
  Zap,
  Code,
  Copy,
} from "lucide-react";
import { toast } from "sonner";
import { toPersianDigits } from "@/lib/v2ray";
import { XrayLocalManager } from "@/components/admin/xray-local-manager";

interface SettingsProps {
  admin: { id: string; username: string; email?: string | null; role: string };
}

export function SettingsView({ admin }: SettingsProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changing, setChanging] = useState(false);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword) {
      toast.error("رمز فعلی و جدید را وارد کنید");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("رمز جدید و تکرار آن یکسان نیستند");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("رمز جدید باید حداقل ۶ کاراکتر باشد");
      return;
    }
    setChanging(true);
    try {
      // First verify old password by attempting login
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: admin.username, password: oldPassword }),
      });
      const loginData = await loginRes.json();
      if (!loginData.ok) {
        toast.error("رمز فعلی نادرست است");
        return;
      }

      // Update password via a direct admin update API (we'll create simple inline)
      // Since we don't have a dedicated endpoint, we'll use a settings endpoint
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success("رمز عبور تغییر کرد");
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        toast.error(data.error || "خطا در تغییر رمز");
      }
    } catch {
      toast.error("خطای شبکه");
    } finally {
      setChanging(false);
    }
  };

  const copyApiExample = () => {
    const example = `# Generate VMess share link
GET /api/configs/{id}

# Response:
{
  "ok": true,
  "config": { ... },
  "shareLink": "vmess://...",
  "inboundJson": { ... },
  "clashYaml": "..."
}`;
    navigator.clipboard.writeText(example);
    toast.success("کپی شد");
  };

  const settings = [
    {
      title: "اطلاعات حساب",
      icon: Key,
      color: "oklch(0.65 0.25 290)",
      children: (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 glass rounded-xl">
            <span className="text-sm text-muted-foreground">نام کاربری</span>
            <span className="text-sm font-mono" dir="ltr">{admin.username}</span>
          </div>
          <div className="flex items-center justify-between p-3 glass rounded-xl">
            <span className="text-sm text-muted-foreground">ایمیل</span>
            <span className="text-sm font-mono" dir="ltr">{admin.email || "—"}</span>
          </div>
          <div className="flex items-center justify-between p-3 glass rounded-xl">
            <span className="text-sm text-muted-foreground">نقش</span>
            <span className="text-sm">{admin.role === "admin" ? "مدیر کل" : admin.role}</span>
          </div>
        </div>
      ),
    },
    {
      title: "تغییر رمز عبور",
      icon: ShieldCheck,
      color: "oklch(0.7 0.18 150)",
      children: (
        <form onSubmit={changePassword} className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">رمز فعلی</label>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">رمز جدید</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
              dir="ltr"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">تکرار رمز جدید</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
              dir="ltr"
            />
          </div>
          <button
            type="submit"
            disabled={changing}
            className="w-full rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ background: "linear-gradient(120deg, oklch(0.7 0.18 150), oklch(0.65 0.2 180))" }}
          >
            {changing ? "در حال ذخیره..." : "تغییر رمز"}
          </button>
        </form>
      ),
    },
    {
      title: "اطلاعات سیستم",
      icon: Database,
      color: "oklch(0.7 0.2 200)",
      children: (
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 glass rounded-xl">
            <span className="text-sm text-muted-foreground">نسخه پنل</span>
            <span className="text-sm font-mono" dir="ltr">v1.0.0</span>
          </div>
          <div className="flex items-center justify-between p-3 glass rounded-xl">
            <span className="text-sm text-muted-foreground">دامنه</span>
            <span className="text-sm font-mono" dir="ltr">fastapicloud.com</span>
          </div>
          <div className="flex items-center justify-between p-3 glass rounded-xl">
            <span className="text-sm text-muted-foreground">پایگاه داده</span>
            <span className="text-sm">SQLite (Prisma)</span>
          </div>
          <div className="flex items-center justify-between p-3 glass rounded-xl">
            <span className="text-sm text-muted-foreground">پروتکل‌های پشتیبانی</span>
            <span className="text-sm">VMess · VLESS · Trojan</span>
          </div>
        </div>
      ),
    },
    {
      title: "API Reference",
      icon: Code,
      color: "oklch(0.78 0.22 60)",
      children: (
        <div className="space-y-2">
          <div className="glass rounded-xl p-3 text-xs font-mono overflow-x-auto" dir="ltr">
            <div className="text-muted-foreground mb-1"># Authentication</div>
            <div>POST /api/auth/login</div>
            <div>POST /api/auth/logout</div>
            <div>GET  /api/auth/check</div>
            <div className="text-muted-foreground mt-2 mb-1"># Configs</div>
            <div>GET    /api/configs</div>
            <div>POST   /api/configs</div>
            <div>GET    /api/configs/[id]</div>
            <div>PUT    /api/configs/[id]</div>
            <div>DELETE /api/configs/[id]</div>
            <div className="text-muted-foreground mt-2 mb-1"># Servers & Users</div>
            <div>GET/POST   /api/servers</div>
            <div>GET/PUT/DEL /api/servers/[id]</div>
            <div>GET/POST   /api/users</div>
            <div>GET/PUT/DEL /api/users/[id]</div>
            <div className="text-muted-foreground mt-2 mb-1"># QR & Stats</div>
            <div>GET /api/qr?id=[configId]</div>
            <div>GET /api/stats</div>
          </div>
          <button
            onClick={copyApiExample}
            className="w-full glass-input rounded-xl py-2 text-xs flex items-center justify-center gap-2"
          >
            <Copy className="w-3 h-3" />
            کپی نمونه پاسخ API
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold gradient-text">تنظیمات پنل</h1>
        <p className="text-sm text-muted-foreground mt-1">
          مدیریت حساب کاربری و تنظیمات سیستم
        </p>
      </div>

      {/* About card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-strong rounded-2xl p-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-48 h-48 opacity-20 -translate-y-12 translate-x-12 rounded-full blur-3xl"
          style={{ background: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))" }}
        />
        <div className="relative flex flex-wrap items-center gap-6">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center text-white animate-pulse-glow"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))" }}
          >
            <Cloud className="w-10 h-10" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h2 className="text-xl font-bold gradient-text">FastApiCloud Panel</h2>
            <p className="text-sm text-muted-foreground mt-1">
              پنل مدیریتی پیشرفته برای ساخت و مدیریت کانفیگ‌های V2Ray/Xray با WebSocket transport
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              {["VMess", "VLESS", "Trojan", "WebSocket", "TLS", "XTLS"].map((tag) => (
                <span key={tag} className="text-[10px] font-medium px-2 py-1 rounded-full glass">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Settings grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {settings.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl p-5"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
                  style={{ background: `linear-gradient(135deg, ${s.color}, ${s.color})` }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold">{s.title}</h3>
              </div>
              {s.children}
            </motion.div>
          );
        })}
      </div>

      {/* Xray Local Server Manager */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{ background: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))" }}
          >
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold">سرور Xray محلی</h2>
            <p className="text-xs text-muted-foreground">
              مدیریت اجرای Xray-core روی همین سرور سایت — بدون نیاز به سرور خارجی
            </p>
          </div>
        </div>
        <XrayLocalManager />
      </div>

      {/* Quick stats */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-4">ویژگی‌های پنل</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "پروتکل‌ها", value: 3, icon: Zap, color: "oklch(0.65 0.25 290)" },
            { label: "API endpoints", value: 12, icon: Code, color: "oklch(0.7 0.2 200)" },
            { label: "نمودارها", value: 6, icon: Palette, color: "oklch(0.78 0.22 60)" },
            { label: "امنیت", value: 100, icon: ShieldCheck, color: "oklch(0.7 0.18 150)", suffix: "%" },
          ].map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.label} className="glass rounded-xl p-4 text-center">
                <Icon className="w-5 h-5 mx-auto mb-2" style={{ color: f.color }} />
                <div className="text-xl font-bold">
                  {toPersianDigits(f.value)}{f.suffix || ""}
                </div>
                <div className="text-[11px] text-muted-foreground">{f.label}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-center text-xs text-muted-foreground/60 py-4">
        © {toPersianDigits(2026)} FastApiCloud.com — ساخته شده با ❤️ برای جامعه‌ی فارسی‌زبان
      </div>
    </div>
  );
}
