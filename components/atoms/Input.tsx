"use client";

import React from "react";
import { cn } from "@/lib/cn";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export function Input({
  label,
  error,
  icon,
  className,
  ...props
}: InputProps) {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)]">
            {icon}
          </div>
        )}
        <input
          className={cn(
            "w-full px-4 py-2.5 rounded-lg",
            "bg-[var(--bg-secondary)] border border-[var(--border-color)]",
            "text-[var(--text-primary)] placeholder-[var(--text-tertiary)]",
            "focus:outline-none focus:border-[var(--accent-orange)]",
            "transition-colors duration-200",
            icon && "pl-10",
            error && "border-red-500 focus:border-red-500",
            className
          )}
          {...props}
        />
      </div>
      {error && (
        <p className="mt-1 text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}
