"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { useXray } from "@/components/xray-provider";
import {
  LayoutDashboard,
  Users,
  Network,
  Package,
  Settings,
  ScrollText,
  DatabaseBackup,
  Activity,
  LogOut,
  Terminal,
  RefreshCw,
  Play,
  Square,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { PixelHeading } from "@/components/cyber/pixel-heading";
import { MicroLabel } from "@/components/cyber/micro-label";

const NAV = [
  { href: "/dashboard", label: "داشبورد", icon: LayoutDashboard },
  { href: "/dashboard/users", label: "کاربران", icon: Users },
  { href: "/dashboard/inbounds", label: "اینباندها", icon: Network },
  { href: "/dashboard/plans", label: "بسته‌ها", icon: Package },
  { href: "/dashboard/audit", label: "لاگ ممیزی", icon: ScrollText },
  { href: "/dashboard/backups", label: "بکاپ‌ها", icon: DatabaseBackup },
  { href: "/dashboard/settings", label: "تنظیمات", icon: Settings },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state: xrayState, restart, start, stop, loading: xrayLoading } = useXray();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // mount flag for theme toggle (avoid hydration mismatch)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  return (
    <div className="min-h-screen bg-arcade flex flex-col">
      {/* Top scanline */}
      <div className="h-px bg-gradient-to-r from-transparent via-[#2de8d0] to-transparent opacity-60" />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-16 md:w-60 border-l border-[#2de8d0]/15 bg-[#070b15]/80 backdrop-blur flex flex-col">
          {/* Logo */}
          <div className="p-4 border-b border-[#2de8d0]/15 flex items-center gap-2">
            <div className="w-9 h-9 rounded neon-border-cyan flex items-center justify-center flex-shrink-0">
              <Terminal className="w-5 h-5 neon-text-cyan" />
            </div>
            <div className="hidden md:block">
              <PixelHeading as="h3" color="cyan">
                CyberX
              </PixelHeading>
              <MicroLabel>پنل مدیریت</MicroLabel>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
            {NAV.map((item) => {
              const active =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded text-sm transition-all",
                    active
                      ? "neon-text-cyan bg-[#2de8d0]/8 border border-[#2de8d0]/30"
                      : "text-muted-foreground hover:text-[#2de8d0] hover:bg-[#2de8d0]/4 border border-transparent"
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="hidden md:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Xray status footer */}
          <div className="p-3 border-t border-[#2de8d0]/15 space-y-2">
            <div className="hidden md:block">
              <MicroLabel>وضعیت Xray</MicroLabel>
            </div>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-2 h-2 rounded-full",
                  xrayState?.running ? "bg-[#69f0ae] animate-status-blink" : "bg-[#ff3b3b]"
                )}
              />
              <span className="text-xs hidden md:inline">
                {xrayState?.running ? "در حال اجرا" : "متوقف"}
                {xrayState?.mode === "simulated" && (
                  <span className="text-[10px] text-muted-foreground mr-1">(شبیه‌سازی)</span>
                )}
              </span>
            </div>
            <div className="flex gap-1">
              {xrayState?.running ? (
                <>
                  <button
                    onClick={() => restart()}
                    disabled={xrayLoading}
                    title="ری‌استارت"
                    className="flex-1 p-1.5 rounded border border-[#2de8d0]/30 text-[#2de8d0] hover:bg-[#2de8d0]/10 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3 mx-auto" />
                  </button>
                  <button
                    onClick={() => stop()}
                    disabled={xrayLoading}
                    title="توقف"
                    className="flex-1 p-1.5 rounded border border-[#ff3b3b]/30 text-[#ff3b3b] hover:bg-[#ff3b3b]/10 transition-colors"
                  >
                    <Square className="w-3 h-3 mx-auto" />
                  </button>
                </>
              ) : (
                <button
                  onClick={() => start()}
                  disabled={xrayLoading}
                  title="اجرا"
                  className="flex-1 p-1.5 rounded border border-[#69f0ae]/30 text-[#69f0ae] hover:bg-[#69f0ae]/10 transition-colors"
                >
                  <Play className="w-3 h-3 mx-auto" />
                </button>
              )}
            </div>
          </div>

          {/* Bottom actions */}
          <div className="p-2 border-t border-[#2de8d0]/15 space-y-1">
            <Link
              href="/status"
              className="flex items-center gap-3 px-3 py-2 rounded text-sm text-muted-foreground hover:text-[#2de8d0] hover:bg-[#2de8d0]/4 transition-all"
            >
              <Activity className="w-4 h-4 flex-shrink-0" />
              <span className="hidden md:inline">صفحه وضعیت</span>
            </Link>
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-muted-foreground hover:text-[#2de8d0] hover:bg-[#2de8d0]/4 transition-all"
            >
              {mounted && theme === "dark" ? (
                <Sun className="w-4 h-4 flex-shrink-0" />
              ) : (
                <Moon className="w-4 h-4 flex-shrink-0" />
              )}
              <span className="hidden md:inline">
                {mounted && theme === "dark" ? "حالت روشن" : "حالت تاریک"}
              </span>
            </button>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-[#ff2f6e] hover:bg-[#ff2f6e]/10 transition-all"
            >
              <LogOut className="w-4 h-4 flex-shrink-0" />
              <span className="hidden md:inline">خروج</span>
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto bg-arcade-gradient">
          <div className="p-4 md:p-6 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
}
