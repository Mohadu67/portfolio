import React from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "identifiee" | "lettre" | "postule" | "reponse" | "entretien" | "refus" | "acceptee";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  children: React.ReactNode;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-[var(--bg-secondary)] text-[var(--accent-orange)]",
  success: "bg-green-500/20 text-green-400",
  warning: "bg-yellow-500/20 text-yellow-400",
  error: "bg-red-500/20 text-red-400",
  info: "bg-blue-500/20 text-blue-400",
  identifiee: "bg-[var(--status-identifiee)]/20 text-[var(--status-identifiee)]",
  lettre: "bg-[var(--status-lettre)]/20 text-[var(--status-lettre)]",
  postule: "bg-[var(--status-postule)]/20 text-[var(--status-postule)]",
  reponse: "bg-[var(--status-reponse)]/20 text-[var(--status-reponse)]",
  entretien: "bg-[var(--status-entretien)]/20 text-[var(--status-entretien)]",
  refus: "bg-[var(--status-refus)]/20 text-[var(--status-refus)]",
  acceptee: "bg-[var(--status-acceptee)]/20 text-[var(--status-acceptee)]",
};

export function Badge({
  variant = "default",
  children,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={`
        inline-block px-3 py-1 text-xs font-semibold rounded-full
        ${variantStyles[variant]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  );
}
