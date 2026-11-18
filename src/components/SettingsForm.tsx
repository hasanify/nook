import { useState, useEffect, useRef } from "react";
import type { SettingsField } from "../core/types";
import { Toggle } from "./Toggle";
import { listVercelProjects, type VercelProjectSummary } from "../core/ipc";

interface SettingsFormProps {
  fields: SettingsField[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

function VercelProjectInput({
  id,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  value: string;
  placeholder?: string | undefined;
  onChange: (val: string) => void;
}) {
  const [projects, setProjects] = useState<VercelProjectSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    listVercelProjects()
      .then((res) => {
        if (active && Array.isArray(res)) {
          setProjects(res);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const query = value.toLowerCase().trim();
  const filtered = query
    ? projects.filter(
        (p) => p.name.toLowerCase().includes(query) || p.id.toLowerCase().includes(query),
      )
    : projects;

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <input
          id={id}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg transition-colors outline-none placeholder:text-fg-muted/50 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
        />
        {loading && (
          <div className="pointer-events-none absolute top-2 right-2.5">
            <svg
              className="h-3.5 w-3.5 animate-spin text-fg-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-line bg-surface-raised p-1 shadow-card backdrop-blur-md">
          {filtered.slice(0, 8).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.name);
                setIsOpen(false);
              }}
              className="group flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-surface hover:text-accent-500"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-fg group-hover:text-accent-500">
                  {p.name}
                </span>
                {p.framework && (
                  <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[9px] text-fg-muted">
                    {p.framework}
                  </span>
                )}
              </div>
              <span className="shrink-0 font-mono text-[10px] text-fg-muted">
                {p.id.slice(0, 10)}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SettingsForm({ fields, values, onChange }: SettingsFormProps) {
  if (!fields.length) {
    return <div className="py-2 text-xs text-fg-muted italic">No configurable settings.</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      {fields.map((field) => {
        const val = values[field.key] ?? field.defaultValue;
        const isVercelAutocomplete =
          field.autocomplete === "vercel-projects" || field.key === "projectId";

        return (
          <div key={field.key} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor={`field-${field.key}`} className="text-xs font-medium text-fg">
                {field.label}
              </label>
              {field.type === "boolean" && (
                <Toggle
                  id={`field-${field.key}`}
                  checked={Boolean(val)}
                  onChange={(next) => onChange(field.key, next)}
                />
              )}
            </div>

            {field.description && <p className="text-[11px] text-fg-muted">{field.description}</p>}

            {field.type === "text" &&
              (isVercelAutocomplete ? (
                <VercelProjectInput
                  id={`field-${field.key}`}
                  placeholder={field.placeholder}
                  value={String(val ?? "")}
                  onChange={(next) => onChange(field.key, next)}
                />
              ) : (
                <input
                  id={`field-${field.key}`}
                  type="text"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  placeholder={field.placeholder}
                  value={String(val ?? "")}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg transition-colors outline-none placeholder:text-fg-muted/50 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
                />
              ))}

            {field.type === "number" && (
              <input
                id={`field-${field.key}`}
                type="number"
                autoComplete="off"
                min={field.min}
                max={field.max}
                step={field.step}
                value={Number(val ?? 0)}
                onChange={(e) => onChange(field.key, Number(e.target.value))}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg transition-colors outline-none placeholder:text-fg-muted/50 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
              />
            )}

            {field.type === "select" && (
              <select
                id={`field-${field.key}`}
                value={String(val ?? "")}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg transition-colors outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
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
                autoComplete="new-password"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                placeholder={field.placeholder ?? "••••••••••••••••"}
                value={String(val ?? "")}
                onChange={(e) => onChange(field.key, e.target.value)}
                className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg transition-colors outline-none placeholder:text-fg-muted/50 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20"
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
