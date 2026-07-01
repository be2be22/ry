"use client";

import { cn } from "@/lib/utils";

interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  variant?: "cyan" | "magenta";
  glow?: boolean;
}

export function GlowCard({
  children,
  className,
  variant = "cyan",
  glow = true,
}: GlowCardProps) {
  return (
    <div
      className={cn(
        "cyber-card relative-z",
        variant === "magenta" && "cyber-card-magenta",
        glow && variant === "cyan" && "neon-glow-cyan",
        glow && variant === "magenta" && "neon-glow-magenta",
        className
      )}
    >
      {children}
    </div>
  );
}
