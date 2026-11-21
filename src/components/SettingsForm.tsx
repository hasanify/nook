import { CircleNotchIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

import { listVercelProjects, type VercelProjectSummary } from "@/core/ipc";
import type { SettingsField } from "@/core/types";

import { CustomSelect } from "./CustomSelect";
import { Toggle } from "./Toggle";

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
    <div ref={containerRef} className="relative inline-full">
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
          className="
            rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-fg
            transition-colors outline-none inline-full
            placeholder:text-fg-muted/50
            focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20
          "
        />
        {loading && (
          <div className="pointer-events-none absolute inset-e-2.5 inset-bs-2">
            <CircleNotchIcon className="animate-spin text-fg-muted block-3.5 inline-3.5" />
          </div>
        )}
      </div>

      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 mbs-1 overflow-y-auto rounded-lg border border-line bg-surface-raised p-1 shadow-card backdrop-blur-md inline-full max-block-48">
          {filtered.slice(0, 8).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onChange(p.name);
                setIsOpen(false);
              }}
              className="
                group flex cursor-pointer items-center justify-between
                rounded-md px-2.5 py-1.5 text-start text-xs transition-colors
                inline-full
                hover:bg-surface hover:text-accent-500
              "
            >
              <div className="flex items-center gap-2 min-inline-0">
                <span
                  className="
                  truncate font-medium text-fg
                  group-hover:text-accent-500
                "
                >
                  {p.name}
                </span>
                {p.framework && (
                  <span className="rounded-sm bg-surface px-1.5 py-0.5 font-mono text-[9px] text-fg-muted">
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
                  className="
                    rounded-lg border border-line bg-surface px-3 py-1.5 text-xs
                    text-fg transition-colors outline-none
                    placeholder:text-fg-muted/50
                    focus:border-accent-500 focus:ring-2
                    focus:ring-accent-500/20
                  "
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
                className="
                  rounded-lg border border-line bg-surface px-3 py-1.5 text-xs
                  text-fg transition-colors outline-none
                  placeholder:text-fg-muted/50
                  focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20
                "
              />
            )}

            {field.type === "select" && (
              <CustomSelect
                id={`field-${field.key}`}
                value={(val as string | number) ?? ""}
                onChange={(newVal) => onChange(field.key, newVal)}
                options={field.options ?? []}
                className="inline-full"
              />
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
                className="
                  rounded-lg border border-line bg-surface px-3 py-1.5 text-xs
                  text-fg transition-colors outline-none
                  placeholder:text-fg-muted/50
                  focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20
                "
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
