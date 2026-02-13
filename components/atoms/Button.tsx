"use client";

import React from "react";
import { motion, HTMLMotionProps } from "framer-motion";
import { Loader } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "className"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  isLoading?: boolean;
  className?: string;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent-orange)] text-[var(--bg-primary)] hover:opacity-90",
  secondary:
    "bg-[var(--accent-blue)] text-white hover:opacity-90",
  ghost:
    "border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]",
  destructive:
    "bg-red-600 text-white hover:bg-red-700",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  isLoading = false,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      disabled={disabled || isLoading}
      className={`
        font-semibold rounded-lg transition-all duration-300
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      whileHover={{ scale: disabled ? 1 : 1.05 }}
      whileTap={{ scale: disabled ? 1 : 0.95 }}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <Loader size={16} className="animate-spin" />
          {children}
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}
