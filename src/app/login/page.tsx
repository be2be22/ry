"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { CyberButton } from "@/components/cyber/cyber-button";
import { MicroLabel } from "@/components/cyber/micro-label";
import { Terminal, Lock, User, Shield, Loader2, AlertTriangle, Zap } from "lucide-react";
import { toast } from "sonner";

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-arcade" />}>
      <LoginInner />
    </Suspense>
  );
}

function LoginInner() {
  const router = useRouter();
  const search = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [needsTotp, setNeedsTotp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = search.get("callbackUrl") || "/dashboard";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await signIn("credentials", {
        username,
        password,
        totp,
        redirect: false,
      });
      if (!res || !res.ok) {
        const err = res?.error || "LOGIN_FAILED";
        if (err === "TOTP_REQUIRED") {
          setNeedsTotp(true);
          setError("کد احراز هویت دومرحله‌ای را وارد کنید");
        } else if (err === "TOO_MANY_ATTEMPTS") {
          setError("تلاش‌های بیش از حد. ۵ دقیقه بعد تلاش کنید.");
        } else {
          setError("نام کاربری یا رمز عبور اشتباه است");
        }
        setLoading(false);
        return;
      }
      toast.success("ورود موفقیت‌آمیز بود");
      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("خطای غیرمنتظره");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-arcade particles-bg flex items-center justify-center p-4 relative overflow-hidden">
      {/* Top scanline glow */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2de8d0] to-transparent opacity-60" />
      {/* Bottom glow */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#ff2f6e] to-transparent opacity-50" />

      <div className="relative-z w-full max-w-md animate-fade-slide">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-lg neon-border-cyan mb-4 animate-cyan-breath">
            <Terminal className="w-10 h-10 neon-text-cyan" />
          </div>
          <PixelHeading as="h1" color="cyan" className="mb-1">
            CyberX
          </PixelHeading>
          <MicroLabel color="cyan">پنل مدیریت VPN</MicroLabel>
          <div className="mt-2 text-xs text-muted-foreground">
            کنترل کامل Xray-core با رابط سایبرپانک
          </div>
        </div>

        {/* Login card */}
        <div className="cyber-card neon-glow-cyan p-6 md:p-8">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="w-4 h-4 neon-text-magenta" />
            <MicroLabel color="magenta">دسترسی امن — INITIATE LOGIN</MicroLabel>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1.5">
                <MicroLabel>نام کاربری</MicroLabel>
              </label>
              <div className="relative">
                <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  autoComplete="username"
                  className="cyber-input w-full pr-10 pl-3 py-2.5"
                  placeholder="admin"
                  dir="ltr"
                />
              </div>
            </div>

            <div>
              <label className="block mb-1.5">
                <MicroLabel>رمز عبور</MicroLabel>
              </label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="cyber-input w-full pr-10 pl-3 py-2.5"
                  placeholder="••••••••"
                  dir="ltr"
                />
              </div>
            </div>

            {needsTotp && (
              <div className="animate-fade-slide">
                <label className="block mb-1.5">
                  <MicroLabel color="cyan">کد ۲FA (۶ رقم)</MicroLabel>
                </label>
                <div className="relative">
                  <Shield className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 neon-text-cyan" />
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={totp}
                    onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                    className="cyber-input w-full pr-10 pl-3 py-2.5 text-center tracking-[0.4em] font-mono-cyber text-lg"
                    placeholder="000000"
                    dir="ltr"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded border border-[#ff2f6e]/40 bg-[#ff2f6e]/10 text-[#ff2f6e] text-sm animate-fade-slide">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <CyberButton
              type="submit"
              variant="magenta"
              pulse
              loading={loading}
              icon={<Zap className="w-4 h-4" />}
              className="w-full py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> در حال اتصال...
                </>
              ) : (
                "اتصال / PLAY"
              )}
            </CyberButton>
          </form>

          <div className="mt-6 pt-4 border-t border-[#2de8d0]/15 text-center">
            <div className="text-xs text-muted-foreground">
              پیش‌فرض: <span className="font-mono-cyber neon-text-cyan">admin</span> /{" "}
              <span className="font-mono-cyber neon-text-cyan">admin12345</span>
            </div>
          </div>
        </div>

        {/* Footer status */}
        <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-[#69f0ae] animate-status-blink" />
          <span>سامانه آنلاین است</span>
          <span className="text-muted-foreground/60">|</span>
          <a href="/status" className="hover:neon-text-cyan transition-colors">
            صفحه وضعیت عمومی
          </a>
        </div>
      </div>
    </div>
  );
}
