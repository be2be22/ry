"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { LoginScreen } from "@/components/admin/login-screen";
import { Sidebar, MobileNav, type AdminTab } from "@/components/admin/sidebar";
import { Dashboard } from "@/components/admin/dashboard";
import { ConfigsTable } from "@/components/admin/configs-table";
import { ServersManager } from "@/components/admin/servers-manager";
import { UsersManager } from "@/components/admin/users-manager";
import { StatsView } from "@/components/admin/stats-view";
import { SettingsView } from "@/components/admin/settings-view";

interface Admin {
  id: string;
  username: string;
  role: string;
  email?: string | null;
}

export default function Home() {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [counts, setCounts] = useState<{ configs?: number; servers?: number; users?: number }>({});

  // Check existing session on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/auth/check");
        const data = await res.json();
        if (data.ok && data.admin) setAdmin(data.admin);
      } catch {
        // ignore
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAdmin(null);
      setTab("dashboard");
      toast.success("از حساب خارج شدید");
    }
  }, []);

  const handleSeed = useCallback(async () => {
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast.success(data.message || "داده‌های نمونه ایجاد شدند");
      } else {
        toast.error(data.error || "خطا در ایجاد داده‌های نمونه");
      }
    } catch {
      toast.error("خطای شبکه");
    }
  }, []);

  // Loading screen
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white animate-pulse-glow"
            style={{
              background: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
            }}
          >
            <Cloud className="w-8 h-8" strokeWidth={2.5} />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            در حال بارگذاری پنل...
          </div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!admin) {
    return <LoginScreen onLogin={(a) => setAdmin(a)} />;
  }

  // Logged in — render dashboard
  return (
    <div className="min-h-screen flex">
      {/* Desktop sidebar */}
      <Sidebar
        active={tab}
        onChange={setTab}
        onLogout={handleLogout}
        admin={admin}
        counts={counts}
      />

      {/* Main content */}
      <main className="flex-1 min-w-0 pb-24 lg:pb-0">
        {/* Mobile header */}
        <div className="lg:hidden glass-strong sticky top-0 z-40 px-4 py-3 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white"
              style={{
                background: "linear-gradient(135deg, oklch(0.65 0.25 290), oklch(0.7 0.2 320))",
              }}
            >
              <Cloud className="w-5 h-5" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-bold text-sm gradient-text leading-tight">FastApiCloud</div>
              <div className="text-[10px] text-muted-foreground">پنل مدیریت WS</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="text-xs text-destructive px-3 py-1.5 rounded-lg hover:bg-destructive/10"
          >
            خروج
          </button>
        </div>

        <div className="p-4 sm:p-6 lg:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {tab === "dashboard" && <Dashboard onSeed={handleSeed} />}
              {tab === "configs" && (
                <ConfigsTable
                  onCountsChange={(c) => setCounts((p) => ({ ...p, configs: c.total }))}
                />
              )}
              {tab === "servers" && (
                <ServersManager
                  onCountsChange={(c) => setCounts((p) => ({ ...p, servers: c.total }))}
                />
              )}
              {tab === "users" && (
                <UsersManager
                  onCountsChange={(c) => setCounts((p) => ({ ...p, users: c.total }))}
                />
              )}
              {tab === "stats" && <StatsView />}
              {tab === "settings" && <SettingsView admin={admin} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileNav active={tab} onChange={setTab} />
    </div>
  );
}
