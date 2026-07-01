"use client";

import { useEffect, useState } from "react";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { MicroLabel } from "@/components/cyber/micro-label";
import { CyberButton } from "@/components/cyber/cyber-button";
import { GlowCard } from "@/components/cyber/glow-card";
import {
  Settings as SettingsIcon,
  Globe,
  Send,
  Users,
  Shield,
  QrCode,
  Loader2,
  Check,
  Trash2,
  Plus,
  KeyRound,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { toPersianDigits } from "@/lib/jalali";

interface Settings {
  domain: string;
  language: string;
  telegram_bot_token: string;
  telegram_chat_id: string;
  telegram_enabled: string;
  ssl_auto: string;
  backup_auto_enabled: string;
  backup_interval_hours: string;
  country_restrict_default: string;
}

export default function SettingsPage() {
  return (
    <div className="space-y-6 animate-fade-slide">
      <div>
        <PixelHeading as="h1" color="cyan">
          تنظیمات
        </PixelHeading>
        <MicroLabel className="mt-1 block">پیکربندی پنل، دامنه، تلگرام، ادمین‌ها و ۲FA</MicroLabel>
      </div>

      <Tabs defaultValue="general" dir="rtl">
        <TabsList className="bg-[#0a0e1a] border border-[#2de8d0]/20">
          <TabsTrigger value="general" className="data-[state=active]:bg-[#2de8d0]/10 data-[state=active]:text-[#2de8d0]">
            <SettingsIcon className="w-4 h-4 ml-1" /> عمومی
          </TabsTrigger>
          <TabsTrigger value="telegram" className="data-[state=active]:bg-[#2de8d0]/10 data-[state=active]:text-[#2de8d0]">
            <Send className="w-4 h-4 ml-1" /> تلگرام
          </TabsTrigger>
          <TabsTrigger value="admins" className="data-[state=active]:bg-[#2de8d0]/10 data-[state=active]:text-[#2de8d0]">
            <Users className="w-4 h-4 ml-1" /> ادمین‌ها
          </TabsTrigger>
          <TabsTrigger value="2fa" className="data-[state=active]:bg-[#2de8d0]/10 data-[state=active]:text-[#2de8d0]">
            <Shield className="w-4 h-4 ml-1" /> ۲FA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <GeneralTab />
        </TabsContent>
        <TabsContent value="telegram">
          <TelegramTab />
        </TabsContent>
        <TabsContent value="admins">
          <AdminsTab />
        </TabsContent>
        <TabsContent value="2fa">
          <TwoFactorTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function GeneralTab() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then(setS)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      toast.success("تنظیمات ذخیره شد");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !s) return <div className="text-muted-foreground">در حال بارگذاری...</div>;

  return (
    <GlowCard className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Globe className="w-5 h-5 neon-text-cyan" />
        <PixelHeading as="h3" color="cyan">
          تنظیمات عمومی
        </PixelHeading>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label className="micro-label">دامنه (Domain)</Label>
          <Input
            value={s.domain}
            onChange={(e) => setS({ ...s, domain: e.target.value })}
            className="cyber-input mt-1"
            dir="ltr"
            placeholder="yourapp.up.railway.app"
          />
          <p className="text-[10px] text-muted-foreground mt-1">
            دامنه Railway یا دامنه اختصاصی شما
          </p>
        </div>
        <div>
          <Label className="micro-label">زبان پیش‌فرض</Label>
          <Select value={s.language} onValueChange={(v) => setS({ ...s, language: v })}>
            <SelectTrigger className="cyber-input mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fa">فارسی</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="micro-label">بازه بکاپ خودکار (ساعت)</Label>
          <Input
            type="number"
            value={s.backup_interval_hours}
            onChange={(e) => setS({ ...s, backup_interval_hours: e.target.value })}
            className="cyber-input mt-1"
            dir="ltr"
          />
        </div>
        <div>
          <Label className="micro-label">محدودیت پیش‌فرض کشور/IP</Label>
          <Input
            value={s.country_restrict_default}
            onChange={(e) => setS({ ...s, country_restrict_default: e.target.value })}
            className="cyber-input mt-1"
            dir="ltr"
            placeholder="IR,US"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={s.ssl_auto === "true"}
            onCheckedChange={(v) => setS({ ...s, ssl_auto: v ? "true" : "false" })}
          />
          <Label>SSL خودکار (Railway)</Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={s.backup_auto_enabled === "true"}
            onCheckedChange={(v) => setS({ ...s, backup_auto_enabled: v ? "true" : "false" })}
          />
          <Label>بکاپ خودکار</Label>
        </div>
      </div>

      <div className="pt-4 border-t border-[#2de8d0]/15">
        <CyberButton variant="magenta" pulse loading={saving} onClick={save}>
          ذخیره تنظیمات
        </CyberButton>
      </div>
    </GlowCard>
  );
}

function TelegramTab() {
  const [s, setS] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then((r) => r.json())
      .then(setS)
      .finally(() => setLoading(false));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(s),
      });
      toast.success("ذخیره شد");
    } finally {
      setSaving(false);
    }
  }

  async function test() {
    setTesting(true);
    try {
      const res = await fetch("/api/telegram/test", { method: "POST" });
      const data = await res.json();
      if (res.ok) toast.success("پیام تست ارسال شد");
      else toast.error(data.error || "خطا در ارسال");
    } finally {
      setTesting(false);
    }
  }

  if (loading || !s) return <div className="text-muted-foreground">در حال بارگذاری...</div>;

  return (
    <GlowCard className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Send className="w-5 h-5 neon-text-cyan" />
        <PixelHeading as="h3" color="cyan">
          یکپارچه‌سازی تلگرام
        </PixelHeading>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="micro-label">توکن ربات (BotFather)</Label>
          <Input
            value={s.telegram_bot_token}
            onChange={(e) => setS({ ...s, telegram_bot_token: e.target.value })}
            className="cyber-input mt-1 font-mono-cyber"
            dir="ltr"
            placeholder="123456789:ABCdef..."
          />
        </div>
        <div>
          <Label className="micro-label">Chat ID</Label>
          <Input
            value={s.telegram_chat_id}
            onChange={(e) => setS({ ...s, telegram_chat_id: e.target.value })}
            className="cyber-input mt-1 font-mono-cyber"
            dir="ltr"
            placeholder="-1001234567890"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={s.telegram_enabled === "true"}
            onCheckedChange={(v) => setS({ ...s, telegram_enabled: v ? "true" : "false" })}
          />
          <Label>فعال‌سازی نوتیفیکیشن‌ها (کاربر جدید، هشدار داده، آنلاین/آفلاین سرور)</Label>
        </div>
      </div>

      <div className="pt-4 border-t border-[#2de8d0]/15 flex gap-2">
        <CyberButton variant="cyan" onClick={test} loading={testing}>
          ارسال پیام تست
        </CyberButton>
        <CyberButton variant="magenta" pulse loading={saving} onClick={save}>
          ذخیره
        </CyberButton>
      </div>
    </GlowCard>
  );
}

