interface BannerProps {
  message: string;
  type?: "warn" | "error" | "info";
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export function Banner({
  message,
  type = "warn",
  actionText,
  onAction,
  className = "",
}: BannerProps) {
  const typeStyles = (() => {
    switch (type) {
      case "error":
        return "border-error/40 bg-error/10 text-error";
      case "info":
        return "border-line bg-surface-raised text-fg-muted";
      case "warn":
      default:
        return "border-warn/40 bg-warn/10 text-warn";
    }
  })();

  return (
    <div
      className={`
        flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5
        text-xs font-medium
        ${typeStyles}
        ${className}
      `}
    >
      <span className="truncate" title={message}>
        {message}
      </span>
      {actionText && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="
            shrink-0 cursor-pointer underline
            hover:opacity-80
            active:opacity-60
          "
        >
          {actionText}
        </button>
      )}
    </div>
  );
}
