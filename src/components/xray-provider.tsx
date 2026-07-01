"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

interface XrayState {
  running: boolean;
  mode: "live" | "simulated";
  pid: number | null;
  uptimeSeconds: number;
  lastError: string | null;
}

interface XrayContextValue {
  state: XrayState | null;
  loading: boolean;
  refresh: () => Promise<void>;
  restart: () => Promise<void>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}

const XrayContext = createContext<XrayContextValue | null>(null);

export function useXray() {
  const ctx = useContext(XrayContext);
  if (!ctx) throw new Error("useXray must be used within XrayProvider");
  return ctx;
}

export function XrayProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<XrayState | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/xray/state", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setState(data);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const restart = useCallback(async () => {
    await fetch("/api/xray/restart", { method: "POST" });
    await refresh();
  }, [refresh]);

  const start = useCallback(async () => {
    await fetch("/api/xray/start", { method: "POST" });
    await refresh();
  }, [refresh]);

  const stop = useCallback(async () => {
    await fetch("/api/xray/stop", { method: "POST" });
    await refresh();
  }, [refresh]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 5000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <XrayContext.Provider value={{ state, loading, refresh, restart, start, stop }}>
      {children}
    </XrayContext.Provider>
  );
}
