import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
  interactive?: boolean;
  children: React.ReactNode;
}

export function Card({
  elevated = false,
  interactive = false,
  children,
  className = "",
  ...props
}: CardProps) {
  const baseStyles =
    "bg-[var(--bg-card)] border border-[var(--border-color)] rounded-lg p-6";
  const elevatedStyles = elevated ? "shadow-2xl shadow-black/40" : "";
  const interactiveStyles = interactive
    ? "hover:border-[var(--accent-orange)] hover:bg-[var(--bg-secondary)] transition-all duration-300 transform hover:scale-105 cursor-pointer"
    : "";

  return (
    <div
      className={`${baseStyles} ${elevatedStyles} ${interactiveStyles} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
