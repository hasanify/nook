import { useState, useEffect, useCallback } from "react";
import { getEditMode, setEditMode as ipcSetEditMode, onEditMode } from "./ipc";

export function useEditMode() {
  const [editMode, setEditModeState] = useState(false);

  useEffect(() => {
    // Initial fetch
    getEditMode()
      .then((on) => setEditModeState(on))
      .catch(() => {});

    // Listen to changes
    let unlisten: (() => void) | undefined;
    onEditMode((payload) => {
      setEditModeState(payload.on);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const toggleEditMode = useCallback(() => {
    void ipcSetEditMode(!editMode);
  }, [editMode]);

  const setEditMode = useCallback((on: boolean) => {
    void ipcSetEditMode(on);
  }, []);

  return {
    editMode,
    toggleEditMode,
    setEditMode,
  };
}
