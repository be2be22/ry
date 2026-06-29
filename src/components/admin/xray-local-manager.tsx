"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Square,
  RotateCw,
  Activity,
  Cpu,
  HardDrive,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Server as ServerIcon,
  Terminal,
  Copy,
  FileJson,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { toPersianDigits, formatBytes } from "@/lib/v2ray";

interface XrayStatus {
  running: boolean;
  pid?: number;
  startedAt?: string;
  publicHost: string;
  publicPort: number;
  tls: boolean;
  configPath: string;
  logPath: string;
  clientCount?: number;
  inboundCount?: number;
  error?: string;
}

export function XrayLocalManager() {
  const [status, setStatus] = useState<XrayStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [configPreview, setConfigPreview] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/xray/status");
      const data = await res.json();
      if (data.ok) setStatus(data.status);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Poll status every 5 seconds
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [load]);

  const start = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/xray/start", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Xray اجرا شد (PID: ${data.pid})`);
      } else {
        toast.error(data.error || "خطا در اجرای Xray");
      }
      load();
    } catch {
      toast.error("خطای شبکه");
    } finally {
      setStarting(false);
    }
  };

  const stop = async () => {
    if (!confirm("توقف Xray؟ تمام اتصالات فعال قطع می‌شوند.")) return;
    setStopping(true);
    try {
      const res = await fetch("/api/xray/stop", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast.success("Xray متوقف شد");
      } else {
        toast.error(data.error || "خطا در توقف Xray");
      }
      load();
    } catch {
      toast.error("خطای شبکه");
    } finally {
      setStopping(false);
    }
  };

  const restart = async () => {
    setRestarting(true);
    try {
      const res = await fetch("/api/xray/restart", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast.success(`Xray restart شد (PID: ${data.pid})`);
      } else {
        toast.error(data.error || "خطا در restart");
      }
      load();
    } catch {
      toast.error("خطای شبکه");
    } finally {
      setRestarting(false);
    }
  };

  const showLogs = async () => {
    setLogsOpen(true);
    setLogs("در حال بارگذاری...");
    try {
      const res = await fetch("/api/xray/logs?lines=100");
      const data = await res.json();
      if (data.ok) setLogs(data.content || "(log is empty)");
      else setLogs(`خطا: ${data.error}`);
    } catch {
      setLogs("خطای شبکه");
    }
  };

  const showConfig = async () => {
    setConfigOpen(true);
    setConfigPreview("در حال بارگذاری...");
    try {
      const res = await fetch("/api/xray/config");
      const data = await res.json();
      if (data.ok) {
        setConfigPreview(JSON.stringify(data.config, null, 2));
      } else {
        setConfigPreview(`خطا: ${data.error}`);
      }
    } catch {
      setConfigPreview("خطای شبکه");
    }
  };

  if (loading) {
    return (
      <div className="glass rounded-2xl p-5">
        <div className="h-32 animate-shimmer rounded-xl" />
      </div>
    );
  }

  const isRunning = status?.running ?? false;

  return (
    <div className="space-y-4">
      {/* Status card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 relative overflow-hidden"
      >
        {/* Background glow when running */}
        {isRunning && (
          <div
            className="absolute top-0 right-0 w-48 h-48 opacity-30 -translate-y-12 translate-x-12 rounded-full blur-3xl pointer-events-none"
            style={{ background: "linear-gradient(135deg, oklch(0.7 0.18 150), oklch(0.65 0.2 180))" }}
          />
        )}

        <div className="relative">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white"
                style={{
                  background: isRunning
                    ? "linear-gradient(135deg, oklch(0.7 0.18 150), oklch(0.65 0.2 180))"
                    : "linear-gradient(135deg, oklch(0.6 0.1 280), oklch(0.5 0.1 280))",
                }}
              >
                <Zap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-lg">سرور Xray محلی</h3>
                <div className="flex items-center gap-2 mt-0.5">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      background: isRunning ? "oklch(0.7 0.18 150)" : "oklch(0.6 0.1 280)",
                      boxShadow: isRunning ? "0 0 8px oklch(0.7 0.18 150 / 60%)" : "none",
                      animation: isRunning ? "pulse 2s infinite" : "none",
                    }}
                  />
                  <span className="text-sm font-medium">
                    {isRunning ? "در حال اجرا" : "متوقف"}
                  </span>
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              {!isRunning ? (
                <button
                  onClick={start}
                  disabled={starting}
                  className="rounded-xl px-4 py-2.5 text-sm font-medium text-white flex items-center gap-2 disabled:opacity-60"
                  style={{ background: "linear-gradient(120deg, oklch(0.7 0.18 150), oklch(0.65 0.2 180))" }}
                >
                  {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                  اجرای Xray
                </button>
              ) : (
                <>
                  <button
                    onClick={restart}
                    disabled={restarting}
                    className="glass-input rounded-xl px-3 py-2.5 text-sm font-medium flex items-center gap-2 disabled:opacity-60"
                  >
                    {restarting ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCw className="w-4 h-4" />}
                    Restart
                  </button>
                  <button
                    onClick={stop}
                    disabled={stopping}
                    className="rounded-xl px-3 py-2.5 text-sm font-medium text-white flex items-center gap-2 disabled:opacity-60"
                    style={{ background: "oklch(0.65 0.24 25)" }}
                  >
                    {stopping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                    توقف
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <StatCard
              icon={ServerIcon}
              label="آدرس اتصال"
              value={status ? `${status.publicHost}:${status.publicPort}` : "—"}
              color="oklch(0.65 0.25 290)"
              dir="ltr"
            />
            <StatCard
              icon={Activity}
              label="کلاینت‌های فعال"
              value={status?.clientCount !== undefined ? toPersianDigits(status.clientCount) : "—"}
              color="oklch(0.7 0.18 150)"
            />
            <StatCard
              icon={FileJson}
              label="تعداد Inbound"
              value={status?.inboundCount !== undefined ? toPersianDigits(status.inboundCount) : "—"}
              color="oklch(0.7 0.2 200)"
            />
            <StatCard
              icon={CheckCircle2}
              label="TLS"
              value={status?.tls ? "فعال" : "غیرفعال"}
              color={status?.tls ? "oklch(0.7 0.18 150)" : "oklch(0.7 0.15 70)"}
            />
          </div>

          {/* Process info */}
          {isRunning && status?.pid && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
              <DetailItem label="PID" value={toPersianDigits(status.pid)} />
              <DetailItem label="زمان شروع" value={status.startedAt ? new Date(status.startedAt).toLocaleString("fa-IR") : "—"} />
              <DetailItem label="مسیر config" value={status.configPath?.split("/").pop() || "—"} dir="ltr" />
            </div>
          )}

          {/* Action links */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={showLogs}
              className="glass-input rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-white/5"
            >
              <Terminal className="w-3.5 h-3.5" />
              مشاهده لاگ‌ها
            </button>
            <button
              onClick={showConfig}
              className="glass-input rounded-lg px-3 py-1.5 text-xs flex items-center gap-1.5 hover:bg-white/5"
            >
              <FileJson className="w-3.5 h-3.5" />
              preview config.json
            </button>
          </div>
        </div>
      </motion.div>

      {/* Info banner */}
      {!isRunning && (
        <div className="glass rounded-2xl p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium mb-1">Xray در حال اجرا نیست</div>
            <div className="text-xs text-muted-foreground leading-relaxed">
              با کلیک روی «اجرای Xray»، سرور Xray روی همین ماشین اجرا می‌شود و
              تمام کانفیگ‌های فعال به صورت خودکار در config.json قرار می‌گیرند.
              کانفیگ‌های جدید پس از ساخت به صورت خودکار اعمال می‌شوند.
            </div>
          </div>
        </div>
      )}

      {/* Logs modal */}
      <AnimatePresence>
        {logsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLogsOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" />
                  <h3 className="font-bold">لاگ‌های Xray</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(logs);
                      toast.success("کپی شد");
                    }}
                    className="glass-input rounded-lg px-2 py-1 text-xs flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    کپی
                  </button>
                  <button
                    onClick={() => setLogsOpen(false)}
                    className="glass-input rounded-lg px-2 py-1 text-xs"
                  >
                    بستن
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap" dir="ltr">
                  {logs}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Config preview modal */}
      <AnimatePresence>
        {configOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfigOpen(false)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileJson className="w-5 h-5 text-primary" />
                  <h3 className="font-bold">config.json (preview)</h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(configPreview);
                      toast.success("کپی شد");
                    }}
                    className="glass-input rounded-lg px-2 py-1 text-xs flex items-center gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    کپی
                  </button>
                  <button
                    onClick={() => setConfigOpen(false)}
                    className="glass-input rounded-lg px-2 py-1 text-xs"
                  >
                    بستن
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <pre className="text-[11px] font-mono text-muted-foreground whitespace-pre-wrap" dir="ltr">
                  {configPreview}
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
  dir,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
  dir?: "ltr" | "rtl";
}) {
  return (
    <div className="glass rounded-xl p-3">
      <Icon className="w-4 h-4 mb-1.5" style={{ color }} />
      <div className="text-sm font-bold truncate" dir={dir}>{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

function DetailItem({ label, value, dir }: { label: string; value: string; dir?: "ltr" | "rtl" }) {
  return (
    <div className="glass rounded-lg p-2 flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className="text-xs font-mono truncate max-w-[60%]" dir={dir}>{value}</span>
    </div>
  );
}
