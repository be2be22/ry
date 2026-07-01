// Server stats collector — CPU, RAM, disk, uptime, traffic
// جمع‌آوری آمار سرور — پردازنده، حافظه، دیسک، آپ‌تایم، ترافیک
// NOTE: This file imports Node-only modules (systeminformation) — SERVER USE ONLY.
// Formatters have been moved to ./format.ts for client-safe imports.

import si from "systeminformation";
import os from "os";

export { formatBytes, formatUptime } from "@/lib/format";

export interface ServerStats {
  cpuPercent: number;
  cpuCores: number;
  cpuModel: string;
  ramPercent: number;
  ramUsedBytes: number;
  ramTotalBytes: number;
  diskUsedBytes: number;
  diskTotalBytes: number;
  diskFreeBytes: number;
  diskPercent: number;
  uptimeSeconds: number;
  loadAvg: number[];
  platform: string;
  arch: string;
  hostname: string;
}

let cachedCpuModel: string | null = null;

export async function getServerStats(): Promise<ServerStats> {
  // CPU load (current) — requires a tiny sample window
  const cpuLoad = await si.currentLoad();
  const mem = await si.mem();
  const fsSize = await si.fsSize();
  const disk =
    fsSize.find((d) => d.mount === "/") || fsSize[0] || {
      used: 0,
      size: 1,
      available: 0,
    };

  if (!cachedCpuModel) {
    const cpuInfo = await si.cpu();
    cachedCpuModel = `${cpuInfo.manufacturer} ${cpuInfo.brand}`.trim();
  }

  const totalRam = mem.total || 1;
  const usedRam = mem.active || mem.used || 0;
  const totalDisk = disk.size || 1;

  return {
    cpuPercent: Math.round(cpuLoad.currentLoad || 0),
    cpuCores: cpuLoad.cpus.length || os.cpus().length,
    cpuModel: cachedCpuModel,
    ramPercent: Math.round((usedRam / totalRam) * 100),
    ramUsedBytes: usedRam,
    ramTotalBytes: totalRam,
    diskUsedBytes: disk.used || 0,
    diskTotalBytes: totalDisk,
    diskFreeBytes: disk.available || 0,
    diskPercent: Math.round(((disk.used || 0) / totalDisk) * 100),
    uptimeSeconds: os.uptime(),
    loadAvg: os.loadavg(),
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
  };
}
