"use client";

import { useEffect, useState, useCallback } from "react";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { MicroLabel } from "@/components/cyber/micro-label";
import { CyberButton } from "@/components/cyber/cyber-button";
import { GlowCard } from "@/components/cyber/glow-card";
import { Network, Plus, Trash2, Edit, Power } from "lucide-react";
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

interface Inbound {
  id: string;
  tag: string;
  protocol: string;
  port: number;
  network: string;
  security: string;
  path: string | null;
  serviceName: string | null;
  sni: string | null;
  note: string | null;
  enabled: boolean;
}

export default function InboundsPage() {
  const [inbounds, setInbounds] = useState<Inbound[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Inbound | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/inbounds", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setInbounds(data.inbounds);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function toggle(ib: Inbound) {
    await fetch(`/api/inbounds/${ib.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !ib.enabled }),
    });
    toast.success("تغییر وضعیت انجام شد");
    load();
  }

  async function remove(ib: Inbound) {
    if (!confirm(`حذف اینباند «${ib.tag}»؟`)) return;
    await fetch(`/api/inbounds/${ib.id}`, { method: "DELETE" });
    toast.success("حذف شد");
    load();
  }

  return (
    <div className="space-y-6 animate-fade-slide">
      <div className="flex justify-between items-center">
        <div>
          <PixelHeading as="h1" color="cyan">
            اینباندها
          </PixelHeading>
          <MicroLabel className="mt-1 block">مدیریت پروتکل‌ها و انتقال‌های Xray</MicroLabel>
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
          افزودن اینباند
        </CyberButton>
      </div>

      <GlowCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>تگ</th>
                <th>پروتکل</th>
                <th>انتقال</th>
                <th>امنیت</th>
                <th>پورت</th>
                <th>مسیر/سرویس</th>
                <th>SNI</th>
                <th>وضعیت</th>
                <th className="text-left">عملیات</th>
              </tr>
            </thead>
            <tbody>
              {inbounds.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center text-muted-foreground py-12">
                    {loading ? "در حال بارگذاری..." : "هیچ اینباندی تعریف نشده"}
                  </td>
                </tr>
              )}
              {inbounds.map((ib) => (
                <tr key={ib.id}>
                  <td className="font-mono-cyber text-sm">{ib.tag}</td>
                  <td>
                    <span className={`protocol-chip ${ib.protocol === "trojan" ? "magenta" : ib.protocol === "vmess" ? "purple" : ""}`}>
                      {ib.protocol}
                    </span>
                  </td>
                  <td className="font-mono-cyber text-sm">{ib.network}</td>
                  <td className="font-mono-cyber text-sm">{ib.security}</td>
                  <td className="font-mono-cyber">{ib.port}</td>
                  <td className="font-mono-cyber text-xs" dir="ltr">
                    {ib.path || ib.serviceName || "—"}
                  </td>
                  <td className="font-mono-cyber text-xs" dir="ltr">
                    {ib.sni || "—"}
                  </td>
                  <td>
                    {ib.enabled ? (
                      <span className="protocol-chip green">فعال</span>
                    ) : (
                      <span className="protocol-chip magenta">غیرفعال</span>
                    )}
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button
                        onClick={() => toggle(ib)}
                        className="p-1.5 rounded hover:bg-[#ffd54f]/10 text-muted-foreground hover:text-[#ffd54f]"
                        title={ib.enabled ? "غیرفعال" : "فعال"}
                      >
                        <Power className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditing(ib);
                          setShowForm(true);
                        }}
                        className="p-1.5 rounded hover:bg-[#2de8d0]/10 text-muted-foreground hover:text-[#2de8d0]"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(ib)}
                        className="p-1.5 rounded hover:bg-[#ff2f6e]/10 text-muted-foreground hover:text-[#ff2f6e]"
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
        <div className="flex items-center gap-2 mb-2">
          <Network className="w-4 h-4 neon-text-cyan" />
          <MicroLabel color="cyan">نکته</MicroLabel>
        </div>
        تمام اینباندها روی ۰.۰.۰.۰ گوش می‌دهند و TLS توسط پراکسی معکوس Railway خاتمه می‌یابد.
        برای استفاده عمومی از پورت ۴۴۳ (HTTPS/WSS) استفاده کنید. پروتکل‌های Reality و
        XTLS-Vision نیازمند اتصال TCP مستقیم هستند که در محیط Railway به‌صورت کامل کار نمی‌کنند.
      </div>

      {showForm && (
        <InboundForm
          inbound={editing}
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

function InboundForm({
  inbound,
  onClose,
  onSaved,
}: {
  inbound: Inbound | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tag, setTag] = useState(inbound?.tag || "");
  const [protocol, setProtocol] = useState(inbound?.protocol || "vless");
  const [port, setPort] = useState(inbound?.port || 8443);
  const [network, setNetwork] = useState(inbound?.network || "ws");
  const [security, setSecurity] = useState(inbound?.security || "tls");
  const [path, setPath] = useState(inbound?.path || "");
  const [serviceName, setServiceName] = useState(inbound?.serviceName || "");
  const [sni, setSni] = useState(inbound?.sni || "");
  const [note, setNote] = useState(inbound?.note || "");
  const [enabled, setEnabled] = useState(inbound?.enabled ?? true);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const body = {
        tag,
        protocol,
        port: Number(port),
        network,
        security,
        path: path || null,
        serviceName: serviceName || null,
        sni: sni || null,
        note: note || null,
        enabled,
      };
      const res = inbound
        ? await fetch(`/api/inbounds/${inbound.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          })
        : await fetch("/api/inbounds", {
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
      <DialogContent className="bg-[#0a0e1a] border-[#2de8d0]/30 max-w-xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="font-display neon-text-cyan">
            {inbound ? "ویرایش اینباند" : "افزودن اینباند"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={save} className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="micro-label">تگ</Label>
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                required
                className="cyber-input mt-1"
                dir="ltr"
                placeholder="vless-ws"
              />
            </div>
            <div>
              <Label className="micro-label">پورت</Label>
              <Input
                type="number"
                value={port}
                onChange={(e) => setPort(Number(e.target.value))}
                className="cyber-input mt-1"
                dir="ltr"
              />
            </div>
            <div>
              <Label className="micro-label">پروتکل</Label>
              <Select value={protocol} onValueChange={setProtocol}>
                <SelectTrigger className="cyber-input mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vless">vless</SelectItem>
                  <SelectItem value="vmess">vmess</SelectItem>
                  <SelectItem value="trojan">trojan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="micro-label">انتقال</Label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger className="cyber-input mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ws">ws</SelectItem>
                  <SelectItem value="grpc">grpc</SelectItem>
                  <SelectItem value="xhttp">xhttp</SelectItem>
                  <SelectItem value="tcp">tcp</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="micro-label">امنیت</Label>
              <Select value={security} onValueChange={setSecurity}>
                <SelectTrigger className="cyber-input mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">none (پشت TLS Railway)</SelectItem>
                  <SelectItem value="tls">tls</SelectItem>
                  <SelectItem value="reality">reality</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="micro-label">SNI</Label>
              <Input
                value={sni}
                onChange={(e) => setSni(e.target.value)}
                className="cyber-input mt-1"
                dir="ltr"
                placeholder="yourapp.up.railway.app"
              />
            </div>
            <div className="col-span-2">
              <Label className="micro-label">مسیر (WS/xHTTP)</Label>
              <Input
                value={path}
                onChange={(e) => setPath(e.target.value)}
                className="cyber-input mt-1"
                dir="ltr"
                placeholder="/vless-ws"
              />
            </div>
            <div className="col-span-2">
              <Label className="micro-label">serviceName (gRPC)</Label>
              <Input
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                className="cyber-input mt-1"
                dir="ltr"
                placeholder="vless-grpc"
              />
            </div>
            <div className="col-span-2">
              <Label className="micro-label">یادداشت</Label>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="cyber-input mt-1"
              />
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <Label>فعال</Label>
            </div>
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
