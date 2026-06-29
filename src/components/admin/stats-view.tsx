"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  Server as ServerIcon,
  Users as UsersIcon,
  Settings2,
  TrendingUp,
  Globe,
  Cpu,
  Database,
  Upload,
  Download,
  RefreshCw,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadialBarChart,
  RadialBar,
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

const STATUS_LABELS_FA: Record<string, string> = {
  active: "فعال",
  disabled: "غیرفعال",
  expired: "منقضی",
};

export function StatsView() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/stats");
      const data = await res.json();
      if (data.ok) setStats(data.stats);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="glass rounded-2xl h-64 animate-shimmer" />
        ))}
      </div>
    );
  }

  const typeChartData = stats.byType.map((t) => ({
    name: t.type.toUpperCase(),
    value: t.count,
    color: TYPE_COLORS[t.type] || "oklch(0.6 0.2 280)",
  }));

  const statusChartData = stats.byStatus.map((s) => ({
    name: STATUS_LABELS_FA[s.status] || s.status,
    value: s.count,
    color: STATUS_COLORS[s.status] || "oklch(0.6 0.2 280)",
  }));

  const radialData = [
    { name: "فعال", value: stats.configs.active, fill: "oklch(0.7 0.18 150)" },
    { name: "غیرفعال", value: stats.configs.disabled, fill: "oklch(0.7 0.15 70)" },
    { name: "منقضی", value: stats.configs.expired, fill: "oklch(0.65 0.24 25)" },
  ];

  const trafficSplit = [
    { name: "آپلود", value: Number(stats.traffic.upload) || 0, fill: "oklch(0.65 0.25 290)" },
    { name: "دانلود", value: Number(stats.traffic.download) || 0, fill: "oklch(0.7 0.2 320)" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold gradient-text">آمار و گزارش‌ها</h1>
          <p className="text-sm text-muted-foreground mt-1">
            گزارش‌های تفصیلی سیستم FastApiCloud
          </p>
        </div>
        <button
          onClick={load}
          className="glass-input rounded-xl px-4 py-2 text-sm flex items-center gap-2 hover:scale-105 transition-transform"
        >
          <RefreshCw className="w-4 h-4 text-primary" />
          به‌روزرسانی
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "کل کانفیگ‌ها", value: stats.configs.total, icon: Settings2, color: "oklch(0.65 0.25 290)" },
          { label: "کل سرورها", value: stats.servers.total, icon: ServerIcon, color: "oklch(0.7 0.2 200)" },
          { label: "کل کاربران", value: stats.users.total, icon: UsersIcon, color: "oklch(0.78 0.22 60)" },
          { label: "ترافیک کل", value: formatBytes(stats.traffic.total), icon: Activity, color: "oklch(0.7 0.18 150)", isString: true },
        ].map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className="glass rounded-2xl p-4 flex items-center gap-3"
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
                style={{ background: `linear-gradient(135deg, ${c.color}, ${c.color})` }}
              >
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="text-xl font-bold">
                  {c.isString ? c.value : toPersianDigits(c.value)}
                </div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Type pie */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">توزیع پروتکل‌ها</h3>
              <p className="text-xs text-muted-foreground">بر اساس نوع کانفیگ</p>
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
                outerRadius={90}
                innerRadius={55}
                paddingAngle={3}
                label={({ name, value }: { name?: string; value?: number }) => `${name}: ${toPersianDigits(value || 0)}`}
                labelLine={false}
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
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Status radial */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">وضعیت کانفیگ‌ها</h3>
              <p className="text-xs text-muted-foreground">تفکیک بر اساس وضعیت</p>
            </div>
            <Database className="w-5 h-5 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <RadialBarChart
              cx="50%"
              cy="50%"
              innerRadius="30%"
              outerRadius="100%"
              data={radialData}
              startAngle={90}
              endAngle={-270}
            >
              <RadialBar background dataKey="value" cornerRadius={8} />
              <Legend
                iconSize={10}
                layout="vertical"
                verticalAlign="middle"
                align="right"
                wrapperStyle={{ fontSize: "12px" }}
              />
              <Tooltip
                contentStyle={{
                  background: "oklch(0.16 0.03 280 / 90%)",
                  border: "1px solid oklch(1 0 0 / 12%)",
                  borderRadius: "12px",
                  color: "white",
                }}
                formatter={(v: number) => toPersianDigits(v) + " کانفیگ"}
              />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>

        {/* Top servers bar */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">رتبه‌بندی سرورها</h3>
              <p className="text-xs text-muted-foreground">تعداد کانفیگ هر سرور</p>
            </div>
            <Globe className="w-5 h-5 text-primary" />
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={stats.topServers.map((s) => ({
                name: s.name.replace("FastApiCloud-", ""),
                count: s.configCount,
              }))}
              layout="vertical"
              margin={{ top: 5, right: 10, left: 30, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="oklch(1 0 0 / 8)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: "oklch(0.7 0.02 280)", fontSize: 11 }}
                stroke="oklch(0.5 0.02 280)"
                tickFormatter={(v) => toPersianDigits(v)}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fill: "oklch(0.7 0.02 280)", fontSize: 10 }}
                stroke="oklch(0.5 0.02 280)"
                width={80}
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
              <Bar dataKey="count" radius={[0, 8, 8, 0]} fill="oklch(0.65 0.25 290)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Traffic split pie */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-semibold">ترافیک آپلود/دانلود</h3>
              <p className="text-xs text-muted-foreground">تفکیک جهت ترافیک</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1">
                <Upload className="w-3 h-3 text-primary" />
                آپلود
              </span>
              <span className="flex items-center gap-1">
                <Download className="w-3 h-3 text-accent" />
                دانلود
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={trafficSplit}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                innerRadius={55}
                paddingAngle={4}
                label={({ name, value }: { name?: string; value?: number }) => `${name}: ${formatBytes(value || 0)}`}
                labelLine={false}
              >
                {trafficSplit.map((entry, i) => (
                  <Cell key={i} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "oklch(0.16 0.03 280 / 90%)",
                  border: "1px solid oklch(1 0 0 / 12%)",
                  borderRadius: "12px",
                  color: "white",
                }}
                formatter={(v: number) => formatBytes(v)}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Recent activity logs (full width) */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold">لاگ فعالیت‌ها</h3>
            <p className="text-xs text-muted-foreground">آخرین ۱۰ رویداد</p>
          </div>
          <TrendingUp className="w-5 h-5 text-primary" />
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {stats.recentLogs.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              هنوز فعالیتی ثبت نشده است
            </div>
          ) : (
            stats.recentLogs.map((log, i) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="glass rounded-xl p-3 flex items-center gap-3"
              >
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                  style={{
                    background:
                      log.action === "create" ? "oklch(0.7 0.18 150)"
                      : log.action === "update" ? "oklch(0.7 0.2 200)"
                      : log.action === "delete" ? "oklch(0.65 0.24 25)"
                      : "oklch(0.6 0.2 280)",
                  }}
                >
                  {log.action === "create" ? "＋" : log.action === "update" ? "✎" : log.action === "delete" ? "✕" : "•"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm">{log.detail || log.action}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {formatPersianDate(log.createdAt)}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground bg-white/5 rounded-full px-2 py-1">
                  {log.entity}
                </span>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
