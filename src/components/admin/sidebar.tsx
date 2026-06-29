"use client";

import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Settings2,
  Server,
  Users,
  Activity,
  Cloud,
  LogOut,
  type LucideIcon,
} from "lucide-react";

export type AdminTab = "dashboard" | "configs" | "servers" | "users" | "stats" | "settings";

interface NavItem {
  id: AdminTab;
  label: string;
  icon: LucideIcon;
  description: string;
}

const navItems: NavItem[] = [
  { id: "dashboard", label: "داشبورد", icon: LayoutDashboard, description: "نمای کلی" },
  { id: "configs", label: "کانفیگ‌ها", icon: Settings2, description: "مدیریت کانفیگ‌ها" },
  { id: "servers", label: "سرورها", icon: Server, description: "مدیریت سرورها" },
  { id: "users", label: "کاربران", icon: Users, description: "مدیریت کاربران" },
  { id: "stats", label: "آمار و گزارش", icon: Activity, description: "گزارش‌های تفصیلی" },
  { id: "settings", label: "تنظیمات", icon: Cloud, description: "تنظیمات پنل" },
];

interface SidebarProps {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
  onLogout: () => void;
  admin: { username: string; email?: string | null };
  counts?: { configs?: number; servers?: number; users?: number };
}

export function Sidebar({ active, onChange, onLogout, admin, counts }: SidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-72 h-screen sticky top-0 glass-strong border-l border-white/10 p-4">
      {/* Logo */}
      <div className="flex items-center gap-3 px-2 py-4 mb-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{
            background: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
            boxShadow: "0 6px 20px oklch(0.65 0.25 290 / 30%)",
          }}
        >
          <Cloud className="w-6 h-6 text-white" strokeWidth={2.5} />
        </div>
        <div className="min-w-0">
          <div className="font-bold text-base gradient-text leading-tight">FastApiCloud</div>
          <div className="text-[11px] text-muted-foreground">پنل مدیریت WS</div>
        </div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = active === item.id;
          const Icon = item.icon;
          const count =
            item.id === "configs" ? counts?.configs
            : item.id === "servers" ? counts?.servers
            : item.id === "users" ? counts?.users
            : undefined;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className="relative w-full text-right group"
            >
              <div
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? "glass border border-white/15"
                    : "hover:bg-white/5 border border-transparent"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-7 rounded-l-full"
                    style={{
                      background: "linear-gradient(180deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
                    }}
                  />
                )}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                    isActive ? "text-white" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                  style={isActive ? {
                    background: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
                  } : undefined}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"}`}>
                    {item.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground/70 truncate">
                    {item.description}
                  </div>
                </div>
                {count !== undefined && count > 0 && (
                  <span className="text-[10px] font-mono bg-white/10 rounded-full px-2 py-0.5">
                    {count}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Admin profile + logout */}
      <div className="mt-4 space-y-2">
        <div className="glass rounded-xl p-3 flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            style={{
              background: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
            }}
          >
            {admin.username.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{admin.username}</div>
            <div className="text-[11px] text-muted-foreground truncate" dir="ltr">
              {admin.email || "admin@fastapicloud.com"}
            </div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          خروج از حساب
        </button>
      </div>
    </aside>
  );
}

// Mobile bottom nav for small screens
interface MobileNavProps {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
}

export function MobileNav({ active, onChange }: MobileNavProps) {
  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 glass-strong border-t border-white/10 z-50">
      <div className="grid grid-cols-6 gap-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className={`flex flex-col items-center gap-1 py-2 rounded-lg transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-[9px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
