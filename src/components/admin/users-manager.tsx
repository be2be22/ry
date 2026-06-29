"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Pencil,
  Trash2,
  User as UserIcon,
  X,
  Loader2,
  Mail,
  Phone,
  Calendar,
  HardDrive,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatBytes, toPersianDigits, formatPersianDate } from "@/lib/v2ray";

interface UserItem {
  id: string;
  username: string;
  email: string | null;
  phone: string | null;
  status: string;
  dataLimit: number | string;
  dataUsed: number | string;
  expireDays: number;
  expiresAt: string | null;
  createdAt: string;
  _count?: { configs: number };
}

interface UsersManagerProps {
  onCountsChange?: (counts: { total: number }) => void;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  active: { label: "فعال", color: "oklch(0.7 0.18 150)" },
  suspended: { label: "معلق", color: "oklch(0.7 0.15 70)" },
  expired: { label: "منقضی", color: "oklch(0.65 0.24 25)" },
};

export function UsersManager({ onCountsChange }: UsersManagerProps) {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      const data = await res.json();
      if (data.ok) {
        setUsers(data.users);
        onCountsChange?.({ total: data.users.length });
      }
    } catch {
      toast.error("خطا در بارگذاری کاربران");
    } finally {
      setLoading(false);
    }
  }, [onCountsChange]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = users.filter((u) => {
    if (!search) return true;
    return (
      u.username.includes(search) ||
      (u.email || "").includes(search) ||
      (u.phone || "").includes(search)
    );
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/users/${deleteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        toast.success("کاربر حذف شد");
        setDeleteId(null);
        load();
      } else {
        toast.error(data.error || "خطا در حذف");
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
          <h1 className="text-2xl font-bold gradient-text">مدیریت کاربران</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {toPersianDigits(users.length)} کاربر ثبت شده
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
          افزودن کاربر
        </button>
      </div>

      {/* Search */}
      <div className="glass rounded-2xl p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="جستجو بر اساس نام کاربری، ایمیل یا تلفن..."
          className="glass-input w-full rounded-xl py-2.5 px-4 text-sm outline-none"
        />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl h-56 animate-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <UsersIcon className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">هیچ کاربری یافت نشد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((u, i) => {
            const status = STATUS_LABELS[u.status] || STATUS_LABELS.active;
            const dataLimitNum = Number(u.dataLimit) || 0;
            const dataUsedNum = Number(u.dataUsed) || 0;
            const usagePct = dataLimitNum > 0 ? Math.min(100, (dataUsedNum / dataLimitNum) * 100) : 0;
            const isExpired = u.expiresAt && new Date(u.expiresAt) < new Date();
            return (
              <motion.div
                key={u.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-2xl p-5 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-24 h-24 opacity-20 -translate-y-4 translate-x-4 rounded-full blur-2xl"
                  style={{ background: "linear-gradient(135deg, oklch(0.78 0.22 60), oklch(0.7 0.18 100))" }}
                />
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm"
                        style={{ background: "linear-gradient(135deg, oklch(0.78 0.22 60), oklch(0.7 0.18 100))" }}
                      >
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold">{u.username}</div>
                        {u.email && (
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1" dir="ltr">
                            <Mail className="w-3 h-3" />
                            {u.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <span
                      className="text-[10px] font-medium px-2 py-1 rounded-full"
                      style={{
                        background: `${status.color}22`,
                        color: status.color,
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  {u.phone && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-3" dir="ltr">
                      <Phone className="w-3 h-3" />
                      {u.phone}
                    </div>
                  )}

                  {/* Data usage */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <HardDrive className="w-3 h-3" />
                        مصرف ترافیک
                      </span>
                      <span className="font-mono">
                        {formatBytes(u.dataUsed)} / {dataLimitNum > 0 ? formatBytes(u.dataLimit) : "نامحدود"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${usagePct}%`,
                          background: usagePct > 90
                            ? "oklch(0.65 0.24 25)"
                            : usagePct > 70
                            ? "oklch(0.78 0.22 60)"
                            : "linear-gradient(90deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs mb-3">
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {u.expiresAt ? (
                        isExpired ? (
                          <span className="text-destructive">منقضی شده</span>
                        ) : (
                          formatPersianDate(u.expiresAt)
                        )
                      ) : (
                        <span>نامحدود</span>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {toPersianDigits(u._count?.configs || 0)} کانفیگ
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-3 border-t border-white/5">
                    <button
                      onClick={() => {
                        setEditingId(u.id);
                        setFormOpen(true);
                      }}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-foreground"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleteId(u.id)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-destructive/15 text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Form modal */}
      <AnimatePresence>
        {formOpen && (
          <UserForm
            userId={editingId}
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
              <h3 className="font-bold text-lg mb-2">حذف کاربر</h3>
              <p className="text-sm text-muted-foreground mb-5">
                آیا از حذف این کاربر مطمئن هستید؟ کانفیگ‌های اختصاص یافته به این کاربر بدون کاربر می‌مانند.
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

function UserForm({
  userId,
  onClose,
  onSaved,
}: {
  userId: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(!!userId);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    status: "active",
    dataLimit: 50, // GB
    expireDays: 30,
    dataUsed: 0, // GB
  });

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        const res = await fetch(`/api/users/${userId}`);
        const data = await res.json();
        if (data.ok) {
          const u = data.user;
          setForm({
            username: u.username,
            email: u.email || "",
            phone: u.phone || "",
            status: u.status,
            dataLimit: Number(u.dataLimit) > 0 ? Math.round(Number(u.dataLimit) / (1024 * 1024 * 1024)) : 0,
            expireDays: u.expireDays || 0,
            dataUsed: Math.round(Number(u.dataUsed) / (1024 * 1024 * 1024)),
          });
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username) {
      toast.error("نام کاربری الزامی است");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        dataLimit: form.dataLimit * 1024 * 1024 * 1024, // GB to bytes
        dataUsed: form.dataUsed * 1024 * 1024 * 1024,
      };
      const url = userId ? `/api/users/${userId}` : "/api/users";
      const method = userId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok) {
        toast.success(userId ? "کاربر به‌روزرسانی شد" : "کاربر اضافه شد");
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
            {userId ? "ویرایش کاربر" : "افزودن کاربر جدید"}
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
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">نام کاربری</label>
              <input
                required
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                placeholder="client_ali"
                dir="ltr"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">ایمیل</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  placeholder="ali@example.com"
                  dir="ltr"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">تلفن</label>
                <input
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  placeholder="09120000000"
                  dir="ltr"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">سقف داده (GB)</label>
                <input
                  type="number"
                  value={form.dataLimit}
                  onChange={(e) => setForm((f) => ({ ...f, dataLimit: Number(e.target.value) }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  dir="ltr"
                />
                <p className="text-[10px] text-muted-foreground">۰ = نامحدود</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">مدت اعتبار (روز)</label>
                <input
                  type="number"
                  value={form.expireDays}
                  onChange={(e) => setForm((f) => ({ ...f, expireDays: Number(e.target.value) }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  dir="ltr"
                />
              </div>
            </div>
            {userId && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">داده مصرف‌شده (GB)</label>
                <input
                  type="number"
                  value={form.dataUsed}
                  onChange={(e) => setForm((f) => ({ ...f, dataUsed: Number(e.target.value) }))}
                  className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
                  dir="ltr"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">وضعیت</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="glass-input w-full rounded-xl py-2.5 px-3 text-sm outline-none"
              >
                <option value="active">فعال</option>
                <option value="suspended">معلق</option>
                <option value="expired">منقضی</option>
              </select>
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
                {userId ? "ذخیره" : "افزودن"}
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
