"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  QrCode,
  Copy,
  ExternalLink,
  Filter,
  Loader2,
  Server as ServerIcon,
  User as UserIcon,
  Clock,
  Activity,
  X,
  Settings2,
  Link as LinkIcon,
  FileCode,
  FileDown,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatBytes, toPersianDigits, formatPersianDate } from "@/lib/v2ray";

interface ConfigItem {
  id: string;
  name: string;
  type: "vmess" | "vless" | "trojan";
  uuid: string;
  path: string;
  host: string | null;
  sni: string | null;
  tls: string;
  network: string;
  port: number;
  alterId: number;
  encryption: string;
  flow: string | null;
  status: string;
  uploadBytes: number | string;
  downloadBytes: number | string;
  totalUsageBytes: number | string;
  expiresAt: string | null;
  createdAt: string;
  xrayActive: boolean;
  server: {
    id: string;
    name: string;
    host: string;
    port: number;
    location?: string | null;
  };
  assignedUser: { id: string; username: string; email?: string | null } | null;
}

interface Server {
  id: string;
  name: string;
  host: string;
  port: number;
  location?: string | null;
}

interface User {
  id: string;
  username: string;
  email?: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  vmess: "VMess",
  vless: "VLESS",
  trojan: "Trojan",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "فعال", color: "oklch(0.7 0.18 150)" },
  disabled: { label: "غیرفعال", color: "oklch(0.7 0.15 70)" },
  expired: { label: "منقضی", color: "oklch(0.65 0.24 25)" },
};

const TYPE_GRADIENTS: Record<string, string> = {
  vmess: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
  vless: "linear-gradient(135deg, oklch(0.7 0.2 200), oklch(0.65 0.18 240))",
  trojan: "linear-gradient(135deg, oklch(0.78 0.22 60), oklch(0.7 0.18 100))",
};

interface ConfigsTableProps {
  onCountsChange?: (counts: { total: number }) => void;
}

