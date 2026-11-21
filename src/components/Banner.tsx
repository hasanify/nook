import { XIcon } from "@phosphor-icons/react";

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
        flex items-start justify-between gap-2 rounded-lg border px-2.5 py-1.5
        text-xs font-medium
        ${typeStyles}
        ${className}
      `}
    >
      <span className="flex-1 leading-relaxed wrap-break-word select-text">{message}</span>
      {actionText && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="
            shrink-0 cursor-pointer text-xs underline
            hover:opacity-80
            active:opacity-60
          "
        >
          {actionText}
        </button>
      ) : onAction ? (
        <button
          type="button"
          onClick={onAction}
          aria-label="Dismiss banner"
          className="
            mbs-0.5 shrink-0 cursor-pointer opacity-60 transition-opacity
            hover:opacity-100
          "
        >
          <XIcon className="block-3.5 inline-3.5" />
        </button>
      ) : null}
    </div>
  );
}
