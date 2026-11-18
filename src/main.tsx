import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/theme.css";
import { SettingsApp } from "./settings/SettingsApp";
import { ContextMenuApp } from "./components/ContextMenuApp";
import { getWidgetModule } from "./widgets/registry";
import { useInstance } from "./core/use-instance";
import { useEditMode } from "./core/use-edit-mode";
import { useTheme } from "./core/use-theme";

function WidgetHost({ id }: { id: string }) {
  const { instance, loading, error, patchState, patchSettings } = useInstance(id);
  const { editMode, toggleEditMode } = useEditMode();

  if (loading) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-card border border-line bg-surface p-4 text-xs text-fg-muted select-none">
        Loading widget...
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-card border border-error bg-surface p-4 text-xs text-error select-none">
        {error || "Widget not found"}
      </div>
    );
  }

  const widgetKind = instance.kind || instance.type;
  const mod = getWidgetModule(widgetKind ?? "") ?? getWidgetModule("placeholder");
  if (!mod) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-card border border-error bg-surface p-4 text-xs text-error select-none">
        Unknown widget type: {widgetKind}
      </div>
    );
  }

  const WidgetComponent = mod.component;
  return (
    <WidgetComponent
      instance={instance}
      editMode={editMode}
      onToggleEditMode={toggleEditMode}
      patchState={patchState}
      patchSettings={patchSettings}
    />
  );
}

function App() {
  useTheme();

  const params = new URLSearchParams(window.location.search);
  const view = params.get("view");
  const widgetId = params.get("w");

  if (view === "settings") {
    return <SettingsApp />;
  }

  if (view === "context-menu") {
    return <ContextMenuApp />;
  }

  if (widgetId) {
    return <WidgetHost id={widgetId} />;
  }

  return (
    <main className="flex h-full w-full items-center justify-center p-4">
      <div className="rounded-card border border-line bg-surface p-6 text-center shadow-card">
        <h1 className="text-lg font-semibold text-fg">Nook</h1>
        <p className="mt-1 text-sm text-fg-muted">Waiting for widget parameters...</p>
      </div>
    </main>
  );
}

// Prevent default browser context menu globally across all windows (settings and widgets)
document.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

// Prevent Alt+Space system menu from opening
const preventAltSpace = (e: KeyboardEvent) => {
  if (e.altKey && (e.code === "Space" || e.key === " ")) {
    e.preventDefault();
    e.stopPropagation();
  }
};
window.addEventListener("keydown", preventAltSpace, { capture: true });
window.addEventListener("keyup", preventAltSpace, { capture: true });

// Disable browser / WebView2 default autocomplete, autofill suggestions, and spellcheck on all inputs
document.addEventListener(
  "focusin",
  (e) => {
    const target = e.target;
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      if (!target.hasAttribute("autocomplete")) {
        target.setAttribute("autocomplete", target.type === "password" ? "new-password" : "off");
      }
      if (!target.hasAttribute("autocorrect")) target.setAttribute("autocorrect", "off");
      if (!target.hasAttribute("autocapitalize")) target.setAttribute("autocapitalize", "off");
      if (!target.hasAttribute("spellcheck")) target.setAttribute("spellcheck", "false");
      target.setAttribute("data-form-type", "other");
      target.setAttribute("data-lpignore", "true");
    }
  },
  { capture: true },
);

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
