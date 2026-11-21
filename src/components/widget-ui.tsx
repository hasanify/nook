import type React from "react";

export interface WidgetFooterProps {
  children: React.ReactNode;
  className?: string;
  leftSlot?: React.ReactNode;
  rightSlot?: React.ReactNode;
}

/**
 * Standard sticky footer for widgets.
 * Guaranteed to stay anchored at the bottom without obscuring scrollable content.
 */
export function WidgetFooter({ children, className = "", leftSlot, rightSlot }: WidgetFooterProps) {
  return (
    <div
      className={`
        sticky inset-be-0 z-10 mbs-auto flex shrink-0 items-center
        justify-between border-bs border-line/40 bg-surface/85 px-3 py-1.5
        text-2xs text-fg-muted backdrop-blur-md
        ${className}
      `}
    >
      {leftSlot ? (
        <>
          <div className="flex items-center gap-1.5">{leftSlot}</div>
          {rightSlot && <div className="flex items-center gap-1.5">{rightSlot}</div>}
        </>
      ) : (
        children
      )}
    </div>
  );
}

export type WidgetBadgeVariant = "accent" | "muted" | "ok" | "warn" | "error";

export interface WidgetBadgeProps {
  children: React.ReactNode;
  variant?: WidgetBadgeVariant;
  className?: string;
  mono?: boolean;
}

/**
 * Reusable contrast-safe badge.
 * Uses contrast-safe text colors and subtle background tints so text is 100% legible.
 */
export function WidgetBadge({
  children,
  variant = "accent",
  className = "",
  mono = true,
}: WidgetBadgeProps) {
  const variantStyles = (() => {
    switch (variant) {
      case "accent":
        return "bg-accent-500/15 text-accent-500 border border-accent-500/25";
      case "ok":
        return "bg-ok/15 text-ok border border-ok/30";
      case "warn":
        return "bg-warn/15 text-warn border border-warn/30";
      case "error":
        return "bg-error/15 text-error border border-error/30";
      case "muted":
      default:
        return "bg-surface-raised text-fg-muted border border-line/60";
    }
  })();

  return (
    <span
      className={`
        inline-flex items-center rounded-full px-2 py-0.5 text-3xs
        font-medium transition-colors
        ${mono ? "font-mono" : ""}
        ${variantStyles}
        ${className}
      `}
    >
      {children}
    </span>
  );
}

export interface WidgetCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverable?: boolean;
}

/**
 * Reusable sub-card component for rows, items, and stat blocks.
 */
export function WidgetCard({
  children,
  className = "",
  onClick,
  hoverable = false,
}: WidgetCardProps) {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-lg border border-line/40 bg-surface/60 p-2 transition-colors
        ${hoverable || onClick ? "cursor-pointer hover:border-line hover:bg-surface-raised/80" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}

export interface WidgetStatProps {
  label: string;
  value: React.ReactNode;
  subValue?: React.ReactNode;
  className?: string;
  colorClass?: string;
}

/**
 * Reusable stat metric display.
 */
export function WidgetStat({
  label,
  value,
  subValue,
  className = "",
  colorClass = "text-fg",
}: WidgetStatProps) {
  return (
    <div className={`flex flex-col ${className}`}>
      <span className="text-2xs font-medium text-fg-muted">{label}</span>
      <div className="flex items-baseline gap-1">
        <span className={`font-mono text-sm font-bold tracking-tight ${colorClass}`}>{value}</span>
        {subValue && <span className="font-mono text-2xs text-fg-muted">{subValue}</span>}
      </div>
    </div>
  );
}