export function ConfigsTable({ onCountsChange }: ConfigsTableProps) {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterServer, setFilterServer] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [qrConfig, setQrConfig] = useState<ConfigItem | null>(null);
  const [shareConfig, setShareConfig] = useState<ConfigItem | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filterType) params.set("type", filterType);
      if (filterStatus) params.set("status", filterStatus);
      if (filterServer) params.set("serverId", filterServer);

      const [cfgRes, srvRes, usrRes] = await Promise.all([
        fetch(`/api/configs?${params.toString()}`),
        fetch("/api/servers"),
        fetch("/api/users"),
      ]);
      const cfgData = await cfgRes.json();
      const srvData = await srvRes.json();
      const usrData = await usrRes.json();

      if (cfgData.ok) {
        setConfigs(cfgData.configs);
        onCountsChange?.({ total: cfgData.configs.length });
      }
      if (srvData.ok) setServers(srvData.servers);
      if (usrData.ok) setUsers(usrData.users);
    } catch {
      toast.error("خطا در بارگذاری کانفیگ‌ها");
    } finally {
      setLoading(false);
    }
  }, [search, filterType, filterStatus, filterServer, onCountsChange]);

  useEffect(() => {
    const t = setTimeout(load, 300);
    return () => clearTimeout(t);
  }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/configs/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        toast.success("کانفیگ حذف شد");
        setDeleteId(null);
        load();
      } else {
        toast.error(data.error || "خطا در حذف");
      }
    } catch {
      toast.error("خطای شبکه");
    }
  };

  const copyShareLink = async (config: ConfigItem) => {
    try {
      const res = await fetch(`/api/configs/${config.id}`);
      const data = await res.json();
      if (data.ok && data.shareLink) {
        await navigator.clipboard.writeText(data.shareLink);
        toast.success("لینک اشتراک کپی شد");
      }
    } catch {
      toast.error("خطا در کپی لینک");
    }
  };

  const downloadInboundJson = async (config: ConfigItem) => {
    try {
      const res = await fetch(`/api/configs/${config.id}`);
      const data = await res.json();
      if (data.ok && data.inboundJson) {
        const blob = new Blob([JSON.stringify(data.inboundJson, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${config.name}-inbound.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("فایل inbound.json دانلود شد");
      }
    } catch {
      toast.error("خطا در دانلود فایل");
    }
  };

  const downloadClashYaml = async (config: ConfigItem) => {
    try {
      const res = await fetch(`/api/configs/${config.id}`);
      const data = await res.json();
      if (data.ok && data.clashYaml) {
        const blob = new Blob([data.clashYaml], { type: "text/yaml" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${config.name}-clash.yaml`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("فایل Clash YAML دانلود شد");
      }
    } catch {
      toast.error("خطا در دانلود فایل");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">مدیریت کانفیگ‌ها</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {toPersianDigits(configs.length)} کانفیگ ثبت شده
          </p>
        </div>
        <button
          onClick={() => {
            setEditingId(null);
            setFormOpen(true);
          }}
          className="rounded-xl px-4 py-2.5 font-medium text-white text-sm flex items-center gap-2 hover:scale-105 transition-transform"
          style={{
            background: "linear-gradient(120deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
            boxShadow: "0 6px 20px oklch(0.65 0.25 290 / 30%)",
          }}
        >
          <Plus className="w-4 h-4" />
          ساخت کانفیگ جدید
        </button>
      </div>

      {/* Search + filters */}
      <div className="glass rounded-2xl p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو بر اساس نام یا UUID..."
            className="glass-input w-full rounded-xl py-2 pr-10 pl-3 text-sm outline-none"
          />
        </div>
        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`glass-input rounded-xl px-3 py-2 text-sm flex items-center gap-2 ${showFilters ? "text-primary" : ""}`}
        >
          <Filter className="w-4 h-4" />
          فیلترها
        </button>
        {(filterType || filterStatus || filterServer) && (
          <button
            onClick={() => {
              setFilterType("");
              setFilterStatus("");
              setFilterServer("");
            }}
            className="glass-input rounded-xl px-3 py-2 text-sm text-destructive flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            پاک کردن
          </button>
        )}
      </div>

      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3"
          >
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">نوع پروتکل</label>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="glass-input w-full rounded-xl py-2 px-3 text-sm outline-none"
              >
                <option value="">همه</option>
                <option value="vmess">VMess</option>
                <option value="vless">VLESS</option>
                <option value="trojan">Trojan</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">وضعیت</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="glass-input w-full rounded-xl py-2 px-3 text-sm outline-none"
              >
                <option value="">همه</option>
                <option value="active">فعال</option>
                <option value="disabled">غیرفعال</option>
                <option value="expired">منقضی</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">سرور</label>
              <select
                value={filterServer}
                onChange={(e) => setFilterServer(e.target.value)}
                className="glass-input w-full rounded-xl py-2 px-3 text-sm outline-none"
              >
                <option value="">همه سرورها</option>
                {servers.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table */}
      <div className="glass rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-16 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : configs.length === 0 ? (
          <div className="p-12 text-center">
            <Settings2 className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">هیچ کانفیگی یافت نشد</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              برای شروع، یک کانفیگ جدید بسازید
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 glass-strong z-10">
                <tr className="text-right">
                  <th className="p-3 font-medium text-muted-foreground">کانفیگ</th>
                  <th className="p-3 font-medium text-muted-foreground">سرور</th>
                  <th className="p-3 font-medium text-muted-foreground">کاربر</th>
                  <th className="p-3 font-medium text-muted-foreground">ترافیک</th>
                  <th className="p-3 font-medium text-muted-foreground">وضعیت</th>
                  <th className="p-3 font-medium text-muted-foreground">Xray</th>
                  <th className="p-3 font-medium text-muted-foreground">انقضا</th>
                  <th className="p-3 font-medium text-muted-foreground text-center">عملیات</th>
                </tr>
              </thead>
              <tbody>
                {configs.map((cfg) => {
                  const status = STATUS_LABELS[cfg.status] || STATUS_LABELS.active;
                  return (
                    <tr key={cfg.id} className="border-t border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                            style={{ background: TYPE_GRADIENTS[cfg.type] }}
                          >
                            {TYPE_LABELS[cfg.type].slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-medium truncate max-w-[160px]">{cfg.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                              {cfg.uuid.slice(0, 8)}...
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <ServerIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="text-xs truncate max-w-[140px]">{cfg.server.name}</div>
                            <div className="text-[10px] text-muted-foreground font-mono" dir="ltr">
                              {cfg.server.host}:{cfg.port}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {cfg.assignedUser ? (
                          <div className="flex items-center gap-2">
                            <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-xs">{cfg.assignedUser.username}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="text-xs">{formatBytes(cfg.totalUsageBytes)}</div>
                        <div className="text-[10px] text-muted-foreground">
                          ↑{formatBytes(cfg.uploadBytes)} ↓{formatBytes(cfg.downloadBytes)}
                        </div>
                      </td>
                      <td className="p-3">
                        <span
                          className="text-[10px] font-medium px-2 py-1 rounded-full"
                          style={{
                            background: `${status.color}22`,
                            color: status.color,
                          }}
                        >
                          {status.label}
                        </span>
                      </td>
                      <td className="p-3">
                        {cfg.xrayActive ? (
                          <span
                            className="text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1 w-fit"
                            style={{ background: "oklch(0.7 0.18 150 / 22%)", color: "oklch(0.7 0.18 150)" }}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            فعال در Xray
                          </span>
                        ) : (
                          <span
                            className="text-[10px] font-medium px-2 py-1 rounded-full flex items-center gap-1 w-fit"
                            style={{ background: "oklch(0.7 0.15 70 / 22%)", color: "oklch(0.7 0.15 70)" }}
                          >
                            <AlertCircle className="w-2.5 h-2.5" />
                            غیرفعال
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {cfg.expiresAt ? (
                          <div className="text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3 text-muted-foreground" />
                            {formatPersianDate(cfg.expiresAt)}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">نامحدود</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setQrConfig(cfg)}
                            title="QR Code"
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-primary"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShareConfig(cfg)}
                            title="لینک اشتراک"
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-foreground"
                          >
                            <LinkIcon className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => copyShareLink(cfg)}
                            title="کپی لینک"
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-foreground"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingId(cfg.id);
                              setFormOpen(true);
                            }}
                            title="ویرایش"
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 transition-colors text-foreground"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteId(cfg.id)}
                            title="حذف"
                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/15 transition-colors text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {formOpen && (
          <ConfigForm
            configId={editingId}
            servers={servers}
            users={users}
            onClose={() => {
              setFormOpen(false);
              setEditingId(null);
            }}
            onSaved={() => {
              setFormOpen(false);
              setEditingId(null);
              load();
            }}
          />
        )}
      </AnimatePresence>

      {/* QR Modal */}
      <AnimatePresence>
        {qrConfig && (
          <QRModal config={qrConfig} onClose={() => setQrConfig(null)} />
        )}
      </AnimatePresence>

      {/* Share Link Modal */}
      <AnimatePresence>
        {shareConfig && (
          <ShareLinkModal
            config={shareConfig}
            onClose={() => setShareConfig(null)}
            onDownloadJson={() => downloadInboundJson(shareConfig)}
            onDownloadYaml={() => downloadClashYaml(shareConfig)}
          />
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setDeleteId(null)}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong rounded-2xl p-6 max-w-sm w-full"
            >
              <div className="w-12 h-12 rounded-xl bg-destructive/20 flex items-center justify-center mb-4">
                <Trash2 className="w-6 h-6 text-destructive" />
              </div>
              <h3 className="font-bold text-lg mb-2">حذف کانفیگ</h3>
              <p className="text-sm text-muted-foreground mb-5">
                آیا از حذف این کانفیگ مطمئن هستید؟ این عملیات قابل بازگشت نیست.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium bg-destructive text-white hover:bg-destructive/90 transition-colors"
                >
                  بله، حذف کن
                </button>
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium glass-input hover:bg-white/5 transition-colors"
                >
                  انصراف
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------- Config Form ---------- */
function ConfigForm({
  configId,
  servers,
  users,
  onClose,
  onSaved,
}: {
  configId: string | null;
  servers: Server[];
  users: User[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(!!configId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "vmess" as "vmess" | "vless" | "trojan",
    uuid: "",
    serverId: "",
    path: "/",
    host: "",
    sni: "",
    tls: "tls",
    network: "ws",
    security: "auto",
    encryption: "none",
    alterId: 0,
    port: 443,
    flow: "",
    status: "active",
    expiresAt: "",
    assignedUserId: "",
  });

  useEffect(() => {
    if (!configId) {
      // Pre-select first server if available
      if (servers[0]) setForm((f) => ({ ...f, serverId: servers[0].id, port: servers[0].port, host: servers[0].host, sni: servers[0].host }));
      return;
    }
    (async () => {
      try {
        const res = await fetch(`/api/configs/${configId}`);
        const data = await res.json();
        if (data.ok) {
          const c = data.config;
          setForm({
            name: c.name,
            type: c.type,
            uuid: c.uuid,
            serverId: c.serverId,
            path: c.path,
            host: c.host || "",
            sni: c.sni || "",
            tls: c.tls,
            network: c.network,
            security: c.security || "auto",
            encryption: c.encryption || "none",
            alterId: c.alterId,
            port: c.port,
            flow: c.flow || "",
            status: c.status,
            expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : "",
            assignedUserId: c.assignedUserId || "",
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [configId, servers]);

  const onServerChange = (serverId: string) => {
    const srv = servers.find((s) => s.id === serverId);
    if (srv) {
      setForm((f) => ({ ...f, serverId, port: srv.port, host: srv.host, sni: srv.host }));
    } else {
      setForm((f) => ({ ...f, serverId }));
    }
  };

  const generateUuid = () => {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      setForm((f) => ({ ...f, uuid: crypto.randomUUID() }));
    } else {
      setForm((f) => ({ ...f, uuid: Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) }));
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.serverId) {
      toast.error("نام و سرور الزامی است");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        alterId: Number(form.alterId),
        port: Number(form.port),
        expiresAt: form.expiresAt || null,
        assignedUserId: form.assignedUserId || null,
      };
      const url = configId ? `/api/configs/${configId}` : "/api/configs";
      const method = configId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(configId ? "کانفیگ به‌روزرسانی شد" : "کانفیگ ساخته شد");
        onSaved();
      } else {
        toast.error(data.error || "خطا در ذخیره");
      }
    } catch {
      toast.error("خطای شبکه");
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="sticky top-0 glass-strong p-5 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-bold text-lg">
            {configId ? "ویرایش کانفیگ" : "ساخت کانفیگ جدید"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            {/* Type selector */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">نوع پروتکل</label>
              <div className="grid grid-cols-3 gap-2">
                {(["vmess", "vless", "trojan"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, type: t }))}
                    className={`rounded-xl py-3 text-sm font-medium transition-all ${
                      form.type === t ? "text-white" : "glass-input text-muted-foreground"
                    }`}
                    style={form.type === t ? { background: TYPE_GRADIENTS[t] } : undefined}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="نام کانفیگ">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  placeholder="مثلا: ali-vmess-de"
                />
              </Field>

              <Field label="سرور">
                <select
                  required
                  value={form.serverId}
                  onChange={(e) => onServerChange(e.target.value)}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                >
                  <option value="">انتخاب سرور...</option>
                  {servers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({s.host})</option>
                  ))}
                </select>
              </Field>
            </div>

            <Field label="UUID / Password">
              <div className="flex gap-2">
                <input
                  value={form.uuid}
                  onChange={(e) => setForm((f) => ({ ...f, uuid: e.target.value }))}
                  className="glass-input flex-1 rounded-xl py-2.5 px-3 text-sm outline-none font-mono"
                  placeholder="UUID تولید خودکار"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={generateUuid}
                  className="glass-input rounded-xl px-3 text-xs whitespace-nowrap hover:bg-white/5"
                >
                  تولید UUID
                </button>
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="پورت">
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  dir="ltr"
                />
              </Field>
              <Field label="Network">
                <select
                  value={form.network}
                  onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                >
                  <option value="ws">ws (WebSocket)</option>
                  <option value="tcp">tcp</option>
                  <option value="grpc">grpc</option>
                  <option value="h2">h2</option>
                </select>
              </Field>
            </div>

            <Field label="مسیر WebSocket (path)">
              <input
                value={form.path}
                onChange={(e) => setForm((f) => ({ ...f, path: e.target.value }))}
                className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none font-mono"
                placeholder="/"
                dir="ltr"
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Host Header">
                <input
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  placeholder="domain.com"
                  dir="ltr"
                />
              </Field>
              <Field label="SNI">
                <input
                  value={form.sni}
                  onChange={(e) => setForm((f) => ({ ...f, sni: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  placeholder="domain.com"
                  dir="ltr"
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Field label="TLS">
                <select
                  value={form.tls}
                  onChange={(e) => setForm((f) => ({ ...f, tls: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                >
                  <option value="tls">tls</option>
                  <option value="none">none</option>
                </select>
              </Field>
              {form.type === "vmess" && (
                <Field label="AlterId">
                  <input
                    type="number"
                    value={form.alterId}
                    onChange={(e) => setForm((f) => ({ ...f, alterId: Number(e.target.value) }))}
                    className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                    dir="ltr"
                  />
                </Field>
              )}
              {form.type === "vless" && (
                <Field label="Flow">
                  <select
                    value={form.flow}
                    onChange={(e) => setForm((f) => ({ ...f, flow: e.target.value }))}
                    className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  >
                    <option value="">none</option>
                    <option value="xtls-rprx-vision">xtls-rprx-vision</option>
                  </select>
                </Field>
              )}
              <Field label="وضعیت">
                <select
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                >
                  <option value="active">فعال</option>
                  <option value="disabled">غیرفعال</option>
                  <option value="expired">منقضی</option>
                </select>
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="کاربر اختصاص یافته (اختیاری)">
                <select
                  value={form.assignedUserId}
                  onChange={(e) => setForm((f) => ({ ...f, assignedUserId: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                >
                  <option value="">— بدون کاربر —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
              </Field>
              <Field label="تاریخ انقضا (اختیاری)">
                <input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  dir="ltr"
                />
              </Field>
            </div>

            <div className="flex gap-2 pt-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{
                  background: "linear-gradient(120deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
                }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {configId ? "ذخیره تغییرات" : "ساخت کانفیگ"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-5 py-3 text-sm font-medium glass-input hover:bg-white/5"
              >
                انصراف
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

/* ---------- QR Modal ---------- */
function QRModal({ config, onClose }: { config: ConfigItem; onClose: () => void }) {
  // Compute QR URL directly without state — the modal remounts for each config
  const qrUrl = `/api/qr?id=${config.id}&t=${config.id}`;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl p-6 max-w-sm w-full text-center"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">QR Code کانفیگ</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold mx-auto mb-3"
          style={{ background: TYPE_GRADIENTS[config.type] }}
        >
          {TYPE_LABELS[config.type].slice(0, 2)}
        </div>
        <div className="text-sm font-medium mb-3">{config.name}</div>
        <div className="bg-white rounded-2xl p-4 mx-auto w-fit shadow-lg">
          <img
            src={qrUrl}
            alt="QR Code"
            className="w-56 h-56"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          برای وارد کردن کانفیگ در اپلیکیشن V2Ray، QR Code را اسکن کنید
        </p>
      </motion.div>
    </motion.div>
  );
}

/* ---------- Share Link Modal ---------- */
function ShareLinkModal({
  config,
  onClose,
  onDownloadJson,
  onDownloadYaml,
}: {
  config: ConfigItem;
  onClose: () => void;
  onDownloadJson: () => void;
  onDownloadYaml: () => void;
}) {
  const [shareLink, setShareLink] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/configs/${config.id}`);
        const data = await res.json();
        if (data.ok) setShareLink(data.shareLink);
      } finally {
        setLoading(false);
      }
    })();
  }, [config.id]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      toast.success("لینک کپی شد");
    } catch {
      toast.error("خطا در کپی");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-strong rounded-2xl p-6 max-w-lg w-full"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">لینک اشتراک کانفیگ</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-[10px] font-bold"
            style={{ background: TYPE_GRADIENTS[config.type] }}
          >
            {TYPE_LABELS[config.type].slice(0, 2)}
          </div>
          <div>
            <div className="text-sm font-medium">{config.name}</div>
            <div className="text-[10px] text-muted-foreground font-mono" dir="ltr">
              {config.server.host}:{config.port}
            </div>
          </div>
        </div>

        <div className="glass rounded-xl p-3 mb-3">
          {loading ? (
            <div className="h-6 animate-shimmer rounded" />
          ) : (
            <div className="text-xs font-mono break-all max-h-32 overflow-y-auto" dir="ltr">
              {shareLink}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            onClick={copy}
            disabled={loading}
            className="rounded-xl py-2.5 text-sm font-medium text-white flex items-center justify-center gap-2 disabled:opacity-60"
            style={{ background: "linear-gradient(120deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))" }}
          >
            <Copy className="w-4 h-4" />
            کپی لینک
          </button>
          <button
            onClick={() => window.open(shareLink, "_blank")}
            disabled={loading}
            className="rounded-xl py-2.5 text-sm font-medium glass-input flex items-center justify-center gap-2 disabled:opacity-60"
          >
            <ExternalLink className="w-4 h-4" />
            باز کردن
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onDownloadJson}
            className="rounded-xl py-2.5 text-xs font-medium glass-input flex items-center justify-center gap-2"
          >
            <FileCode className="w-3.5 h-3.5" />
            دانلود inbound.json
          </button>
          <button
            onClick={onDownloadYaml}
            className="rounded-xl py-2.5 text-xs font-medium glass-input flex items-center justify-center gap-2"
          >
            <FileDown className="w-3.5 h-3.5" />
            دانلود Clash YAML
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
