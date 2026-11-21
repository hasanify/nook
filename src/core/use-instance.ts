import { useCallback, useEffect, useRef, useState } from "react";

import { getInstance, onConfigChanged, updateSettings, updateState } from "./ipc";
import type { WidgetInstance } from "./types";

/**
 * Manages reactive state and configuration for a single desktop widget instance.
 *
 * Synchronizes local state changes optimistically for instant UI feedback,
 * debouncing backend persistence IPC calls (500ms) to prevent disk/registry thrashing
 * on rapid updates (e.g. active timers, note typing).
 */
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

  /**
   * Optimistically applies state patches to the local instance and queues
   * a debounced backend synchronization payload.
   */
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

  /**
   * Immediately updates widget settings and sends the configuration patch via IPC.
   */
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
