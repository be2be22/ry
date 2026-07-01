"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { useEffect } from "react";
import {
  Copy,
  Check,
  Download,
  Smartphone,
  Apple,
  Monitor,
  Zap,
  QrCode,
  ExternalLink,
  ShieldCheck,
  Clock,
  HardDrive,
  Activity,
  Terminal,
  AlertTriangle,
} from "lucide-react";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { MicroLabel } from "@/components/cyber/micro-label";
import { toast } from "sonner";
import { toPersianDigits } from "@/lib/jalali";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ProtocolConfig {
  index: number;
  name: string;
  protocol: string;
  transport: string;
  security: string;
  uri: string;
  tag: string;
  color: string;
  remark: string;
}

interface SubscriptionClientProps {
  user: {
    username: string;
    enabled: boolean;
    suspended: boolean;
    expireAt: string | null;
    expireAtJalali: string;
    dataLimitBytes: number;
    usedBytes: number;
    remainBytes: number;
    usedPct: number;
    days: number;
    dayPct: number;
    expired: boolean;
    maxDevices: number;
    notes: string | null;
    tags: string | null;
  };
  configs: ProtocolConfig[];
  host: string;
  subscriptionUrl: string;
  base64Url: string;
}

export function SubscriptionClient({
  user,
  configs,
  host,
  subscriptionUrl,
  base64Url,
}: SubscriptionClientProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState(0);

  async function copy(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      toast.success("کپی شد!");
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("کپی ناموفق بود");
    }
  }

  function downloadAll() {
    const blob = configs.map((c) => c.uri).join("\n");
    const url = URL.createObjectURL(new Blob([blob], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${user.username}-configs.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("دانلود شروع شد");
  }

  const cfg = configs[selectedConfig];

  return (
    <div className="min-h-screen bg-arcade particles-bg relative overflow-hidden">
      {/* Animated gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2de8d0]/5 via-transparent to-[#ff2f6e]/5 animate-gradient pointer-events-none" />

      {/* Scanlines */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#2de8d0] to-transparent opacity-60" />

      <div className="relative-z max-w-5xl mx-auto p-4 md:p-8 space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg neon-border-cyan mb-3 animate-cyan-breath">
            <Terminal className="w-8 h-8 neon-text-cyan" />
          </div>
          <PixelHeading as="h1" color="cyan">
            اشتراک شما
          </PixelHeading>
          <MicroLabel color="cyan" className="mt-2 block">
            {user.username} @ CyberX
          </MicroLabel>
        </div>

        {/* Status banner if expired/suspended */}
        {(user.expired || user.suspended || !user.enabled) && (
          <div className="glass-strong cyber-card-magenta p-4 flex items-center gap-3 animate-fade-slide">
            <AlertTriangle className="w-6 h-6 neon-text-magenta flex-shrink-0" />
            <div>
              <div className="font-bold neon-text-magenta">
                {user.expired
                  ? "اشتراک شما منقضی شده است"
                  : user.suspended
                  ? "اشتراک شما معلق شده است"
                  : "اشتراک شما غیرفعال است"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                برای تمدید با پشتیبانی تماس بگیرید
              </div>
            </div>
          </div>
        )}

        {/* Top glass card — usage + expiry */}
        <div className="glass-strong rounded-xl p-6 space-y-5 animate-fade-slide">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 neon-text-cyan" />
              <MicroLabel color="cyan">اطلاعات اشتراک</MicroLabel>
            </div>
            <span className="protocol-chip">
              {toPersianDigits(configs.length)} کانفیگ
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Data usage */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <MicroLabel>
                  <HardDrive className="inline w-3 h-3 ml-1" />
                  مصرف داده
                </MicroLabel>
                <span className="text-xs font-mono-cyber neon-text-cyan">
                  {user.dataLimitBytes > 0
                    ? `${formatBytes(user.usedBytes)} / ${formatBytes(user.dataLimitBytes)}`
                    : `${formatBytes(user.usedBytes)} / نامحدود`}
                </span>
              </div>
              <div className="progress-cyber h-3">
                <div
                  className={cn(
                    "progress-cyber-bar",
                    user.usedPct > 85 && "danger",
                    user.usedPct > 65 && user.usedPct <= 85 && "warn"
                  )}
                  style={{ width: `${user.usedPct}%` }}
                />
              </div>
              {user.dataLimitBytes > 0 && (
                <div className="text-xs text-muted-foreground mt-1.5">
                  {formatBytes(user.remainBytes)} باقی‌مانده
                </div>
              )}
            </div>

            {/* Days remaining */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <MicroLabel color="magenta">
                  <Clock className="inline w-3 h-3 ml-1" />
                  زمان باقی‌مانده
                </MicroLabel>
                <span className="text-xs font-mono-cyber neon-text-magenta">
                  {user.expireAt ? (user.expired ? "منقضی" : `${toPersianDigits(user.days)} روز`) : "نامحدود"}
                </span>
              </div>
              <div className="progress-cyber h-3">
                <div
                  className="progress-cyber-bar danger"
                  style={{
                    width: user.expireAt ? `${user.dayPct}%` : "100%",
                    background: user.expired
                      ? "linear-gradient(90deg, #ff2f6e, #ff6b6b)"
                      : undefined,
                  }}
                />
              </div>
              {user.expireAt && (
                <div className="text-xs text-muted-foreground mt-1.5">
                  انقضا: {user.expireAtJalali}
                </div>
              )}
            </div>
          </div>

          {/* Subscription link block */}
          <div className="pt-3 border-t border-[#2de8d0]/15">
            <MicroLabel className="mb-2 block">لینک اشتراک (Subscription URL)</MicroLabel>
            <div className="flex gap-2">
              <input
                readOnly
                value={subscriptionUrl}
                onClick={(e) => (e.target as HTMLInputElement).select()}
                className="cyber-input flex-1 px-3 py-2 text-xs"
                dir="ltr"
              />
              <button
                onClick={() => copy(subscriptionUrl, "sub")}
                className="px-3 py-2 rounded border border-[#2de8d0]/40 text-[#2de8d0] hover:bg-[#2de8d0]/10 transition-all"
                title="کپی لینک"
              >
                {copied === "sub" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
              <button
                onClick={downloadAll}
                className="px-3 py-2 rounded border border-[#ff2f6e]/40 text-[#ff2f6e] hover:bg-[#ff2f6e]/10 transition-all"
                title="دانلود همه"
              >
                <Download className="w-4 h-4" />
              </button>
            </div>
            <div className="text-[10px] text-muted-foreground mt-1.5">
              این لینک را در v2rayNG، Hiddify، Streisand یا NapsternetV قرار دهید
            </div>
          </div>
        </div>

        {/* Configs grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <PixelHeading as="h3" color="cyan">
              کانفیگ‌ها
            </PixelHeading>
            <MicroLabel>برای مشاهده QR روی کانفیگ کلیک کنید</MicroLabel>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {configs.map((c, i) => {
              const colorClass = {
                cyan: "border-[#2de8d0]/40 hover:bg-[#2de8d0]/8",
                magenta: "border-[#ff2f6e]/40 hover:bg-[#ff2f6e]/8",
                purple: "border-[#b388ff]/40 hover:bg-[#b388ff]/8",
                yellow: "border-[#ffd54f]/40 hover:bg-[#ffd54f]/8",
                green: "border-[#69f0ae]/40 hover:bg-[#69f0ae]/8",
              }[c.color] || "border-[#2de8d0]/40";

              return (
                <button
                  key={c.index}
                  onClick={() => setSelectedConfig(i)}
                  className={cn(
                    "glass rounded-lg p-3 border-2 transition-all text-right",
                    colorClass,
                    selectedConfig === i && "ring-2 ring-[#2de8d0]/50"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono-cyber text-xs neon-text-cyan">
                      #{toPersianDigits(c.index)}
                    </span>
                    <QrCode
                      className={cn(
                        "w-4 h-4",
                        selectedConfig === i ? "neon-text-cyan" : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div className="font-bold text-sm">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 font-mono-cyber" dir="ltr">
                    {c.protocol}/{c.transport}/{c.security}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected config detail with QR */}
        <div className="glass-strong rounded-xl p-6 animate-fade-slide">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* QR code */}
            <div className="flex flex-col items-center justify-center">
              <div className="bg-white p-3 rounded-lg">
                <QRCodeSVG text={cfg.uri} />
              </div>
              <div className="mt-3 text-center">
                <div className="font-bold neon-text-cyan">{cfg.name}</div>
                <div className="text-xs text-muted-foreground mt-1">با اپ دوربین را اسکن کنید</div>
              </div>
            </div>

            {/* Detail */}
            <div className="space-y-4">
              <div>
                <MicroLabel className="mb-1.5 block">لینک کانفیگ</MicroLabel>
                <div className="flex gap-2">
                  <textarea
                    readOnly
                    value={cfg.uri}
                    onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                    className="cyber-input flex-1 px-3 py-2 text-[10px] h-20 resize-none"
                    dir="ltr"
                  />
                  <button
                    onClick={() => copy(cfg.uri, `cfg-${cfg.index}`)}
                    className="px-3 py-2 rounded border border-[#ff2f6e]/40 text-[#ff2f6e] hover:bg-[#ff2f6e]/10 transition-all flex-shrink-0"
                  >
                    {copied === `cfg-${cfg.index}` ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="cyber-card p-2 rounded">
                  <MicroLabel>پروتکل</MicroLabel>
                  <div className="font-mono-cyber neon-text-cyan text-sm mt-1">
                    {cfg.protocol}
                  </div>
                </div>
                <div className="cyber-card p-2 rounded">
                  <MicroLabel>انتقال</MicroLabel>
                  <div className="font-mono-cyber neon-text-magenta text-sm mt-1">
                    {cfg.transport}
                  </div>
                </div>
                <div className="cyber-card p-2 rounded">
                  <MicroLabel>امنیت</MicroLabel>
                  <div className="font-mono-cyber neon-text-green text-sm mt-1">
                    {cfg.security}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <DeepLinkButton platform="v2rayng" uri={cfg.uri} />
                <DeepLinkButton platform="hiddify" subUrl={subscriptionUrl} />
                <DeepLinkButton platform="streisand" subUrl={subscriptionUrl} />
              </div>
            </div>
          </div>
        </div>

        {/* Install guides */}
        <div>
          <PixelHeading as="h3" color="magenta" className="mb-3">
            راهنمای نصب
          </PixelHeading>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <InstallGuide
              icon={<Smartphone className="w-5 h-5" />}
              title="اندروید"
              steps={[
                "اپ v2rayNG یا Hiddify را از گوگل‌پلی یا گیت‌هاب نصب کنید",
                "روی + ضربه بزنید و «اشتراک را وارد کنید» را انتخاب کنید",
                "لینک اشتراک بالا را پیست کرده و ذخیره کنید",
                "کانفیگ مورد نظر را انتخاب و روی V بزنید",
              ]}
            />
            <InstallGuide
              icon={<Apple className="w-5 h-5" />}
              title="iOS"
              steps={[
                "از اپ‌استور، Streisand یا V2Box را نصب کنید",
                "به بخش «اشتراک‌ها» بروید و + را بزنید",
                "لینک اشتراک را پیست کنید",
                "کانفیگ را انتخاب و متصل شوید",
              ]}
            />
            <InstallGuide
              icon={<Monitor className="w-5 h-5" />}
              title="ویندوز"
              steps={[
                "اپ Hiddify-Next یا v2rayN را دانلود و نصب کنید",
                "از منوی «Subscription» گزینه «Add» را بزنید",
                "لینک اشتراک را وارد کنید و آپدیت کنید",
                "از لیست، کانفیگ را انتخاب و «Connect» را بزنید",
              ]}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground py-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Activity className="w-3 h-3 neon-text-cyan" />
            <span>CyberX VPN Panel — Powered by Xray-core</span>
          </div>
          <div>تمام حقوق محفوظ است • {toPersianDigits(new Date().getFullYear())}</div>
        </div>
      </div>
    </div>
  );
}

function QRCodeSVG({ text }: { text: string }) {
  const [dataUrl, setDataUrl] = useState<string>("");
  useEffect(() => {
    QRCode.toDataURL(text, {
      width: 200,
      margin: 1,
      color: { dark: "#000000", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setDataUrl);
  }, [text]);
  return dataUrl ? (
     
    <img src={dataUrl} alt="QR" width={200} height={200} />
  ) : (
    <div className="w-[200px] h-[200px] flex items-center justify-center text-muted-foreground text-xs">
      در حال تولید...
    </div>
  );
}

function DeepLinkButton({
  platform,
  uri,
  subUrl,
}: {
  platform: "v2rayng" | "hiddify" | "streisand";
  uri?: string;
  subUrl?: string;
}) {
  const href =
    platform === "v2rayng"
      ? `v2rayng://${uri ? encodeURIComponent(uri) : ""}`
      : platform === "hiddify"
      ? `hiddify://import/${encodeURIComponent(subUrl || "")}`
      : `streisand://import/${encodeURIComponent(subUrl || "")}`;

  const label =
    platform === "v2rayng" ? "افزودن به v2rayNG" : platform === "hiddify" ? "افزودن به Hiddify" : "افزودن به Streisand";

  return (
    <a
      href={href}
      className="btn-arcade-cyan inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs"
    >
      <Zap className="w-3 h-3" />
      {label}
    </a>
  );
}

function InstallGuide({
  icon,
  title,
  steps,
}: {
  icon: React.ReactNode;
  title: string;
  steps: string[];
}) {
  return (
    <div className="glass rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <div className="neon-text-cyan">{icon}</div>
        <PixelHeading as="h4" color="cyan">
          {title}
        </PixelHeading>
      </div>
      <ol className="space-y-2 text-xs">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span className="flex-shrink-0 w-5 h-5 rounded border border-[#2de8d0]/40 text-[#2de8d0] flex items-center justify-center text-[10px] font-mono-cyber">
              {toPersianDigits(i + 1)}
            </span>
            <span className="text-muted-foreground leading-relaxed">{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
