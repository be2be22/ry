"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  Server as ServerIcon,
  Globe,
  X,
  Loader2,
  MapPin,
  Activity,
  Wifi,
  Power,
} from "lucide-react";
import { toast } from "sonner";
import { toPersianDigits, formatPersianDate } from "@/lib/v2ray";

interface ServerItem {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  remark: string | null;
  location: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { configs: number };
}

interface ServersManagerProps {
  onCountsChange?: (counts: { total: number }) => void;
}

export function ServersManager({ onCountsChange }: ServersManagerProps) {
  const [servers, setServers] = useState<ServerItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/servers");
      const data = await res.json();
      if (data.ok) {
        setServers(data.servers);
        onCountsChange?.({ total: data.servers.length });
      }
    } catch {
      toast.error("خطا در بارگذاری سرورها");
    } finally {
      setLoading(false);
    }
  }, [onCountsChange]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/servers/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        toast.success("سرور حذف شد");
        setDeleteId(null);
        load();
      } else {
        toast.error(data.error || "خطا در حذف");
      }
    } catch {
      toast.error("خطای شبکه");
    }
  };

  const toggleActive = async (srv: ServerItem) => {
    try {
      const res = await fetch(`/api/servers/${srv.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !srv.isActive }),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(srv.isActive ? "سرور غیرفعال شد" : "سرور فعال شد");
        load();
      }
    } catch {
      toast.error("خطای شبکه");
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold gradient-text">مدیریت سرورها</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {toPersianDigits(servers.length)} سرور ثبت شده
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
          افزودن سرور
        </button>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-48 animate-shimmer" />
          ))}
        </div>
      ) : servers.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <ServerIcon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">هیچ سروری ثبت نشده است</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            برای ساخت کانفیگ، ابتدا یک سرور اضافه کنید
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {servers.map((srv, i) => (
            <motion.div
              key={srv.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass rounded-2xl p-5 relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-24 h-24 opacity-20 -translate-y-4 translate-x-4 rounded-full blur-2xl"
                style={{ background: "linear-gradient(135deg, oklch(0.7 0.2 200), oklch(0.65 0.18 240))" }}
              />
              <div className="relative">
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center text-white"
                    style={{ background: "linear-gradient(135deg, oklch(0.7 0.2 200), oklch(0.65 0.18 240))" }}
                  >
                    <ServerIcon className="w-5 h-5" />
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className="text-[10px] font-medium px-2 py-1 rounded-full"
                      style={{
                        background: srv.isActive ? "oklch(0.7 0.18 150 / 22%)" : "oklch(0.7 0.15 70 / 22%)",
                        color: srv.isActive ? "oklch(0.7 0.18 150)" : "oklch(0.7 0.15 70)",
                      }}
                    >
                      {srv.isActive ? "فعال" : "غیرفعال"}
                    </span>
                  </div>
                </div>

                <div className="font-bold text-base mb-1">{srv.name}</div>
                <div className="text-xs text-muted-foreground font-mono mb-3" dir="ltr">
                  {srv.host}:{srv.port}
                </div>

                {srv.location && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                    <MapPin className="w-3 h-3" />
                    {srv.location}
                  </div>
                )}
                {srv.remark && (
                  <div className="text-xs text-muted-foreground mb-3 line-clamp-2">
                    {srv.remark}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-white/5">
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Wifi className="w-3 h-3" />
                      {srv.protocol}
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Activity className="w-3 h-3" />
                      {toPersianDigits(srv._count?.configs || 0)} کانفیگ
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => toggleActive(srv)}
                      title={srv.isActive ? "غیرفعال کردن" : "فعال کردن"}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-muted-foreground"
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(srv.id);
                        setFormOpen(true);
                      }}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-white/10 text-foreground"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteId(srv.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-destructive/15 text-destructive"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Form modal */}
      <AnimatePresence>
        {formOpen && (
          <ServerForm
            serverId={editingId}
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
              <h3 className="font-bold text-lg mb-2">حذف سرور</h3>
              <p className="text-sm text-muted-foreground mb-5">
                آیا از حذف این سرور مطمئن هستید؟ در صورت وجود کانفیگ متصل، حذف ممکن نیست.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium bg-destructive text-white hover:bg-destructive/90"
                >
                  بله، حذف کن
                </button>
                <button
                  onClick={() => setDeleteId(null)}
                  className="flex-1 rounded-xl py-2.5 text-sm font-medium glass-input hover:bg-white/5"
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

function ServerForm({
  serverId,
  onClose,
  onSaved,
}: {
  serverId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(!!serverId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    host: "",
    port: 443,
    protocol: "ws",
    remark: "",
    location: "",
  });

  useEffect(() => {
    if (!serverId) return;
    (async () => {
      try {
        const res = await fetch(`/api/servers/${serverId}`);
        const data = await res.json();
        if (data.ok) {
          const s = data.server;
          setForm({
            name: s.name,
            host: s.host,
            port: s.port,
            protocol: s.protocol,
            remark: s.remark || "",
            location: s.location || "",
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [serverId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.host) {
      toast.error("نام و آدرس سرور الزامی است");
      return;
    }
    setSaving(true);
    try {
      const url = serverId ? `/api/servers/${serverId}` : "/api/servers";
      const method = serverId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(serverId ? "سرور به‌روزرسانی شد" : "سرور اضافه شد");
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
        className="glass-strong rounded-2xl w-full max-w-md"
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <h3 className="font-bold">
            {serverId ? "ویرایش سرور" : "افزودن سرور جدید"}
          </h3>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 rounded-xl animate-shimmer" />
            ))}
          </div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">نام سرور</label>
              <input
                required
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                placeholder="FastApiCloud-DE-01"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">آدرس (Host)</label>
                <input
                  required
                  value={form.host}
                  onChange={(e) => setForm((f) => ({ ...f, host: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none font-mono"
                  placeholder="de1.fastapicloud.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">پورت</label>
                <input
                  type="number"
                  value={form.port}
                  onChange={(e) => setForm((f) => ({ ...f, port: Number(e.target.value) }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">موقعیت</label>
              <input
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                placeholder="آلمان - فرانکفورت"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">توضیحات (اختیاری)</label>
              <textarea
                value={form.remark}
                onChange={(e) => setForm((f) => ({ ...f, remark: e.target.value }))}
                rows={2}
                className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none resize-none"
                placeholder="سرور اصلی با CDN Cloudflare"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-xl py-3 text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{
                  background: "linear-gradient(120deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
                }}
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {serverId ? "ذخیره" : "افزودن"}
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
