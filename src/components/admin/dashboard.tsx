"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Server as ServerIcon,
  Users as UsersIcon,
  Settings2,
  TrendingUp,
  Upload,
  Download,
  Globe,
  Cpu,
  Zap,
  Database,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import { formatBytes, toPersianDigits, formatPersianDate } from "@/lib/v2ray";

interface Stats {
  configs: { total: number; active: number; disabled: number; expired: number };
  servers: { total: number; active: number };
  users: { total: number; active: number };
  traffic: { total: number | string; upload: number | string; download: number | string };
  byType: { type: string; count: number }[];
  byStatus: { status: string; count: number }[];
  dailyCounts: { date: string; count: number }[];
  topServers: { id: string; name: string; location?: string | null; configCount: number }[];
  recentLogs: { id: string; action: string; entity: string; detail?: string | null; createdAt: string }[];
}

const TYPE_COLORS: Record<string, string> = {
  vmess: "oklch(0.65 0.25 290)",
  vless: "oklch(0.7 0.2 200)",
  trojan: "oklch(0.78 0.22 60)",
};

const STATUS_COLORS: Record<string, string> = {
  active: "oklch(0.7 0.18 150)",
  disabled: "oklch(0.7 0.15 70)",
  expired: "oklch(0.65 0.24 25)",
};

