"use client";

import { useEffect, useState, useCallback } from "react";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { MicroLabel } from "@/components/cyber/micro-label";
import { CyberButton } from "@/components/cyber/cyber-button";
import { GlowCard } from "@/components/cyber/glow-card";
import {
  UserPlus,
  Search,
  MoreVertical,
  Copy,
  ExternalLink,
  Power,
  Trash2,
  Edit,
  CopyPlus,
  RotateCcw,
  Download,
  Tag,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatJalali, daysRemaining, toPersianDigits } from "@/lib/jalali";
import { formatBytes } from "@/lib/format";

interface Plan {
  id: string;
  name: string;
  dataLimitGb: number;
  durationDays: number;
  maxDevices: number;
}

interface User {
  id: string;
  uuid: string;
  username: string;
  subToken: string;
  notes: string | null;
  tags: string | null;
  dataLimitBytes: string;
  usedBytes: string;
  expireAt: string | null;
  maxDevices: number;
  enabled: boolean;
  suspended: boolean;
  allowedIps: string | null;
  planId: string | null;
  plan: Plan | null;
  lastSeenAt: string | null;
  onlineDevices: number;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [cloneSource, setCloneSource] = useState<User | null>(null);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (statusFilter && statusFilter !== "all") params.set("status", statusFilter);
      const res = await fetch(`/api/users?${params}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [q, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/plans", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPlans(d.plans || []))
      .catch(() => {});
  }, []);

  async function toggleUser(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !u.enabled }),
    });
    if (res.ok) {
      toast.success(u.enabled ? "کاربر غیرفعال شد" : "کاربر فعال شد");
      load();
    } else {
      toast.error("خطا در تغییر وضعیت");
    }
  }

  async function resetUsage(u: User) {
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resetUsage: true }),
    });
    if (res.ok) {
      toast.success("مصرف صفر شد");
      load();
    }
  }

  async function deleteUser(u: User) {
    if (!confirm(`حذف کاربر «${u.username}»؟ این عملیات قابل بازگشت نیست.`)) return;
    const res = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("کاربر حذف شد");
      load();
    }
  }

  function copySub(u: User) {
    const host = window.location.hostname;
    navigator.clipboard.writeText(`https://${host}/sub/${u.subToken}`);
    toast.success("لینک اشتراک کپی شد");
  }

