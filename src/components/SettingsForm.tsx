import type { SettingsField } from "../core/types";

interface SettingsFormProps {
  fields: SettingsField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function SettingsForm({ fields, values, onChange }: SettingsFormProps) {
  if (!fields.length) {
    return <div className="py-2 text-xs text-fg-muted italic">No configurable settings.</div>;
  }

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => {
        const val = values[field.key] ?? field.defaultValue;

        return (
          <div key={field.key} className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor={`field-${field.key}`} className="text-xs font-medium text-fg">
                {field.label}
              </label>
              {field.type === "boolean" && (
                <input
                  id={`field-${field.key}`}
                  type="checkbox"
                  checked={Boolean(val)}
                  onChange={(e) => onChange(field.key, e.target.checked)}
                  className="h-4 w-4 rounded border-line bg-surface-raised text-accent-500 accent-accent-500 focus:ring-1 focus:ring-focus"
                />
              )}
            </div>

            {field.description && <p className="text-[11px] text-fg-muted">{field.description}</p>}

            {field.type === "text" && (
              <input
                id={`field-${field.key}`}
                type="text"
                placeholder={field.placeholder}
                value={String(val ?? "")}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs text-fg outline-none placeholder:text-fg-muted focus:ring-1 focus:ring-focus"
              />
            )}

            {field.type === "number" && (
              <input
                id={`field-${field.key}`}
                type="number"
                min={field.min}
                max={field.max}
                step={field.step}
                value={Number(val ?? 0)}
                onChange={(e) => onChange(field.key, Number(e.target.value))}
                className="rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs text-fg outline-none placeholder:text-fg-muted focus:ring-1 focus:ring-focus"
              />
            )}

            {field.type === "select" && (
              <select
                id={`field-${field.key}`}
                value={String(val ?? "")}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="rounded-md border border-line bg-surface-raised px-2 py-1.5 text-xs text-fg outline-none focus:ring-1 focus:ring-focus"
              >
                {field.options?.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}

            {field.type === "secret" && (
              <input
                id={`field-${field.key}`}
                type="password"
                placeholder={field.placeholder ?? "••••••••••••••••"}
                value={String(val ?? "")}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="rounded-md border border-line bg-surface-raised px-2.5 py-1.5 text-xs text-fg outline-none placeholder:text-fg-muted focus:ring-1 focus:ring-focus"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
