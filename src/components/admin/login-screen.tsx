"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Lock, User, Cloud, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";

interface LoginScreenProps {
  onLogin: (admin: { id: string; username: string; role: string; email?: string | null }) => void;
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("نام کاربری و رمز عبور را وارد کنید");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast.error(data.error || "ورود ناموفق بود");
        return;
      }
      toast.success("خوش آمدید!");
      onLogin(data.admin);
    } catch {
      toast.error("خطای شبکه هنگام ورود");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Animated background blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <motion.div
          className="absolute top-[-10%] right-[-10%] w-[480px] h-[480px] rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.65 0.25 290 / 35%), transparent 70%)" }}
          animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-10%] left-[-10%] w-[520px] h-[520px] rounded-full"
          style={{ background: "radial-gradient(circle, oklch(0.7 0.2 320 / 30%), transparent 70%)" }}
          animate={{ x: [0, 50, 0], y: [0, -30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="glass-strong rounded-3xl p-8 sm:p-10 w-full max-w-md gradient-border"
      >
        {/* Logo + Title */}
        <div className="flex flex-col items-center text-center mb-8">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4 animate-pulse-glow"
            style={{
              background: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
            }}
          >
            <Cloud className="w-10 h-10 text-white" strokeWidth={2.5} />
          </motion.div>
          <h1 className="text-2xl font-bold gradient-text">FastApiCloud</h1>
          <p className="text-sm text-muted-foreground mt-1">
            پنل مدیریت کانفیگ‌های V2Ray/Xray WebSocket
          </p>
        </div>

        {/* Feature badges */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="glass rounded-xl p-3 text-center">
            <ShieldCheck className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-[10px] text-muted-foreground">امن TLS</span>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <Zap className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-[10px] text-muted-foreground">سرعت بالا</span>
          </div>
          <div className="glass rounded-xl p-3 text-center">
            <Cloud className="w-5 h-5 mx-auto mb-1 text-primary" />
            <span className="text-[10px] text-muted-foreground">CDN جهانی</span>
          </div>
        </div>

        {/* Login form */}
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">نام کاربری</label>
            <div className="relative">
              <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="glass-input w-full rounded-xl py-3 pr-10 pl-4 text-sm outline-none"
                placeholder="admin"
                dir="ltr"
                autoComplete="username"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">رمز عبور</label>
            <div className="relative">
              <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="glass-input w-full rounded-xl py-3 pr-10 pl-4 text-sm outline-none"
                placeholder="••••••••"
                dir="ltr"
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 rounded-xl py-3 font-semibold text-white transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 disabled:hover:scale-100 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(120deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
              boxShadow: "0 8px 24px oklch(0.65 0.25 290 / 35%)",
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                در حال ورود...
              </>
            ) : (
              "ورود به پنل"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-muted-foreground">
            پیش‌فرض: <span className="font-mono text-foreground" dir="ltr">admin / admin123</span>
          </p>
        </div>
      </motion.div>

      <div className="absolute bottom-4 text-xs text-muted-foreground/60">
        © 2026 FastApiCloud.com — همه حقوق محفوظ است
      </div>
    </div>
  );
}