  return (
    <div className="space-y-6 animate-fade-slide">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <PixelHeading as="h1" color="cyan">
            مدیریت کاربران
          </PixelHeading>
          <MicroLabel className="mt-1 block">ایجاد، ویرایش و کنترل کاربران VPN</MicroLabel>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/api/export/users">
            <CyberButton variant="cyan" icon={<Download className="w-4 h-4" />}>
              خروجی CSV
            </CyberButton>
          </a>
          <CyberButton
            variant="magenta"
            pulse
            icon={<UserPlus className="w-4 h-4" />}
            onClick={() => setShowCreate(true)}
          >
            ایجاد کاربر
          </CyberButton>
        </div>
      </div>

      {/* Search & filters */}
      <GlowCard className="p-4">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="جستجو بر اساس نام کاربری، یادداشت، برچسب..."
              className="cyber-input w-full pr-10 pl-3 py-2"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="cyber-input w-[160px]">
              <SelectValue placeholder="همه وضعیت‌ها" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">همه</SelectItem>
              <SelectItem value="enabled">فعال</SelectItem>
              <SelectItem value="disabled">غیرفعال</SelectItem>
              <SelectItem value="expired">منقضی</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </GlowCard>

      {/* Users table */}
      <GlowCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>کاربر</th>
                <th>سهمیه</th>
                <th>انقضا</th>
                <th>دستگاه</th>
                <th>وضعیت</th>
                <th>برچسب‌ها</th>
                <th className="text-left">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center text-muted-foreground py-12">
                    {loading ? "در حال بارگذاری..." : "هیچ کاربری یافت نشد"}
                  </td>
                </tr>
              )}
              {users.map((u) => {
                const limit = Number(u.dataLimitBytes);
                const used = Number(u.usedBytes);
                const usedPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
                const days = daysRemaining(u.expireAt);
                const expired = u.expireAt ? new Date(u.expireAt) < new Date() : false;

                return (
                  <tr key={u.id}>
                    <td>
                      <div className="font-bold">{u.username}</div>
                      <div className="text-xs text-muted-foreground font-mono-cyber" dir="ltr">
                        {u.uuid.slice(0, 8)}...
                      </div>
                    </td>
                    <td>
                      {limit > 0 ? (
                        <>
                          <div className="text-sm font-mono-cyber">
                            {formatBytes(used)} / {formatBytes(limit)}
                          </div>
                          <div className="mt-1 progress-cyber h-1">
                            <div
                              className={`progress-cyber-bar ${
                                usedPct > 85 ? "danger" : usedPct > 65 ? "warn" : ""
                              }`}
                              style={{ width: `${usedPct}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <span className="protocol-chip green">نامحدود</span>
                      )}
                    </td>
                    <td>
                      <div className="text-sm">{formatJalali(u.expireAt)}</div>
                      {u.expireAt && (
                        <div
                          className={`text-xs mt-0.5 ${
                            expired
                              ? "neon-text-magenta"
                              : days < 3
                              ? "neon-text-yellow"
                              : "text-muted-foreground"
                          }`}
                        >
                          {expired
                            ? "منقضی شده"
                            : `${toPersianDigits(days)} روز باقی‌مانده`}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="font-mono-cyber">
                        {toPersianDigits(u.maxDevices)}
                      </span>
                    </td>
                    <td>
                      {u.suspended ? (
                        <span className="protocol-chip yellow">معلق</span>
                      ) : !u.enabled ? (
                        <span className="protocol-chip magenta">غیرفعال</span>
                      ) : expired ? (
                        <span className="protocol-chip magenta">منقضی</span>
                      ) : (
                        <span className="protocol-chip green">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#69f0ae] animate-status-blink" />
                          فعال
                        </span>
                      )}
                    </td>
                    <td>
                      {u.tags && (
                        <div className="flex flex-wrap gap-1">
                          {u.tags.split(",").map((t) => (
                            <span key={t} className="protocol-chip">
                              {t.trim()}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => copySub(u)}
                          className="p-1.5 rounded hover:bg-[#2de8d0]/10 text-muted-foreground hover:text-[#2de8d0]"
                          title="کپی لینک اشتراک"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <a
                          href={`/sub/${u.subToken}`}
                          target="_blank"
                          className="p-1.5 rounded hover:bg-[#2de8d0]/10 text-muted-foreground hover:text-[#2de8d0]"
                          title="مشاهده صفحه اشتراک"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="p-1.5 rounded hover:bg-[#2de8d0]/10 text-muted-foreground hover:text-[#2de8d0]">
                              <MoreVertical className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            className="bg-[#0a0e1a] border-[#2de8d0]/30"
                          >
                            <DropdownMenuItem
                              onClick={() => setEditingUser(u)}
                              className="text-[#2de8d0] focus:bg-[#2de8d0]/10"
                            >
                              <Edit className="w-4 h-4 ml-2" /> ویرایش
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setCloneSource(u)}
                              className="text-[#b388ff] focus:bg-[#b388ff]/10"
                            >
                              <CopyPlus className="w-4 h-4 ml-2" /> شبیه‌سازی
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => toggleUser(u)}
                              className="text-[#ffd54f] focus:bg-[#ffd54f]/10"
                            >
                              <Power className="w-4 h-4 ml-2" />{" "}
                              {u.enabled ? "غیرفعال‌سازی" : "فعال‌سازی"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => resetUsage(u)}
                              className="text-[#69f0ae] focus:bg-[#69f0ae]/10"
                            >
                              <RotateCcw className="w-4 h-4 ml-2" /> صفر کردن مصرف
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-[#2de8d0]/15" />
                            <DropdownMenuItem
                              onClick={() => deleteUser(u)}
                              className="text-[#ff2f6e] focus:bg-[#ff2f6e]/10"
                            >
                              <Trash2 className="w-4 h-4 ml-2" /> حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlowCard>

      {/* Create dialog */}
      {showCreate && (
        <UserDialog
          plans={plans}
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            load();
          }}
        />
      )}

      {/* Edit dialog */}
      {editingUser && (
        <UserDialog
          user={editingUser}
          plans={plans}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
            load();
          }}
        />
      )}

      {/* Clone dialog */}
      {cloneSource && (
        <CloneDialog
          source={cloneSource}
          onClose={() => setCloneSource(null)}
          onCloned={() => {
            setCloneSource(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function UserDialog({
  user,
  plans,
  onClose,
  onSaved,
}: {
  user?: User;
  plans: Plan[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [username, setUsername] = useState(user?.username || "");
  const [dataLimitGb, setDataLimitGb] = useState(
    user && Number(user.dataLimitBytes) > 0
      ? String(Number(user.dataLimitBytes) / 1e9)
      : ""
  );
  const [expireAt, setExpireAt] = useState(
    user?.expireAt ? new Date(user.expireAt).toISOString().slice(0, 10) : ""
  );
  const [maxDevices, setMaxDevices] = useState(user?.maxDevices || 3);
  const [enabled, setEnabled] = useState(user?.enabled ?? true);
  const [notes, setNotes] = useState(user?.notes || "");
  const [tags, setTags] = useState(user?.tags || "");
  const [allowedIps, setAllowedIps] = useState(user?.allowedIps || "");
  const [planId, setPlanId] = useState(user?.planId || "");
  const [loading, setLoading] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        username,
        dataLimitGb: Number(dataLimitGb) || 0,
        expireAt: expireAt ? new Date(expireAt).toISOString() : null,
        maxDevices: Number(maxDevices),
        enabled,
        notes,
        tags,
        allowedIps,
        planId: planId || null,
      };
      const res = user
        ? await fetch(`/api/users/${user.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "خطا در ذخیره");
      } else {
        toast.success(user ? "کاربر ویرایش شد" : "کاربر ایجاد شد");
        onSaved();
      }
    } catch {
      toast.error("خطای شبکه");
    } finally {
      setLoading(false);
    }
  }

  function applyPlan(pid: string) {
    setPlanId(pid);
    const p = plans.find((x) => x.id === pid);
    if (p) {
      if (p.dataLimitGb > 0) setDataLimitGb(String(p.dataLimitGb));
      setMaxDevices(p.maxDevices);
      if (p.durationDays > 0 && !expireAt) {
        const d = new Date();
        d.setDate(d.getDate() + p.durationDays);
        setExpireAt(d.toISOString().slice(0, 10));
      }
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0e1a] border-[#2de8d0]/30 max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display neon-text-cyan">
            {user ? "ویرایش کاربر" : "ایجاد کاربر جدید"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="micro-label">نام کاربری</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="cyber-input mt-1"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="micro-label">انتخاب بسته</Label>
              <Select value={planId} onValueChange={applyPlan}>
                <SelectTrigger className="cyber-input mt-1">
                  <SelectValue placeholder="دلخواه" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — {toPersianDigits(p.dataLimitGb)}GB /{" "}
                      {toPersianDigits(p.durationDays)} روز
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="micro-label">سهمیه داده (GB) — خالی = نامحدود</Label>
              <Input
                type="number"
                step="0.1"
                value={dataLimitGb}
                onChange={(e) => setDataLimitGb(e.target.value)}
                className="cyber-input mt-1"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="micro-label">تاریخ انقضا (میلادی)</Label>
              <Input
                type="date"
                value={expireAt}
                onChange={(e) => setExpireAt(e.target.value)}
                className="cyber-input mt-1"
                dir="ltr"
              />
              {expireAt && (
                <div className="text-xs text-muted-foreground mt-1">
                  {formatJalali(expireAt, true)}
                </div>
              )}
            </div>
            <div>
              <Label className="micro-label">حداکثر دستگاه</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={maxDevices}
                onChange={(e) => setMaxDevices(Number(e.target.value))}
                className="cyber-input mt-1"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="micro-label">IPهای مجاز (با کاما جدا کنید)</Label>
              <Input
                value={allowedIps}
                onChange={(e) => setAllowedIps(e.target.value)}
                placeholder="1.2.3.4, 5.6.7.0/24"
                className="cyber-input mt-1"
                dir="ltr"
              />
            </div>
            <div className="col-span-2">
              <Label className="micro-label">برچسب‌ها (با کاما)</Label>
              <Input
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="ویژه, سازمانی"
                className="cyber-input mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label className="micro-label">یادداشت</Label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="cyber-input mt-1 w-full px-3 py-2 resize-none"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <Label className="text-sm">فعال</Label>
            </div>
          </div>
          <DialogFooter>
            <CyberButton variant="cyan" type="button" onClick={onClose}>
              انصراف
            </CyberButton>
            <CyberButton variant="magenta" type="submit" loading={loading}>
              {user ? "ذخیره تغییرات" : "ایجاد کاربر"}
            </CyberButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CloneDialog({
  source,
  onClose,
  onCloned,
}: {
  source: User;
  onClose: () => void;
  onCloned: () => void;
}) {
  const [newUsername, setNewUsername] = useState(`${source.username}-copy`);
  const [loading, setLoading] = useState(false);

  async function handleClone(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/users/clone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: source.id, newUsername }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "خطا");
      } else {
        toast.success("کاربر شبیه‌سازی شد");
        onCloned();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0e1a] border-[#b388ff]/30 max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display neon-text-purple">
            شبیه‌سازی کاربر «{source.username}»
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleClone} className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            کاربر جدید با همان تنظیمات (سهمیه، انقضا، دستگاه‌ها، برچسب‌ها) اما با UUID و
            subToken جدید ایجاد می‌شود. مصرف جدید صفر است و انقضا ۳۰ روز جلوتر می‌رود.
          </p>
          <div>
            <Label className="micro-label">نام کاربری جدید</Label>
            <Input
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              required
              className="cyber-input mt-1"
              dir="ltr"
            />
          </div>
          <DialogFooter>
            <CyberButton variant="cyan" type="button" onClick={onClose}>
              انصراف
            </CyberButton>
            <CyberButton variant="magenta" type="submit" loading={loading}>
              شبیه‌سازی
            </CyberButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
