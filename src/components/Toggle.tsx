interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}

export function Toggle({ checked, onChange, disabled = false, id, ariaLabel }: ToggleProps) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-200 ease-in-out focus:ring-2 focus:ring-accent-500/40 focus:ring-offset-1 focus:ring-offset-surface focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "border-accent-500 bg-accent-500" : "border-line bg-surface-raised"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-xs transition-transform duration-200 ease-in-out ${
          checked ? "translate-x-4.5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
