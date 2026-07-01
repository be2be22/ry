"use client";

import { cn } from "@/lib/utils";

interface MicroLabelProps {
  children: React.ReactNode;
  className?: string;
  color?: "cyan" | "magenta" | "muted";
}

/** Small uppercase letter-spaced micro-label, e.g. "MOVE:" "LAUNCH:" */
export function MicroLabel({ children, className, color = "muted" }: MicroLabelProps) {
  return (
    <span
      className={cn(
        "micro-label",
        color === "cyan" && "neon-text-cyan",
        color === "magenta" && "neon-text-magenta",
        className
      )}
    >
      {children}
    </span>
  );
}
