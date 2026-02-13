"use client";

import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-lg",
        "bg-gradient-to-r from-[var(--bg-secondary)] via-[var(--bg-card)] to-[var(--bg-secondary)]",
        "bg-[length:200%_100%]",
        className
      )}
      style={{
        animation: "shimmer 2s infinite",
      }}
    />
  );
}
