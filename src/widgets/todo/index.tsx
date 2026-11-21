import { CheckIcon, XIcon } from "@phosphor-icons/react";
import { useState } from "react";

import { WidgetShell } from "@/components/WidgetShell";
import type { Manifest, WidgetModule, WidgetProps } from "@/core/types";

import manifestJson from "./manifest.json";

const manifest = manifestJson as Manifest;

interface TodoItem {
  id: string;
  text: string;
  done: boolean;
}

const DEFAULT_TODOS: TodoItem[] = [
  { id: "1", text: "Design desktop layout", done: true },
  { id: "2", text: "Pin widgets to wallpaper", done: false },
  { id: "3", text: "Review release changelog", done: false },
];

export function TodoWidget({ instance, editMode, patchState }: WidgetProps) {
  const [inputText, setInputText] = useState("");

  const rawTodos = instance.state.todos;
  const todos: TodoItem[] = Array.isArray(rawTodos) ? (rawTodos as TodoItem[]) : DEFAULT_TODOS;

  const showCompleted = instance.settings.showCompleted !== false;

  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;

    const newTodo: TodoItem = {
      id: `t_${Date.now()}`,
      text: trimmed,
      done: false,
    };

    const next = [...todos, newTodo];
    patchState({ todos: next });
    setInputText("");
  };

  const handleToggle = (id: string) => {
    const next = todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    patchState({ todos: next });
  };

  const handleDelete = (id: string) => {
    const next = todos.filter((t) => t.id !== id);
    patchState({ todos: next });
  };

  const handleClearCompleted = () => {
    const next = todos.filter((t) => !t.done);
    patchState({ todos: next });
  };

  const displayedTodos = showCompleted ? todos : todos.filter((t) => !t.done);
  const remainingCount = todos.filter((t) => !t.done).length;
  const hasCompleted = todos.some((t) => t.done);

  return (
    <WidgetShell
      instance={instance}
      editMode={editMode}
      title={manifest.name}
      resizable={manifest.resizable}
      minSize={manifest.minSize}
      defaultSize={manifest.defaultSize}
      footer={
        <div className="flex items-center justify-between text-[10px] text-fg-muted inline-full">
          <span>
            {remainingCount} {remainingCount === 1 ? "task" : "tasks"} remaining
          </span>
          {hasCompleted && (
            <button
              type="button"
              onClick={handleClearCompleted}
              className="
                cursor-pointer text-fg-muted transition-colors
                hover:text-fg hover:underline
              "
            >
              Clear completed
            </button>
          )}
        </div>
      }
    >
      <div className="flex flex-col gap-2 select-none min-block-full">
        {/* Add Task Input Form */}
        <form onSubmit={handleAddTodo} className="flex gap-1.5">
          <input
            type="text"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Add task... (Press Enter)"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="
              flex-1 rounded-lg border border-line bg-surface-raised/40 px-2.5
              py-1 text-xs text-fg transition-colors outline-none
              placeholder:text-fg-muted/50
              focus:border-accent-500 focus:bg-surface focus:ring-1
              focus:ring-accent-500/20
            "
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="
              rounded-lg bg-accent-500/15 px-2.5 py-1 text-xs font-semibold
              text-accent-500 transition-colors
              hover:bg-accent-500/25
              disabled:cursor-not-allowed disabled:opacity-40
            "
          >
            +
          </button>
        </form>

        {/* Task List */}
        <div className="flex flex-col gap-1 pe-1 pbe-2">
          {displayedTodos.length === 0 ? (
            <div className="flex flex-1 items-center justify-center py-6 text-xs text-fg-muted italic">
              {todos.length === 0 ? "No tasks yet. Type above to add." : "All tasks completed!"}
            </div>
          ) : (
            displayedTodos.map((todo) => (
              <div
                key={todo.id}
                className="
                  group flex items-center justify-between gap-2 rounded-lg px-2
                  py-1 text-xs transition-colors
                  hover:bg-surface-raised/60
                "
              >
                <button
                  type="button"
                  onClick={() => handleToggle(todo.id)}
                  className="flex flex-1 items-center gap-2 text-start min-inline-0"
                >
                  <span
                    className={`
                      flex shrink-0 items-center justify-center rounded-sm
                      border transition-colors block-4 inline-4
                      ${
                        todo.done
                          ? "border-accent-500 bg-accent-500 text-white"
                          : `
                          border-line bg-surface
                          group-hover:border-fg-muted
                        `
                      }
                    `}
                  >
                    {todo.done && <CheckIcon className="block-2.5 inline-2.5" weight="bold" />}
                  </span>
                  <span
                    className={`
                      truncate transition-all
                      ${todo.done ? "text-fg-muted line-through" : "text-fg"}
                    `}
                  >
                    {todo.text}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(todo.id)}
                  className="
                    opacity-0 transition-opacity
                    group-hover:opacity-100
                    hover:text-error
                  "
                  title="Delete task"
                >
                  <XIcon
                    className="
                    text-fg-muted block-3 inline-3
                    hover:text-error
                  "
                  />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </WidgetShell>
  );
}

const module: WidgetModule = {
  manifest,
  component: TodoWidget,
  defaultSettings: {
    showCompleted: true,
  },
  defaultState: {
    todos: DEFAULT_TODOS,
  },
};

export default module;
