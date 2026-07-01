"use client";

import { useEffect, useState, useCallback } from "react";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { MicroLabel } from "@/components/cyber/micro-label";
import { CyberButton } from "@/components/cyber/cyber-button";
import { GlowCard } from "@/components/cyber/glow-card";
import { Package, Plus, Trash2, Edit } from "lucide-react";
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
import { toast } from "sonner";
import { toPersianDigits } from "@/lib/jalali";

interface Plan {
  id: string;
  name: string;
  dataLimitGb: number;
  durationDays: number;
  maxDevices: number;
  price: number;
  enabled: boolean;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Plan | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/plans", { cache: "no-store" });
      if (res.ok) setPlans((await res.json()).plans);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function remove(p: Plan) {
    if (!confirm(`حذف بسته «${p.name}»؟`)) return;
    await fetch(`/api/plans/${p.id}`, { method: "DELETE" });
    toast.success("حذف شد");
    load();
  }

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="flex justify-between items-center">
        <div>
          <PixelHeading as="h1" color="cyan">
            بسته‌ها
          </PixelHeading>
          <MicroLabel className="mt-1 block">پلن‌های پیش‌فرض برای ساخت سریع کاربر</MicroLabel>
        </div>
        <CyberButton
          variant="magenta"
          pulse
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
        >
          ایجاد بسته
        </CyberButton>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {plans.length === 0 && !loading && (
          <div className="col-span-full text-center text-muted-foreground py-12">
            بسته‌ای تعریف نشده
          </div>
        )}
        {plans.map((p) => (
          <GlowCard key={p.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Package className="w-5 h-5 neon-text-cyan" />
                <PixelHeading as="h3" color="cyan">
                  {p.name}
                </PixelHeading>
              </div>
              {p.enabled ? (
                <span className="protocol-chip green">فعال</span>
              ) : (
                <span className="protocol-chip magenta">غیرفعال</span>
              )}
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <MicroLabel>سهمیه داده</MicroLabel>
                <span className="font-mono-cyber neon-text-cyan">
                  {p.dataLimitGb > 0 ? `${toPersianDigits(p.dataLimitGb)} GB` : "نامحدود"}
                </span>
              </div>
              <div className="flex justify-between">
                <MicroLabel>مدت</MicroLabel>
                <span className="font-mono-cyber neon-text-magenta">
                  {toPersianDigits(p.durationDays)} روز
                </span>
              </div>
              <div className="flex justify-between">
                <MicroLabel>دستگاه</MicroLabel>
                <span className="font-mono-cyber neon-text-purple">
                  {toPersianDigits(p.maxDevices)}
                </span>
              </div>
              <div className="flex justify-between">
                <MicroLabel>قیمت</MicroLabel>
                <span className="font-mono-cyber neon-text-yellow">
                  {p.price > 0 ? `${toPersianDigits(p.price.toLocaleString("fa-IR"))} ت` : "رایگان"}
                </span>
              </div>
            </div>

            <div className="flex gap-2 mt-4 pt-3 border-t border-[#2de8d0]/15">
              <CyberButton
                variant="cyan"
                icon={<Edit className="w-3 h-3" />}
                className="flex-1 text-xs py-1.5"
                onClick={() => {
                  setEditing(p);
                  setShowForm(true);
                }}
              >
                ویرایش
              </CyberButton>
              <button
                onClick={() => remove(p)}
                className="px-3 py-1.5 rounded border border-[#ff2f6e]/40 text-[#ff2f6e] hover:bg-[#ff2f6e]/10 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </GlowCard>
        ))}
      </div>

      {showForm && (
        <PlanForm
          plan={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function PlanForm({
  plan,
  onClose,
  onSaved,
}: {
  plan: Plan | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(plan?.name || "");
  const [dataLimitGb, setDataLimitGb] = useState(plan?.dataLimitGb || 0);
  const [durationDays, setDurationDays] = useState(plan?.durationDays || 30);
  const [maxDevices, setMaxDevices] = useState(plan?.maxDevices || 3);
  const [price, setPrice] = useState(plan?.price || 0);
  const [enabled, setEnabled] = useState(plan?.enabled ?? true);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        name,
        dataLimitGb: Number(dataLimitGb),
        durationDays: Number(durationDays),
        maxDevices: Number(maxDevices),
        price: Number(price),
        enabled,
      };
      const res = plan
        ? await fetch(`/api/plans/${plan.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/plans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          });
      const data = await res.json();
      if (!res.ok) toast.error(data.error || "خطا");
      else {
        toast.success("ذخیره شد");
        onSaved();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="bg-[#0a0e1a] border-[#2de8d0]/30 max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display neon-text-cyan">
            {plan ? "ویرایش بسته" : "ایجاد بسته"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3 py-2">
          <div>
            <Label className="micro-label">نام</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="cyber-input mt-1"
            />
          </div>
          <div>
            <Label className="micro-label">سهمیه داده (GB) — ۰ = نامحدود</Label>
            <Input
              type="number"
              step="0.1"
              value={dataLimitGb}
              onChange={(e) => setDataLimitGb(Number(e.target.value))}
              className="cyber-input mt-1"
              dir="ltr"
            />
          </div>
          <div>
            <Label className="micro-label">مدت (روز)</Label>
            <Input
              type="number"
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className="cyber-input mt-1"
              dir="ltr"
            />
          </div>
          <div>
            <Label className="micro-label">حداکثر دستگاه</Label>
            <Input
              type="number"
              value={maxDevices}
              onChange={(e) => setMaxDevices(Number(e.target.value))}
              className="cyber-input mt-1"
              dir="ltr"
            />
          </div>
          <div>
            <Label className="micro-label">قیمت (تومان)</Label>
            <Input
              type="number"
              value={price}
              onChange={(e) => setPrice(Number(e.target.value))}
              className="cyber-input mt-1"
              dir="ltr"
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>فعال</Label>
          </div>
          <DialogFooter>
            <CyberButton variant="cyan" type="button" onClick={onClose}>
              انصراف
            </CyberButton>
            <CyberButton variant="magenta" type="submit" loading={loading}>
              ذخیره
            </CyberButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
