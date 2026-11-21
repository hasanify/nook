import { useCallback, useEffect, useState } from "react";

import {
  getEditMode,
  getWidgetEditMode,
  onEditMode,
  onWidgetEditMode,
  setEditMode as ipcSetEditMode,
  setWidgetEditMode,
} from "./ipc";

/**
 * Tracks and manages desktop edit mode state.
 *
 * Supports both global edit mode (toggled via Ctrl+Alt+E or tray menu) and
 * single-widget target edit mode (toggled from a widget's context menu).
 */
export function useEditMode(widgetId?: string) {
  const [globalEditMode, setGlobalEditMode] = useState(false);
  const [singleEditMode, setSingleEditMode] = useState(false);

  useEffect(() => {
    getEditMode()
      .then((on) => setGlobalEditMode(on))
      .catch(() => {});

    if (widgetId) {
      getWidgetEditMode(widgetId)
        .then((on) => setSingleEditMode(on))
        .catch(() => {});
    }

    let unlistenGlobal: (() => void) | undefined;
    onEditMode((payload) => {
      setGlobalEditMode(payload.on);
      if (!payload.on) {
        setSingleEditMode(false);
      }
    }).then((fn) => {
      unlistenGlobal = fn;
    });

    let unlistenWidget: (() => void) | undefined;
    onWidgetEditMode((payload) => {
      if (!widgetId || payload.id === widgetId) {
        setSingleEditMode(payload.on);
      }
    }).then((fn) => {
      unlistenWidget = fn;
    });

    return () => {
      if (unlistenGlobal) unlistenGlobal();
      if (unlistenWidget) unlistenWidget();
    };
  }, [widgetId]);

  const effectiveEditMode = globalEditMode || singleEditMode;

  const toggleEditMode = useCallback(() => {
    if (widgetId) {
      void setWidgetEditMode(widgetId, !effectiveEditMode);
    } else {
      void ipcSetEditMode(!globalEditMode);
    }
  }, [widgetId, effectiveEditMode, globalEditMode]);

  const setEditMode = useCallback(
    (on: boolean) => {
      if (widgetId) {
        void setWidgetEditMode(widgetId, on);
      } else {
        void ipcSetEditMode(on);
      }
    },
    [widgetId],
  );

  return {
    editMode: effectiveEditMode,
    globalEditMode,
    singleEditMode,
    toggleEditMode,
    setEditMode,
  };
}
