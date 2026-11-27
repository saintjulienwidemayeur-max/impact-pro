"use client";

import * as React from "react";
import { api, ApiError } from "./api";
import type { Meta } from "./types";

export interface FetchState<T> {
  data: T | null;
  meta: Meta | null;
  loading: boolean;
  error: ApiError | null;
  reload: () => void;
}

/** GET with loading / error state; refetches when `path` or `query` change. `null` path = skip. */
export function useFetch<T>(path: string | null, query?: Record<string, string | number | boolean | undefined | null>): FetchState<T> {
  const [data, setData] = React.useState<T | null>(null);
  const [meta, setMeta] = React.useState<Meta | null>(null);
  const [loading, setLoading] = React.useState(path !== null);
  const [error, setError] = React.useState<ApiError | null>(null);
  const [tick, setTick] = React.useState(0);
  const key = JSON.stringify([path, query]);

  React.useEffect(() => {
    if (path === null) {
      setLoading(false);
      return;
    }
    const ctl = new AbortController();
    setLoading(true);
    setError(null);
    api<T>(path, { query, signal: ctl.signal })
      .then((r) => {
        setData(r.data);
        setMeta(r.meta ?? null);
      })
      .catch((e) => {
        if (ctl.signal.aborted) return;
        setError(e instanceof ApiError ? e : new ApiError("Erreur inattendue", 0));
      })
      .finally(() => {
        if (!ctl.signal.aborted) setLoading(false);
      });
    return () => ctl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  return { data, meta, loading, error, reload: () => setTick((t) => t + 1) };
}

/** Debounced value (search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}
