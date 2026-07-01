"use client";

import { useEffect, useState } from "react";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { MicroLabel } from "@/components/cyber/micro-label";
import { Terminal, Activity, Clock, Users, Wifi, Server } from "lucide-react";
import { formatUptime } from "@/lib/format";
import { toPersianDigits } from "@/lib/jalali";

interface Status {
  online: boolean;
  xrayRunning: boolean;
  xrayMode: string;
  uptimeSeconds: number;
  totalUsers: number;
  enabledUsers: number;
  timestamp: string;
}

export default function StatusPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/public/status", { cache: "no-store" });
        if (res.ok) {
          setStatus(await res.json());
        }
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-arcade particles-bg flex items-center justify-center p-4 relative">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2de8d0] to-transparent opacity-60" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#ff2f6e] to-transparent opacity-50" />

      <div className="relative-z w-full max-w-3xl space-y-6 animate-fade-slide">
        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg neon-border-cyan mb-3 animate-cyan-breath">
            <Terminal className="w-8 h-8 neon-text-cyan" />
          </div>
          <PixelHeading as="h1" color="cyan">
            صفحه وضعیت
          </PixelHeading>
          <MicroLabel color="cyan" className="mt-2 block">
            CyberX VPN Panel
          </MicroLabel>
        </div>

        {/* Main status */}
        <div
          className={`cyber-card ${
            status?.online ? "neon-glow-cyan" : "neon-glow-magenta cyber-card-magenta"
          } p-8 text-center`}
        >
          <div
            className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
              status?.online
                ? "border-2 border-[#69f0ae] animate-status-blink"
                : "border-2 border-[#ff2f6e]"
            }`}
          >
            <div
              className={`w-6 h-6 rounded-full ${
                status?.online ? "bg-[#69f0ae]" : "bg-[#ff2f6e]"
              }`}
            />
          </div>
          <PixelHeading as="h2" color={status?.online ? "green" : "magenta"}>
            {loading
              ? "در حال بررسی..."
              : status?.online
              ? "سامانه آنلاین است"
              : "سامانه آفلاین است"}
          </PixelHeading>
          {status && (
            <div className="text-xs text-muted-foreground mt-2">
              آخرین به‌روزرسانی:{" "}
              {new Date(status.timestamp).toLocaleString("fa-IR")}
            </div>
          )}
        </div>

        {/* Service status grid */}
        {status && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ServiceCard
              name="Xray-core"
              ok={status.xrayRunning}
              detail={
                status.xrayRunning
                  ? `در حال اجرا — ${status.xrayMode === "live" ? "حالت زنده" : "حالت شبیه‌سازی"}`
                  : "متوقف"
              }
              icon={<Server className="w-5 h-5" />}
            />
            <ServiceCard
              name="سرور وب"
              ok={status.online}
              detail="پنل مدیریت در دسترس است"
              icon={<Activity className="w-5 h-5" />}
            />
            <ServiceCard
              name="کاربران فعال"
              ok={true}
              detail={`${toPersianDigits(status.enabledUsers)} کاربر از ${toPersianDigits(
                status.totalUsers
              )} کل`}
              icon={<Users className="w-5 h-5" />}
            />
            <ServiceCard
              name="آپ‌تایم سرور"
              ok={true}
              detail={formatUptime(status.uptimeSeconds)}
              icon={<Clock className="w-5 h-5" />}
            />
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <Wifi className="w-3 h-3 neon-text-cyan" />
            <span>به‌روزرسانی خودکار هر ۵ ثانیه</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceCard({
  name,
  ok,
  detail,
  icon,
}: {
  name: string;
  ok: boolean;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="cyber-card p-4 flex items-center gap-3">
      <div
        className={`w-10 h-10 rounded border flex items-center justify-center flex-shrink-0 ${
          ok
            ? "border-[#69f0ae]/40 text-[#69f0ae]"
            : "border-[#ff2f6e]/40 text-[#ff2f6e]"
        }`}
      >
        {icon}
      </div>
      <div className="flex-1">
        <div className="font-bold text-sm">{name}</div>
        <div className="text-xs text-muted-foreground">{detail}</div>
      </div>
      <div
        className={`w-3 h-3 rounded-full flex-shrink-0 ${
          ok ? "bg-[#69f0ae] animate-status-blink" : "bg-[#ff2f6e]"
        }`}
      />
    </div>
  );
}
