"use client";

import { cn } from "@/lib/utils";

interface PixelHeadingProps {
  children: React.ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3" | "h4";
  color?: "cyan" | "magenta" | "yellow" | "green" | "purple";
}

/** Arcade-style pixel heading with neon glow. */
export function PixelHeading({
  children,
  className,
  as: Tag = "h2",
  color = "cyan",
}: PixelHeadingProps) {
  const colorClass = {
    cyan: "neon-text-cyan",
    magenta: "neon-text-magenta",
    yellow: "neon-text-yellow",
    green: "neon-text-green",
    purple: "neon-text-purple",
  }[color];

  return (
    <Tag
      className={cn(
        "font-display uppercase tracking-wider",
        colorClass,
        Tag === "h1" && "text-2xl md:text-3xl",
        Tag === "h2" && "text-lg md:text-xl",
        Tag === "h3" && "text-base md:text-lg",
        Tag === "h4" && "text-sm md:text-base",
        className
      )}
    >
      {children}
    </Tag>
  );
}
