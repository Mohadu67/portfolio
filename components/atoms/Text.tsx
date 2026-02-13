import React from "react";

type TextVariant =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "body"
  | "caption"
  | "label";
type TextColor = "primary" | "secondary" | "tertiary" | "accent-orange";

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant?: TextVariant;
  color?: TextColor;
  children: React.ReactNode;
  as?: "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
}

const variantStyles: Record<TextVariant, string> = {
  h1: "text-5xl md:text-6xl font-bold",
  h2: "text-4xl md:text-5xl font-bold",
  h3: "text-2xl md:text-3xl font-bold",
  h4: "text-xl font-semibold",
  body: "text-base leading-relaxed",
  caption: "text-sm",
  label: "text-xs font-semibold uppercase tracking-wide",
};

const colorStyles: Record<TextColor, string> = {
  primary: "text-[var(--text-primary)]",
  secondary: "text-[var(--text-secondary)]",
  tertiary: "text-[var(--text-tertiary)]",
  "accent-orange": "text-[var(--accent-orange)]",
};

export function Text({
  variant = "body",
  color = "primary",
  children,
  as = "p",
  className = "",
  ...props
}: TextProps) {
  const Component = as as React.ElementType;

  return (
    <Component
      className={`${variantStyles[variant]} ${colorStyles[color]} ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
}
