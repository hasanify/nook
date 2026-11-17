import { useState, useEffect, useCallback } from "react";
import { getProviderSnapshot, refreshWidgetProvider, onProviderData } from "./ipc";
import type { ProviderPayload } from "./types";

export function useProvider<T = unknown>(widgetId: string) {
  const [payload, setPayload] = useState<ProviderPayload<T> | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await refreshWidgetProvider<T>(widgetId);
      if (res) {
        setPayload(res);
      }
    } catch {
      // Ignore
    }
  }, [widgetId]);

  useEffect(() => {
    getProviderSnapshot<T>(widgetId)
      .then((data) => {
        if (data) setPayload(data);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    let unlisten: (() => void) | undefined;
    onProviderData<T>(widgetId, (data) => {
      setPayload(data);
      setLoading(false);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, [widgetId]);

  return {
    payload,
    loading,
    refresh,
  };
}
