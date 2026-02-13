import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  isLoading?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--accent-orange)] text-[var(--bg-primary)] hover:opacity-90 hover:scale-105",
  secondary:
    "bg-[var(--accent-blue)] text-white hover:opacity-90 hover:scale-105",
  ghost:
    "border border-[var(--border-color)] text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]",
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
    <button
      disabled={disabled || isLoading}
      className={`
        font-semibold rounded-lg transition-all duration-300 transform
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      {...props}
    >
      {isLoading ? (
        <span className="inline-flex items-center gap-2">
          <span className="animate-spin">⚙</span>
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
