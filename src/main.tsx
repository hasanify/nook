import React from "react";
import ReactDOM from "react-dom/client";
import "./styles/theme.css";
import { TestWidget } from "./components/TestWidget";
import { useTheme } from "./core/use-theme";

function App() {
  useTheme();

  const params = new URLSearchParams(window.location.search);
  const widgetId = params.get("w");

  if (!widgetId) {
    return (
      <main className="flex h-full w-full items-center justify-center p-4">
        <div className="rounded-card border border-line bg-surface p-6 text-center shadow-card">
          <h1 className="text-lg font-semibold text-fg">Nook</h1>
          <p className="mt-1 text-sm text-fg-muted">Waiting for widget parameters...</p>
        </div>
      </main>
    );
  }

  return <TestWidget id={widgetId} />;
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
