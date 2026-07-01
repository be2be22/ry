"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface CyberButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "cyan" | "magenta";
  pulse?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
}

export function CyberButton({
  children,
  className,
  variant = "cyan",
  pulse,
  loading,
  icon,
  disabled,
  ...rest
}: CyberButtonProps) {
  const variantClass = variant === "magenta" ? "btn-arcade-magenta" : "btn-arcade-cyan";
  return (
    <button
      className={cn(
        variantClass,
        "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm clip-arcade",
        pulse && variant === "magenta" && "animate-neon-pulse",
        pulse && variant === "cyan" && "animate-cyan-breath",
        className
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
