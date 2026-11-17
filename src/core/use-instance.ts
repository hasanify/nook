import { useState, useEffect, useRef, useCallback } from "react";
import { getInstance, updateState, updateSettings, onConfigChanged } from "./ipc";
import type { WidgetInstance } from "./types";

export function useInstance(id: string) {
  const [instance, setInstance] = useState<WidgetInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const pendingStateRef = useRef<Record<string, unknown>>({});
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchInstance = useCallback(() => {
    getInstance(id)
      .then((data) => {
        setInstance(data);
        setError(null);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });
  }, [id]);

  useEffect(() => {
    fetchInstance();

    let unlisten: (() => void) | undefined;
    onConfigChanged((payload) => {
      if (payload.ids.includes(id)) {
        fetchInstance();
      }
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [id, fetchInstance]);

  // Patch state (debounced 500ms)
  const patchState = useCallback(
    (patch: Record<string, unknown>) => {
      setInstance((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          state: { ...prev.state, ...patch },
        };
      });

      pendingStateRef.current = {
        ...pendingStateRef.current,
        ...patch,
      };

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        const toSend = pendingStateRef.current;
        pendingStateRef.current = {};
        void updateState(id, toSend);
      }, 500);
    },
    [id],
  );

  // Patch settings
  const patchSettings = useCallback(
    (patch: Record<string, unknown>) => {
      setInstance((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          settings: { ...prev.settings, ...patch },
        };
      });

      void updateSettings(id, patch);
    },
    [id],
  );

  return {
    instance,
    loading,
    error,
    patchState,
    patchSettings,
    refresh: fetchInstance,
  };
}
