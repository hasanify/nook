export type StatusDotType = "ok" | "warn" | "error" | "syncing" | "idle";

interface StatusDotProps {
  status: StatusDotType;
  title?: string;
  className?: string;
}

export function StatusDot({ status, title, className = "" }: StatusDotProps) {
  const colorClass = (() => {
    switch (status) {
      case "ok":
        return "bg-ok";
      case "warn":
        return "bg-warn";
      case "error":
        return "bg-error";
      case "syncing":
        return "bg-accent-500 animate-pulse";
      case "idle":
      default:
        return "bg-fg-muted";
    }
  })();

  return (
    <span
      className={`
        inline-block shrink-0 rounded-full block-2 inline-2
        ${colorClass}
        ${className}
      `}
      title={title ?? status}
      aria-label={title ?? status}
    />
  );
}
