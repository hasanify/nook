import { useCallback, useEffect, useState } from "react";

import {
  getEditMode,
  getWidgetEditMode,
  onEditMode,
  onWidgetEditMode,
  setEditMode as ipcSetEditMode,
  setWidgetEditMode,
} from "./ipc";

export function useEditMode(widgetId?: string) {
  const [globalEditMode, setGlobalEditMode] = useState(false);
  const [singleEditMode, setSingleEditMode] = useState(false);

  useEffect(() => {
    // Initial fetch of global edit mode
    getEditMode()
      .then((on) => setGlobalEditMode(on))
      .catch(() => {});

    // If widgetId provided, check if this widget has single edit mode active
    if (widgetId) {
      getWidgetEditMode(widgetId)
        .then((on) => setSingleEditMode(on))
        .catch(() => {});
    }

    // Listen to global changes
    let unlistenGlobal: (() => void) | undefined;
    onEditMode((payload) => {
      setGlobalEditMode(payload.on);
      if (!payload.on) {
        setSingleEditMode(false);
      }
    }).then((fn) => {
      unlistenGlobal = fn;
    });

    // Listen to individual widget edit mode changes
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
