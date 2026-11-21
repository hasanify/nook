import { CaretDown, Check, MagnifyingGlass, X } from "@phosphor-icons/react";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

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

function isOptionMatch<T>(optVal: T, targetVal: T): boolean {
  if (optVal === targetVal) return true;
  if (targetVal === undefined || targetVal === null || targetVal === "") return false;
  return String(optVal) === String(targetVal);
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
    () => options.find((opt) => isOptionMatch(opt.value, value)),
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

    const initialIdx = filteredOptions.findIndex((opt) => isOptionMatch(opt.value, value));
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
      className={`
        relative inline-block
        ${className}
      `}
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
        className={`
          group flex items-center justify-between gap-2 rounded-lg border
          border-line bg-surface px-2.5 py-1.5 text-xs text-fg transition-all
          outline-none inline-full
          hover:border-fg-muted/40
          focus:border-accent-500 focus:ring-2 focus:ring-accent-500/20
          disabled:cursor-not-allowed disabled:opacity-50
          ${buttonClassName}
        `}
      >
        <span className="flex flex-1 items-center gap-1.5 truncate text-start min-inline-0">
          {selectedOption?.icon && <span className="shrink-0">{selectedOption.icon}</span>}
          <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <CaretDown
          className={`
            shrink-0 text-fg-muted transition-transform duration-200 block-3.5
            inline-3.5
            group-hover:text-fg
            ${isOpen ? "rotate-180" : ""}
          `}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`
            absolute z-50 rounded-xl border border-line/80 bg-surface/95 p-1
            text-fg shadow-xl ring-1 ring-black/5 backdrop-blur-xl
            transition-all min-inline-full
            dark:ring-white/5
            ${
              resolvedDirection === "up"
                ? "inset-be-full mbe-1.5 origin-bottom"
                : "inset-bs-full mbs-1.5 origin-top"
            }
            ${menuClassName}
          `}
          style={{ minWidth: "max(100%, 160px)" }}
        >
          {/* Optional Search Filter */}
          {isSearchable && (
            <div className="relative border-be border-line/50 p-1 pbe-1.5">
              <div
                className="
                flex items-center gap-1.5 rounded-lg border border-line/80
                bg-surface-raised px-2 py-1 text-xs text-fg transition-colors
                focus-within:border-accent-500 focus-within:ring-1
                focus-within:ring-accent-500/20
              "
              >
                <MagnifyingGlass
                  className="shrink-0 text-fg-muted block-3 inline-3"
                  aria-hidden="true"
                />
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
                  className="
                    flex-1 bg-transparent text-xs text-fg outline-none
                    min-inline-0
                    placeholder:text-fg-muted/60
                  "
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
                    className="
                      cursor-pointer text-fg-muted
                      hover:text-fg
                    "
                    aria-label="Clear search"
                  >
                    <X className="block-3 inline-3" />
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
            className="overflow-y-auto overscroll-contain py-1 text-xs outline-none max-block-56"
          >
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-center text-xs text-fg-muted">No matching options</li>
            ) : (
              filteredOptions.map((opt, idx) => {
                const isSelected = isOptionMatch(opt.value, value);
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={String(opt.value)}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelect(opt.value)}
                    className={`
                      flex cursor-pointer items-center justify-between gap-2
                      rounded-lg px-2.5 py-1.5 transition-colors select-none
                      ${
                        isSelected
                          ? "bg-accent-500/10 font-medium text-accent-500"
                          : isHighlighted
                            ? "bg-surface-raised text-fg"
                            : `
                            text-fg
                            hover:bg-surface-raised
                          `
                      }
                    `}
                  >
                    <div className="flex flex-1 items-center gap-2 min-inline-0">
                      {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                      <div className="flex flex-1 flex-col min-inline-0">
                        <span className="truncate">{opt.label}</span>
                        {opt.description && (
                          <span className="truncate text-[10px] text-fg-muted">
                            {opt.description}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check
                        className="shrink-0 text-accent-500 block-3.5 inline-3.5"
                        weight="bold"
                        aria-hidden="true"
                      />
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
