import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/theme.css";
import { SettingsApp } from "./settings/SettingsApp";
import { getWidgetModule } from "./widgets/registry";
import { useInstance } from "./core/use-instance";
import { useEditMode } from "./core/use-edit-mode";
import { useTheme } from "./core/use-theme";

function WidgetHost({ id }: { id: string }) {
  const { instance, loading, error, patchState, patchSettings } = useInstance(id);
  const { editMode } = useEditMode();

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

  const mod = getWidgetModule(instance.kind) ?? getWidgetModule("placeholder");
  if (!mod) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-card border border-error bg-surface p-4 text-xs text-error select-none">
        Unknown widget type: {instance.kind}
      </div>
    );
  }

  const WidgetComponent = mod.component;
  return (
    <WidgetComponent
      instance={instance}
      editMode={editMode}
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

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
