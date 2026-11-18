import { useState, useEffect } from "react";
import { getAppConfig, onConfigChanged } from "./ipc";

export function useTheme() {
  const [theme, setTheme] = useState<"system" | "light" | "dark">("system");
  const [preset, setPreset] = useState<string>("default");

  useEffect(() => {
    // Initial fetch
    getAppConfig()
      .then((cfg) => {
        if (cfg.app?.theme) setTheme(cfg.app.theme);
        if (cfg.app?.widgetPreset) setPreset(cfg.app.widgetPreset);
      })
      .catch(() => {});

    // Listen to config changes
    let unlisten: (() => void) | undefined;
    onConfigChanged((payload) => {
      if (payload.app || !payload.ids || payload.ids.length === 0) {
        getAppConfig()
          .then((cfg) => {
            if (cfg.app?.theme) setTheme(cfg.app.theme);
            if (cfg.app?.widgetPreset) setPreset(cfg.app.widgetPreset);
          })
          .catch(() => {});
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-widget-preset", preset);
  }, [preset]);

  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const applyTheme = () => {
      if (theme === "dark") {
        root.classList.add("dark");
      } else if (theme === "light") {
        root.classList.remove("dark");
      } else {
        if (mediaQuery.matches) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      }
    };

    applyTheme();

    if (theme === "system") {
      const handler = () => applyTheme();
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    }
  }, [theme]);

  return { theme, preset };
}
