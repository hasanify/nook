import { useState, useRef, useEffect, useId, useMemo, useCallback, type ReactNode } from "react";

export interface SelectOption<T extends string | number = string | number> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

export interface CustomSelectProps<T extends string | number = string | number> {
  id?: string;
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  searchable?: boolean;
  direction?: "auto" | "down" | "up";
  ariaLabel?: string;
}

export function CustomSelect<T extends string | number = string | number>({
  id,
  value,
  onChange,
  options,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  className = "",
  buttonClassName = "",
  menuClassName = "",
  disabled = false,
  searchable,
  direction = "auto",
  ariaLabel,
}: CustomSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [resolvedDirection, setResolvedDirection] = useState<"down" | "up">(
    direction === "up" ? "up" : "down",
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const generatedId = useId();
  const selectId = id || generatedId;

  // Auto-enable search if there are 7 or more options, unless explicitly set
  const isSearchable = searchable ?? options.length >= 7;

  // Selected option lookup
  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value],
  );

  // Filtered options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const query = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(query) ||
        (opt.description && opt.description.toLowerCase().includes(query)),
    );
  }, [options, searchQuery]);

  const openDropdown = () => {
    if (disabled) return;

    if (direction === "up") {
      setResolvedDirection("up");
    } else if (direction === "down") {
      setResolvedDirection("down");
    } else if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setResolvedDirection(spaceBelow < 240 && spaceAbove > spaceBelow ? "up" : "down");
    }

    const initialIdx = filteredOptions.findIndex((opt) => opt.value === value);
    setHighlightedIndex(initialIdx >= 0 ? initialIdx : 0);
    setIsOpen(true);
  };

  const closeDropdown = useCallback(() => {
    setIsOpen(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
  }, []);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeDropdown();
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
    };
  }, [isOpen, closeDropdown]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || highlightedIndex < 0 || !listRef.current) return;
    const items = listRef.current.querySelectorAll<HTMLLIElement>("[role='option']");
    const targetItem = items[highlightedIndex];
    if (targetItem) {
      targetItem.scrollIntoView({ block: "nearest" });
    }
  }, [isOpen, highlightedIndex]);

  const handleSelect = (val: T) => {
    onChange(val);
    closeDropdown();
    triggerRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (!isOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        closeDropdown();
        triggerRef.current?.focus();
        break;
      case "Tab":
        closeDropdown();
        break;
    }
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={selectId}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => {
          if (isOpen) {
            closeDropdown();
          } else {
            openDropdown();
          }
        }}
        className={`group flex w-full items-center justify-between gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs text-fg transition-all outline-none hover:border-fg-muted/40 focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20 disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-left">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <svg
          className={`h-3.5 w-3.5 shrink-0 text-fg-muted transition-transform duration-200 group-hover:text-fg ${
            isOpen ? "rotate-180" : ""
          }`}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute z-50 min-w-full rounded-xl border border-line/80 bg-surface/95 p-1 text-fg shadow-xl ring-1 ring-black/5 backdrop-blur-xl transition-all dark:ring-white/5 ${
            resolvedDirection === "up"
              ? "bottom-full mb-1.5 origin-bottom"
              : "top-full mt-1.5 origin-top"
          } ${menuClassName}`}
          style={{ minWidth: "max(100%, 160px)" }}
        >
          {/* Optional Search Filter */}
          {isSearchable && (
            <div className="relative border-b border-line/50 p-1 pb-1.5">
              <div className="flex items-center gap-1.5 rounded-lg border border-line/80 bg-surface-raised px-2 py-1 text-xs text-fg transition-colors focus-within:border-accent-500 focus-within:ring-1 focus-within:ring-accent-500/20">
                <svg
                  className="h-3 w-3 shrink-0 text-fg-muted"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <input
                  ref={(el) => {
                    searchInputRef.current = el;
                    if (el) {
                      el.focus();
                    }
                  }}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(0);
                  }}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-xs text-fg outline-none placeholder:text-fg-muted/60"
                  autoComplete="off"
                  spellCheck="false"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="cursor-pointer text-fg-muted hover:text-fg"
                    aria-label="Clear search"
                  >
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Options List */}
          <ul
            ref={listRef}
            role="listbox"
            tabIndex={-1}
            className="max-h-56 overflow-y-auto overscroll-contain py-1 text-xs outline-none"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-center text-xs text-fg-muted">No matching options</li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = opt.value === value;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(opt.value)}
                    className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 transition-colors select-none ${
                      isSelected
                        ? "bg-accent-500/10 font-medium text-accent-500"
                        : isHighlighted
                          ? "bg-surface-raised text-fg"
                          : "text-fg hover:bg-surface-raised"
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="truncate text-[10px] text-fg-muted">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <svg
                        className="h-3.5 w-3.5 shrink-0 text-accent-500"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