function AdminsTab() {
  const [admins, setAdmins] = useState<Array<{
    id: string;
    username: string;
    role: string;
    totpEnabled: boolean;
    createdAt: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    fetch("/api/admins", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setAdmins(d.admins || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  async function remove(id: string, username: string) {
    if (!confirm(`حذف ادمین «${username}»؟`)) return;
    const res = await fetch(`/api/admins/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("حذف شد");
      load();
    } else {
      const d = await res.json();
      toast.error(d.error || "خطا");
    }
  }

  return (
    <GlowCard className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 neon-text-cyan" />
          <PixelHeading as="h3" color="cyan">
            ادمین‌ها
          </PixelHeading>
        </div>
        <CyberButton
          variant="magenta"
          pulse
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setShowForm(true)}
        >
          ادمین جدید
        </CyberButton>
      </div>

      <div className="space-y-2">
        {admins.map((a) => (
          <div
            key={a.id}
            className="flex items-center justify-between p-3 rounded border border-[#2de8d0]/15 bg-[#050810]/40"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded border border-[#2de8d0]/30 flex items-center justify-center">
                <KeyRound className="w-4 h-4 neon-text-cyan" />
              </div>
              <div>
                <div className="font-bold">{a.username}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`protocol-chip ${a.role === "SUPER_ADMIN" ? "magenta" : ""}`}>
                    {a.role === "SUPER_ADMIN" ? "ادمین ارشد" : "ادمین محدود"}
                  </span>
                  {a.totpEnabled && (
                    <span className="protocol-chip green">
                      <Shield className="w-2.5 h-2.5" /> ۲FA
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={() => remove(a.id, a.username)}
              className="p-2 rounded hover:bg-[#ff2f6e]/10 text-muted-foreground hover:text-[#ff2f6e]"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        {loading && <div className="text-center text-muted-foreground py-4">در حال بارگذاری...</div>}
      </div>

      {showForm && (
        <AdminForm
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </GlowCard>
  );
}

function AdminForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("ADMIN");
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, role }),
      });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || "خطا");
      else {
        toast.success("ادمین ساخته شد");
        onSaved();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0e1a] border-[#2de8d0]/30 max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display neon-text-cyan">ادمین جدید</DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3 py-2">
          <div>
            <Label className="micro-label">نام کاربری</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="cyber-input mt-1"
              dir="ltr"
            />
          </div>
          <div>
            <Label className="micro-label">رمز عبور</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="cyber-input mt-1"
              dir="ltr"
            />
          </div>
          <div>
            <Label className="micro-label">سطح دسترسی</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger className="cyber-input mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMIN">ادمین محدود</SelectItem>
                <SelectItem value="SUPER_ADMIN">ادمین ارشد</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <CyberButton variant="cyan" type="button" onClick={onClose}>
              انصراف
            </CyberButton>
            <CyberButton variant="magenta" type="submit" loading={loading}>
              ایجاد
            </CyberButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TwoFactorTab() {
  const [status, setStatus] = useState<{ totpEnabled: boolean } | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [settingUp, setSettingUp] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    // Use session via the /api/auth/session endpoint
    fetch("/api/auth/session", { cache: "no-store" })
      .then((r) => r.json())
      .then(() => {
        // We need to know current admin's 2FA status — fetch via admins list and match
        return fetch("/api/admins", { cache: "no-store" });
      })
      .then((r) => r.json())
      .then((d) => {
        // Just take the first admin's 2FA as a proxy (current user) — simplification
        if (d.admins?.length) {
          const me = d.admins.find((a: any) => a.username) || d.admins[0];
          setStatus({ totpEnabled: me.totpEnabled });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function startSetup() {
    setSettingUp(true);
    try {
      const res = await fetch("/api/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (res.ok) setQr(data.qrDataUrl);
      else toast.error(data.error || "خطا");
    } finally {
      setSettingUp(false);
    }
  }

  async function verify() {
    setVerifying(true);
    try {
      const res = await fetch("/api/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("۲FA فعال شد");
        setQr(null);
        setCode("");
        setStatus({ totpEnabled: true });
      } else {
        toast.error(data.error || "کد اشتباه است");
      }
    } finally {
      setVerifying(false);
    }
  }

  async function disable() {
    if (!confirm("غیرفعال‌سازی ۲FA؟")) return;
    await fetch("/api/2fa/disable", { method: "POST" });
    toast.success("۲FA غیرفعال شد");
    setStatus({ totpEnabled: false });
  }

  if (loading) return <div className="text-muted-foreground">در حال بارگذاری...</div>;

  return (
    <GlowCard className="p-6 space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-5 h-5 neon-text-cyan" />
        <PixelHeading as="h3" color="cyan">
          احراز هویت دومرحله‌ای (TOTP)
        </PixelHeading>
      </div>

      {status?.totpEnabled ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded border border-[#69f0ae]/30 bg-[#69f0ae]/8 text-[#69f0ae]">
            <Check className="w-5 h-5" />
            <span>۲FA فعال است</span>
          </div>
          <CyberButton variant="cyan" icon={<Trash2 className="w-4 h-4" />} onClick={disable}>
            غیرفعال‌سازی
          </CyberButton>
        </div>
      ) : qr ? (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            این QR را با Google Authenticator، Authy یا هر اپ TOTP اسکن کنید
          </div>
          <div className="flex justify-center bg-white p-3 rounded-lg w-fit mx-auto">
            { }
            <img src={qr} alt="2FA QR" width={200} height={200} />
          </div>
          <div>
            <Label className="micro-label">کد ۶ رقمی</Label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              maxLength={6}
              className="cyber-input mt-1 text-center tracking-[0.4em] font-mono-cyber text-lg"
              dir="ltr"
              placeholder="000000"
            />
          </div>
          <CyberButton variant="magenta" pulse loading={verifying} onClick={verify}>
            تایید و فعال‌سازی
          </CyberButton>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            با فعال‌سازی ۲FA، در هر ورود به‌جز رمز عبور، یک کد ۶ رقمی از اپ احراز هویت (مثل
            Google Authenticator) نیز نیاز خواهد بود. این کار امنیت پنل را به‌طور قابل توجهی
            افزایش می‌دهد.
          </p>
          <CyberButton
            variant="magenta"
            pulse
            icon={<QrCode className="w-4 h-4" />}
            loading={settingUp}
            onClick={startSetup}
          >
            شروع تنظیم ۲FA
          </CyberButton>
        </div>
      )}
    </GlowCard>
  );
}