export function Dashboard({ onSeed }: { onSeed?: () => Promise<void> }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.ok) setStats(data.stats);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl h-32 animate-shimmer" />
        ))}
      </div>
    );
  }

  const dailyChartData = stats.dailyCounts.map((d) => ({
    ...d,
    date: toPersianDigits(d.date.slice(5)),
  }));

  const typeChartData = stats.byType.map((t) => ({
    name: t.type.toUpperCase(),
    value: t.count,
    color: TYPE_COLORS[t.type] || "oklch(0.6 0.2 280)",
  }));

  const statCards = [
    {
      title: "کل کانفیگ‌ها",
      value: stats.configs.total,
      sub: `${toPersianDigits(stats.configs.active)} فعال`,
      icon: Settings2,
      gradient: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
    },
    {
      title: "سرورها",
      value: stats.servers.total,
      sub: `${toPersianDigits(stats.servers.active)} فعال`,
      icon: ServerIcon,
      gradient: "linear-gradient(135deg, oklch(0.7 0.2 200), oklch(0.65 0.18 240))",
    },
    {
      title: "کاربران",
      value: stats.users.total,
      sub: `${toPersianDigits(stats.users.active)} فعال`,
      icon: UsersIcon,
      gradient: "linear-gradient(135deg, oklch(0.78 0.22 60), oklch(0.7 0.18 100))",
    },
    {
      title: "ترافیک کل",
      value: formatBytes(stats.traffic.total),
      sub: `↑ ${formatBytes(stats.traffic.upload)} ↓ ${formatBytes(stats.traffic.download)}`,
      icon: Activity,
      gradient: "linear-gradient(135deg, oklch(0.7 0.18 150), oklch(0.65 0.2 180))",
      isString: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">داشبورد مدیریتی</h1>
          <p className="text-sm text-muted-foreground mt-1">
            نمای کلی سیستم FastApiCloud — به‌روزرسانی لحظه‌ای
          </p>
        </div>
        {stats.configs.total === 0 && (
          <button
            onClick={async () => {
              if (onSeed) await onSeed();
              await load();
            }}
            className="glass-input rounded-xl px-4 py-2 text-sm font-medium hover:scale-105 transition-transform flex items-center gap-2"
          >
            <Zap className="w-4 h-4 text-primary" />
            بارگذاری داده‌های نمونه
          </button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="glass rounded-2xl p-5 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 opacity-20 -translate-y-8 translate-x-8 rounded-full blur-2xl"
                style={{ background: card.gradient }}
              />
              <div className="flex items-start justify-between mb-3 relative">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
                  style={{ background: card.gradient }}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <TrendingUp className="w-4 h-4 text-muted-foreground/50" />
              </div>
              <div className="text-3xl font-bold mb-1">
                {card.isString ? card.value : toPersianDigits(card.value)}
              </div>
              <div className="text-sm text-muted-foreground">{card.title}</div>
              <div className="text-xs text-muted-foreground/70 mt-1">{card.sub}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Xray Connection Status */}
      <XrayStatusPanel />

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Daily config creation chart */}
        <div className="glass rounded-2xl p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">روند ساخت کانفیگ</h3>
              <p className="text-xs text-muted-foreground">۷ روز اخیر</p>
            </div>
            <Database className="w-5 h-5 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={dailyChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorConfigs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.65 0.25 290)" stopOpacity={0.6} />
                  <stop offset="95%" stopColor="oklch(0.65 0.25 290)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8)" />
              <XAxis
                dataKey="date"
                tick={{ fill: "oklch(0.7 0.02 280)", fontSize: 11 }}
                stroke="oklch(0.5 0.02 280)"
              />
              <YAxis
                tick={{ fill: "oklch(0.7 0.02 280)", fontSize: 11 }}
                stroke="oklch(0.5 0.02 280)"
                tickFormatter={(v) => toPersianDigits(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.16 0.03 280 / 90%)",
                  border: "1px solid oklch(1 0 0 / 12%)",
                  borderRadius: "12px",
                  backdropFilter: "blur(12px)",
                  color: "white",
                }}
                labelStyle={{ color: "white" }}
                formatter={(v: number) => [toPersianDigits(v) + " کانفیگ", "تعداد"]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="oklch(0.65 0.25 290)"
                strokeWidth={2}
                fill="url(#colorConfigs)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Type distribution pie */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">توزیع نوع کانفیگ</h3>
              <p className="text-xs text-muted-foreground">بر اساس پروتکل</p>
            </div>
            <Cpu className="w-5 h-5 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={typeChartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={50}
                paddingAngle={4}
              >
                {typeChartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "oklch(0.16 0.03 280 / 90%)",
                  border: "1px solid oklch(1 0 0 / 12%)",
                  borderRadius: "12px",
                  color: "white",
                }}
                formatter={(v: number) => toPersianDigits(v) + " کانفیگ"}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px", color: "oklch(0.7 0.02 280)" }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top servers + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top servers bar chart */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">سرورهای پرکانفیگ</h3>
              <p className="text-xs text-muted-foreground">بیشترین کانفیگ فعال</p>
            </div>
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={stats.topServers.map((s) => ({
                name: s.name.replace("FastApiCloud-", ""),
                count: s.configCount,
                location: s.location || "",
              }))}
              margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8)" />
              <XAxis
                dataKey="name"
                tick={{ fill: "oklch(0.7 0.02 280)", fontSize: 10 }}
                stroke="oklch(0.5 0.02 280)"
              />
              <YAxis
                tick={{ fill: "oklch(0.7 0.02 280)", fontSize: 11 }}
                stroke="oklch(0.5 0.02 280)"
                tickFormatter={(v) => toPersianDigits(v)}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.16 0.03 280 / 90%)",
                  border: "1px solid oklch(1 0 0 / 12%)",
                  borderRadius: "12px",
                  color: "white",
                }}
                formatter={(v: number) => [toPersianDigits(v), "کانفیگ"]}
              />
              <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                {stats.topServers.map((_, i) => (
                  <Cell
                    key={i}
                    fill={
                      i === 0 ? "oklch(0.65 0.25 290)"
                      : i === 1 ? "oklch(0.7 0.2 320)"
                      : i === 2 ? "oklch(0.7 0.2 200)"
                      : "oklch(0.7 0.18 150)"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent activity */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">فعالیت‌های اخیر</h3>
              <p className="text-xs text-muted-foreground">آخرین رویدادهای سیستم</p>
            </div>
            <Activity className="w-5 h-5 text-primary" />
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {stats.recentLogs.length === 0 ? (
              <div className="text-center text-sm text-muted-foreground py-8">
                هنوز فعالیتی ثبت نشده است
              </div>
            ) : (
              stats.recentLogs.map((log) => (
                <div key={log.id} className="glass rounded-xl p-3 flex items-start gap-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{
                      background:
                        log.action === "create" ? "oklch(0.7 0.18 150)"
                        : log.action === "update" ? "oklch(0.7 0.2 200)"
                        : log.action === "delete" ? "oklch(0.65 0.24 25)"
                        : "oklch(0.6 0.2 280)",
                    }}
                  >
                    {log.action === "create" ? "+" : log.action === "update" ? "✎" : log.action === "delete" ? "×" : "•"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">{log.detail || log.action}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {formatPersianDate(log.createdAt)}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Traffic breakdown */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">تفکیک ترافیک</h3>
            <p className="text-xs text-muted-foreground">آپلود و دانلود کل</p>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5">
              <Upload className="w-3 h-3 text-primary" />
              آپلود
            </span>
            <span className="flex items-center gap-1.5">
              <Download className="w-3 h-3 text-accent" />
              دانلود
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">آپلود کل</div>
            <div className="text-xl font-bold text-primary">{formatBytes(stats.traffic.upload)}</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">دانلود کل</div>
            <div className="text-xl font-bold text-accent">{formatBytes(stats.traffic.download)}</div>
          </div>
          <div className="glass rounded-xl p-4">
            <div className="text-xs text-muted-foreground mb-1">مجموع مصرف</div>
            <div className="text-xl font-bold gradient-text">{formatBytes(stats.traffic.total)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Xray Local Status Panel
 * Shows the live status of the local Xray process running on the same host.
 */
function XrayStatusPanel() {
  const [status, setStatus] = useState<{
    running: boolean;
    pid?: number;
    publicHost: string;
    publicPort: number;
    clientCount?: number;
    inboundCount?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch("/api/xray/status");
      const data = await res.json();
      if (data.ok) setStatus(data.status);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, []);

  const start = async () => {
    setActionLoading(true);
    try {
      const res = await fetch("/api/xray/start", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast.success("Xray اجرا شد");
      } else {
        toast.error(data.error || "خطا در اجرای Xray");
      }
      load();
    } catch {
      toast.error("خطای شبکه");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="glass rounded-2xl h-32 animate-shimmer" />;
  }

  const isRunning = status?.running ?? false;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
            style={{
              background: isRunning
                ? "linear-gradient(135deg, oklch(0.7 0.18 150), oklch(0.65 0.2 180))"
                : "linear-gradient(135deg, oklch(0.6 0.1 280), oklch(0.5 0.1 280))",
            }}
          >
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold">سرور Xray محلی</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: isRunning ? "oklch(0.7 0.18 150)" : "oklch(0.6 0.1 280)",
                  boxShadow: isRunning ? "0 0 8px oklch(0.7 0.18 150 / 60%)" : "none",
                }}
              />
              <p className="text-xs text-muted-foreground">
                {isRunning
                  ? `در حال اجرا — ${toPersianDigits(status?.clientCount || 0)} کلاینت فعال`
                  : "متوقف"}
              </p>
            </div>
          </div>
        </div>
        {!isRunning && (
          <button
            onClick={start}
            disabled={actionLoading}
            className="rounded-xl px-3 py-2 text-xs font-medium text-white flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: "linear-gradient(120deg, oklch(0.7 0.18 150), oklch(0.65 0.2 180))" }}
          >
            {actionLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            اجرای Xray
          </button>
        )}
      </div>

      {isRunning ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="glass rounded-lg p-2.5">
            <div className="text-[10px] text-muted-foreground mb-0.5">آدرس اتصال</div>
            <div className="text-xs font-mono font-bold" dir="ltr">
              {status?.publicHost}:{status?.publicPort}
            </div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-[10px] text-muted-foreground mb-0.5">PID</div>
            <div className="text-xs font-mono font-bold">{toPersianDigits(status?.pid || 0)}</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-[10px] text-muted-foreground mb-0.5">Inbound ها</div>
            <div className="text-xs font-bold">{toPersianDigits(status?.inboundCount || 0)}</div>
          </div>
          <div className="glass rounded-lg p-2.5">
            <div className="text-[10px] text-muted-foreground mb-0.5">کلاینت‌ها</div>
            <div className="text-xs font-bold">{toPersianDigits(status?.clientCount || 0)}</div>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">
          برای شروع، روی دکمه «اجرای Xray» کلیک کنید یا به بخش «تنظیمات» بروید
        </div>
      )}
    </motion.div>
  );
}
