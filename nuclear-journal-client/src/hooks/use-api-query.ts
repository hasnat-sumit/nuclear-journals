"use client";

import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";

interface QueryState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

// Loads data from the API for a dashboard page. Pass null to wait until a value
// such as an id is known. `reload` fetches again after a change.
export function useApiQuery<T>(path: string | null) {
  const [state, setState] = useState<QueryState<T>>({ data: null, error: null, loading: true });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;

    api
      .get<T>(path)
      .then((data) => {
        if (!cancelled) setState({ data, error: null, loading: false });
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ data: null, error: errorMessage(error), loading: false });
      });

    // A response for an old path must not overwrite a newer one.
    return () => {
      cancelled = true;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return { ...state, reload };
}
