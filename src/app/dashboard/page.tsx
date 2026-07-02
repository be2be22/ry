"use client";

import { useEffect, useState } from "react";
import {
  Cpu,
  MemoryStick,
  HardDrive,
  Clock,
  ArrowUpCircle,
  ArrowDownCircle,
  Users,
  Wifi,
  Power,
  RefreshCw,
  AlertCircle,
  Play,
  Square,
} from "lucide-react";
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from "recharts";
import { StatTile } from "@/components/cyber/stat-tile";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { MicroLabel } from "@/components/cyber/micro-label";
import { GlowCard } from "@/components/cyber/glow-card";
import { useXray } from "@/components/xray-provider";
import { formatBytes, formatUptime } from "@/lib/format";
import { toPersianDigits } from "@/lib/jalali";
import { toast } from "sonner";

interface Stats {
  server: {
    cpuPercent: number;
    cpuCores: number;
    cpuModel: string;
    ramPercent: number;
    ramUsedBytes: number;
    ramTotalBytes: number;
    diskPercent: number;
    diskUsedBytes: number;
    diskTotalBytes: number;
    diskFreeBytes: number;
    uptimeSeconds: number;
    loadAvg: number[];
    platform: string;
    arch: string;
    hostname: string;
  };
  users: {
    total: number;
    expired: number;
    enabled: number;
    online: number;
    totalUsedBytes: string;
  };
  traffic: {
    hourly: { ts: number; up: number; down: number }[];
    totalUpBytes: number;
    totalDownBytes: number;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const { state: xrayState, restart: xrayRestart, start: xrayStart, stop: xrayStop } = useXray();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const res = await fetch("/api/stats", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (mounted) setStats(data);
        }
      } catch {
        /* ignore */
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 3000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, []);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        <RefreshCw className="w-6 h-6 animate-spin neon-text-cyan" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96 text-[#ff2f6e]">
        <AlertCircle className="w-6 h-6 ml-2" /> خطا در بارگذاری آمار
      </div>
    );
  }

  const trafficData = stats.traffic.hourly.map((b) => ({
    time: new Date(b.ts).toLocaleTimeString("fa-IR", { hour: "2-digit", minute: "2-digit" }),
    آپلود: Math.round(b.up / 1024 / 1024),
    دانلود: Math.round(b.down / 1024 / 1024),
  }));

  return (
    <div className="space-y-6 animate-fade-slide">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <PixelHeading as="h1" color="cyan">
            داشبورد
          </PixelHeading>
          <MicroLabel className="mt-1 block">مشاهده زنده وضعیت سرور و کاربران</MicroLabel>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-[#69f0ae] animate-status-blink" />
          <span>به‌روزرسانی هر ۳ ثانیه</span>
        </div>
      </div>

      {/* Stat tiles row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="پردازنده"
          value={`${toPersianDigits(stats.server.cpuPercent)}٪`}
          sub={`${stats.server.cpuCores} هسته — ${stats.server.cpuModel.slice(0, 30)}`}
          icon={<Cpu className="w-5 h-5" />}
          progress={stats.server.cpuPercent}
          accent="cyan"
        />
        <StatTile
          label="حافظه"
          value={`${toPersianDigits(stats.server.ramPercent)}٪`}
          sub={`${formatBytes(stats.server.ramUsedBytes)} از ${formatBytes(stats.server.ramTotalBytes)}`}
          icon={<MemoryStick className="w-5 h-5" />}
          progress={stats.server.ramPercent}
          accent="magenta"
        />
        <StatTile
          label="دیسک"
          value={`${toPersianDigits(stats.server.diskPercent)}٪`}
          sub={`${formatBytes(stats.server.diskFreeBytes)} آزاد`}
          icon={<HardDrive className="w-5 h-5" />}
          progress={stats.server.diskPercent}
          accent="yellow"
        />
        <StatTile
          label="آپ‌تایم"
          value={formatUptime(stats.server.uptimeSeconds)}
          sub={`${stats.server.hostname} • ${stats.server.platform}/${stats.server.arch}`}
          icon={<Clock className="w-5 h-5" />}
          accent="green"
        />
      </div>

      {/* User counters + Xray status row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile
          label="کاربران آنلاین"
          value={toPersianDigits(stats.users.online)}
          icon={<Wifi className="w-5 h-5" />}
          accent="green"
        />
        <StatTile
          label="کل کاربران"
          value={toPersianDigits(stats.users.total)}
          sub={`${toPersianDigits(stats.users.enabled)} فعال`}
          icon={<Users className="w-5 h-5" />}
          accent="cyan"
        />
        <StatTile
          label="منقضی شده"
          value={toPersianDigits(stats.users.expired)}
          icon={<Clock className="w-5 h-5" />}
          accent="magenta"
        />
        <GlowCard className="p-4 flex flex-col gap-2" variant={xrayState?.running ? "cyan" : "magenta"}>
          <div className="flex items-center justify-between">
            <MicroLabel color={xrayState?.running ? "cyan" : "magenta"}>وضعیت Xray</MicroLabel>
            <div className="flex gap-1">
              {xrayState?.running ? (
                <>
                  <button
                    onClick={async () => {
                      const t = toast.loading("در حال ری‌استارت Xray...");
                      const r = await xrayRestart();
                      if (r?.ok) toast.success("Xray ری‌استارت شد", { id: t });
                      else toast.error(r?.message || "خطا در ری‌استارت", { id: t, duration: 10000 });
                    }}
                    className="p-2 rounded border border-[#ff2f6e]/40 text-[#ff2f6e] hover:bg-[#ff2f6e]/10 transition-all"
                    title="ری‌استارت"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      const t = toast.loading("در حال توقف Xray...");
                      await xrayStop();
                      toast.success("Xray متوقف شد", { id: t });
                    }}
                    className="p-2 rounded border border-[#ff3b3b]/40 text-[#ff3b3b] hover:bg-[#ff3b3b]/10 transition-all"
                    title="توقف"
                  >
                    <Square className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <button
                  onClick={async () => {
                    const t = toast.loading("در حال شروع Xray...");
                    const r = await xrayStart();
                    if (r?.ok) toast.success(r.message || "Xray شروع شد", { id: t });
                    else
                      toast.error(r?.message || "خطا در شروع Xray", {
                        id: t,
                        duration: 15000,
                      });
                  }}
                  className="p-2 rounded border border-[#69f0ae]/40 text-[#69f0ae] hover:bg-[#69f0ae]/10 transition-all animate-cyan-breath"
                  title="شروع"
                >
                  <Play className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          <div
            className={`text-2xl font-bold font-mono-cyber ${
              xrayState?.running ? "neon-text-cyan" : "neon-text-magenta"
            }`}
          >
            {xrayState?.running ? "در حال اجرا" : "متوقف"}
          </div>
          <div className="text-xs text-muted-foreground">
            {xrayState?.mode === "live" ? "حالت زنده" : "حالت شبیه‌سازی"}
            {xrayState?.pid && ` • PID: ${xrayState.pid}`}
            {xrayState?.binaryStat && !xrayState.binaryStat.exists && (
              <span className="block neon-text-magenta mt-1">
                ⚠ باینری Xray یافت نشد: {xrayState.binaryStat.path}
              </span>
            )}
          </div>
          {xrayState?.lastError && !xrayState.running && (
            <div className="text-[10px] text-[#ff2f6e] bg-[#ff2f6e]/8 border border-[#ff2f6e]/30 p-2 rounded max-h-32 overflow-y-auto" dir="ltr">
              {xrayState.lastError}
            </div>
          )}
        </GlowCard>
      </div>

      {/* Traffic chart + Radial gauges */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GlowCard className="lg:col-span-2 p-4 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <PixelHeading as="h3" color="cyan">
              ترافیک ۲۴ ساعت گذشته
            </PixelHeading>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#2de8d0]" /> آپلود
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-[#ff2f6e]" /> دانلود
              </span>
            </div>
          </div>
          <div className="h-64" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trafficData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                <defs>
                  <linearGradient id="upGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2de8d0" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#2de8d0" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="downGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff2f6e" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#ff2f6e" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,232,208,0.08)" />
                <XAxis
                  dataKey="time"
                  stroke="#6b7a9a"
                  tick={{ fill: "#6b7a9a", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(45,232,208,0.15)" }}
                />
                <YAxis
                  stroke="#6b7a9a"
                  tick={{ fill: "#6b7a9a", fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(45,232,208,0.15)" }}
                  tickFormatter={(v) => `${v}م`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#0a0e1a",
                    border: "1px solid rgba(45,232,208,0.3)",
                    borderRadius: "0.5rem",
                    color: "#e8f7ff",
                  }}
                  labelStyle={{ color: "#2de8d0", fontFamily: "monospace" }}
                />
                <Area
                  type="monotone"
                  dataKey="آپلود"
                  stroke="#2de8d0"
                  strokeWidth={2}
                  fill="url(#upGrad)"
                  animationDuration={400}
                />
                <Area
                  type="monotone"
                  dataKey="دانلود"
                  stroke="#ff2f6e"
                  strokeWidth={2}
                  fill="url(#downGrad)"
                  animationDuration={400}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </GlowCard>

        {/* Radial gauges */}
        <GlowCard className="p-4 md:p-6">
          <PixelHeading as="h3" color="magenta" className="mb-4">
            مصرف منابع
          </PixelHeading>
          <div className="space-y-4">
            <RadialGauge
              value={stats.server.cpuPercent}
              label="پردازنده"
              color="#2de8d0"
            />
            <RadialGauge
              value={stats.server.ramPercent}
              label="حافظه"
              color="#ff2f6e"
            />
            <RadialGauge
              value={stats.server.diskPercent}
              label="دیسک"
              color="#ffd54f"
            />
          </div>
        </GlowCard>
      </div>

      {/* Total traffic + load average */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <GlowCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded border border-[#2de8d0]/40 flex items-center justify-center">
            <ArrowUpCircle className="w-6 h-6 neon-text-cyan" />
          </div>
          <div>
            <MicroLabel>ترافیک آپلود کل</MicroLabel>
            <div className="text-xl font-bold font-mono-cyber neon-text-cyan">
              {formatBytes(stats.traffic.totalUpBytes)}
            </div>
          </div>
        </GlowCard>
        <GlowCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded border border-[#ff2f6e]/40 flex items-center justify-center">
            <ArrowDownCircle className="w-6 h-6 neon-text-magenta" />
          </div>
          <div>
            <MicroLabel>ترافیک دانلود کل</MicroLabel>
            <div className="text-xl font-bold font-mono-cyber neon-text-magenta">
              {formatBytes(stats.traffic.totalDownBytes)}
            </div>
          </div>
        </GlowCard>
        <GlowCard className="p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded border border-[#b388ff]/40 flex items-center justify-center">
            <Power className="w-6 h-6 neon-text-purple" />
          </div>
          <div>
            <MicroLabel>میانگین بار سرور</MicroLabel>
            <div className="text-xl font-bold font-mono-cyber neon-text-purple">
              {stats.server.loadAvg.map((v) => toPersianDigits(v.toFixed(2))).join(" / ")}
            </div>
          </div>
        </GlowCard>
      </div>
    </div>
  );
}

function RadialGauge({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: string;
}) {
  const data = [{ name: label, value: Math.min(100, value), fill: color }];
  return (
    <div className="flex items-center gap-4">
      <div className="w-20 h-20" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="70%"
            outerRadius="100%"
            data={data}
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            <RadialBar background={{ fill: "rgba(45,232,208,0.08)" }} dataKey="value" cornerRadius={8} />
          </RadialBarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <MicroLabel>{label}</MicroLabel>
        <div className="text-xl font-bold font-mono-cyber" style={{ color }}>
          {toPersianDigits(value)}٪
        </div>
      </div>
    </div>
  );
}
