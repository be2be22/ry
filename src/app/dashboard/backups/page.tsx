"use client";

import { useEffect, useState, useCallback } from "react";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { MicroLabel } from "@/components/cyber/micro-label";
import { CyberButton } from "@/components/cyber/cyber-button";
import { GlowCard } from "@/components/cyber/glow-card";
import { DatabaseBackup, Download, Trash2, Plus } from "lucide-react";
import { formatJalaliDateTime, toPersianDigits } from "@/lib/jalali";
import { formatBytes } from "@/lib/format";
import { toast } from "sonner";

interface Backup {
  id: string;
  filename: string;
  size: string;
  createdAt: string;
}

export default function BackupsPage() {
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/backups", { cache: "no-store" });
      if (res.ok) setBackups((await res.json()).backups);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createBackup() {
    setCreating(true);
    try {
      const res = await fetch("/api/backups", { method: "POST" });
      if (res.ok) {
        toast.success("بکاپ ساخته شد");
        load();
      } else {
        toast.error("خطا در ساخت بکاپ");
      }
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("حذف این بکاپ؟")) return;
    await fetch(`/api/backups/${id}`, { method: "DELETE" });
    toast.success("حذف شد");
    load();
  }

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="flex justify-between items-center">
        <div>
          <PixelHeading as="h1" color="cyan">
            بکاپ‌ها
          </PixelHeading>
          <MicroLabel className="mt-1 block">پشتیبان‌گیری و بازیابی دیتابیس</MicroLabel>
        </div>
        <CyberButton
          variant="magenta"
          pulse
          loading={creating}
          icon={<Plus className="w-4 h-4" />}
          onClick={createBackup}
        >
          ساخت بکاپ
        </CyberButton>
      </div>

      <GlowCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>نام فایل</th>
                <th>حجم</th>
                <th>تاریخ</th>
                <th className="text-left">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {backups.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-center text-muted-foreground py-12">
                    {loading ? "در حال بارگذاری..." : "بکاپی وجود ندارد"}
                  </td>
                </tr>
              )}
              {backups.map((b) => (
                <tr key={b.id}>
                  <td>
                    <div className="flex items-center gap-2">
                      <DatabaseBackup className="w-4 h-4 neon-text-cyan" />
                      <span className="font-mono-cyber text-xs" dir="ltr">
                        {b.filename}
                      </span>
                    </div>
                  </td>
                  <td className="font-mono-cyber text-sm">
                    {formatBytes(Number(b.size))}
                  </td>
                  <td className="text-xs">{formatJalaliDateTime(b.createdAt)}</td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <a
                        href={`/api/backups/${b.id}`}
                        className="p-1.5 rounded hover:bg-[#2de8d0]/10 text-muted-foreground hover:text-[#2de8d0]"
                        title="دانلود"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => remove(b.id)}
                        className="p-1.5 rounded hover:bg-[#ff2f6e]/10 text-muted-foreground hover:text-[#ff2f6e]"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlowCard>

      <div className="cyber-card p-4 text-xs text-muted-foreground leading-relaxed">
        <div className="flex items-center gap-2 mb-1">
          <DatabaseBackup className="w-4 h-4 neon-text-cyan" />
          <MicroLabel color="cyan">نکته</MicroLabel>
        </div>
        بکاپ‌ها از فایل دیتابیس SQLite کپی می‌گیرند. برای بکاپ‌گیری خودکار، در تنظیمات گزینه
        «بکاپ خودکار» را فعال کنید. تعداد کل: {toPersianDigits(backups.length)} بکاپ.
      </div>
    </div>
  );
}
