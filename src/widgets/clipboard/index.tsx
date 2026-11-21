import {
  CheckIcon,
  CopyIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { type FormEvent, useMemo, useState } from "react";

import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

export interface SnippetItem {
  id: string;
  title: string;
  content: string;
}

const DEFAULT_SNIPPETS: SnippetItem[] = [
  {
    id: "1",
    title: "Git conventional commit",
    content: 'git commit -m "feat(core): implement new functionality"',
  },
  {
    id: "2",
    title: "Console pretty JSON",
    content: "console.log(JSON.stringify(data, null, 2));",
  },
  {
    id: "3",
    title: "UUID v4 generator",
    content: "crypto.randomUUID()",
  },
];

export function ClipboardWidget({ instance, editMode, patchState }: WidgetProps) {
  const rawSnippets = instance.state.snippets;
  const snippets: SnippetItem[] = useMemo(() => {
    if (Array.isArray(rawSnippets)) {
      return rawSnippets as SnippetItem[];
    }
    return DEFAULT_SNIPPETS;
  }, [rawSnippets]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");

  const showSearch = instance.settings.showSearch !== false;

  const filteredSnippets = useMemo(() => {
    if (!searchQuery.trim()) return snippets;
    const q = searchQuery.toLowerCase();
    return snippets.filter(
      (s) => s.title.toLowerCase().includes(q) || s.content.toLowerCase().includes(q),
    );
  }, [snippets, searchQuery]);

  const handleCopy = async (snippet: SnippetItem) => {
    try {
      await navigator.clipboard.writeText(snippet.content);
      setCopiedId(snippet.id);
      setTimeout(() => {
        setCopiedId((curr) => (curr === snippet.id ? null : curr));
      }, 1500);
    } catch {
      // Clipboard copy fallback if needed
    }
  };

  const handleAddSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const newItem: SnippetItem = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      content: newContent.trim(),
    };

    const next = [...snippets, newItem];
    patchState({ snippets: next });
    setNewTitle("");
    setNewContent("");
    setIsAdding(false);
  };

  const handleDelete = (id: string) => {
    const next = snippets.filter((s) => s.id !== id);
    patchState({ snippets: next });
  };

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      headerActions={
        <button
          type="button"
          onClick={() => setIsAdding((prev) => !prev)}
          className="
            flex cursor-pointer items-center justify-center rounded-md
            text-fg-muted transition-colors block-5 inline-5
            hover:bg-surface-raised hover:text-fg
          "
          title={isAdding ? "Cancel" : "Add snippet"}
        >
          <PlusIcon
            className={`transition-transform block-3 inline-3 ${isAdding ? "rotate-45" : ""}`}
            weight="bold"
          />
        </button>
      }
    >
      <div className="flex flex-col gap-2 p-1 text-xs block-full inline-full">
        {showSearch && snippets.length > 2 && (
          <div className="relative flex items-center">
            <MagnifyingGlassIcon className="absolute inset-s-2 text-fg-muted/60 block-3 inline-3" />
            <input
              type="text"
              placeholder="Filter snippets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="
                rounded-md border border-line bg-surface-raised/40 py-1 ps-6
                pe-2 text-3xs text-fg outline-none inline-full
                placeholder:text-fg-muted/60
                focus:border-accent-500
              "
            />
          </div>
        )}

        {isAdding && (
          <form
            onSubmit={handleAddSubmit}
            className="flex flex-col gap-1.5 rounded-lg border border-line/60 bg-surface-raised/80 p-2 shadow-xs"
          >
            <input
              type="text"
              placeholder="Snippet title (e.g. Docker run snippet)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="
                rounded-sm border border-line bg-surface px-2 py-1 text-2xs text-fg
                outline-none placeholder:text-fg-muted/60
                focus:border-accent-500
              "
              autoFocus
            />
            <textarea
              placeholder="Content to copy..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              rows={3}
              className="
                resize-none rounded-sm border border-line bg-surface px-2 py-1
                font-mono text-3xs text-fg outline-none
                placeholder:text-fg-muted/60
                focus:border-accent-500
              "
            />
            <div className="flex items-center justify-end gap-1 pbs-1">
              <button
                type="submit"
                disabled={!newTitle.trim() || !newContent.trim()}
                className="
                  cursor-pointer rounded-sm bg-accent-500 px-2 py-0.5 text-2xs
                  font-medium text-white transition-opacity
                  hover:opacity-90 disabled:cursor-not-allowed
                  disabled:opacity-50
                "
              >
                Save Snippet
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-col gap-1.5 overflow-y-auto block-full">
          {filteredSnippets.map((snippet) => {
            const isCopied = copiedId === snippet.id;
            return (
              <div
                key={snippet.id}
                onClick={() => void handleCopy(snippet)}
                className={`
                  group relative flex cursor-pointer flex-col gap-1 rounded-lg
                  border p-2 text-start transition-all
                  ${
                    isCopied
                      ? "border-emerald-500/60 bg-emerald-500/10"
                      : "border-line/60 bg-surface-raised/40 hover:border-accent-500/40 hover:bg-surface-raised"
                  }
                `}
                title="Click to copy snippet"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="truncate text-2xs font-medium text-fg">{snippet.title}</span>
                  <div className="flex items-center gap-1">
                    {isCopied ? (
                      <span className="flex items-center gap-0.5 rounded-xs bg-emerald-500/20 px-1 py-0.5 font-mono text-3xs font-medium text-emerald-500">
                        <CheckIcon className="block-2.5 inline-2.5" weight="bold" />
                        Copied
                      </span>
                    ) : (
                      <span className="text-fg-muted/50 transition-colors group-hover:text-fg-muted">
                        <CopyIcon className="block-3 inline-3" />
                      </span>
                    )}

                    {editMode && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(snippet.id);
                        }}
                        className="
                          cursor-pointer rounded-sm p-0.5 text-fg-muted
                          transition-colors
                          hover:bg-error/20 hover:text-error
                        "
                        title="Delete snippet"
                      >
                        <TrashIcon className="block-3 inline-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="line-clamp-2 rounded-sm bg-surface/70 px-1.5 py-1 font-mono text-3xs text-fg-muted/90">
                  {snippet.content}
                </div>
              </div>
            );
          })}

          {filteredSnippets.length === 0 && !isAdding && (
            <div className="flex flex-col items-center justify-center p-4 text-center text-fg-muted">
              <span className="text-2xs">
                {searchQuery ? "No matching snippets found" : "No snippets pinned yet"}
              </span>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={() => setIsAdding(true)}
                  className="
                    cursor-pointer pbs-1 text-2xs font-medium text-accent-500
                    hover:underline
                  "
                >
                  Add your first snippet
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

const clipboardModule: WidgetModule = {
  manifest,
  component: ClipboardWidget,
  defaultSettings: {
    showSearch: true,
  },
  defaultState: {
    snippets: DEFAULT_SNIPPETS,
  },
};

export default clipboardModule;
