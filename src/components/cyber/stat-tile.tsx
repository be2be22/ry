"use client";

import { cn } from "@/lib/utils";

interface StatTileProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  sub?: string;
  accent?: "cyan" | "magenta" | "yellow" | "green" | "purple";
  className?: string;
  progress?: number; // 0-100
}

export function StatTile({
  label,
  value,
  icon,
  sub,
  accent = "cyan",
  className,
  progress,
}: StatTileProps) {
  const accentText = {
    cyan: "neon-text-cyan",
    magenta: "neon-text-magenta",
    yellow: "neon-text-yellow",
    green: "neon-text-green",
    purple: "neon-text-purple",
  }[accent];

  return (
    <div className={cn("stat-tile relative-z", className)}>
      <div className="flex items-start justify-between mb-2">
        <span className="micro-label">{label}</span>
        {icon && <div className={accentText}>{icon}</div>}
      </div>
      <div className={cn("text-2xl font-bold font-mono-cyber", accentText)}>{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
      {progress !== undefined && (
        <div className="mt-3 progress-cyber h-1.5">
          <div
            className={cn(
              "progress-cyber-bar",
              progress > 85 && "danger",
              progress > 65 && progress <= 85 && "warn"
            )}
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
    </div>
  );
}
