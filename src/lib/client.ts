"use client";
import { useCallback, useEffect, useState } from "react";

export class RequestError extends Error {
  constructor(
    message: string,
    public status: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
export async function api<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: options.method || "GET",
    signal: options.signal,
    cache: "no-store",
    headers:
      options.method && options.method !== "GET"
        ? { "Content-Type": "application/json" }
        : undefined,
    body:
      options.body !== undefined
        ? JSON.stringify(options.body)
        : options.method && options.method !== "GET"
          ? "{}"
          : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new RequestError(
      result.error?.message || "Unable to complete this request.",
      response.status,
      result.error?.fields,
    );
  return result as T;
}
export function endpoint(
  path: string,
  projectId: string,
  params: Record<string, string | number | undefined> = {},
) {
  const query = new URLSearchParams({ projectId });
  for (const [key, value] of Object.entries(params))
    if (value !== undefined && value !== "") query.set(key, String(value));
  return "/api/" + path + "?" + query.toString();
}
export function useRequest<T>(path: string | null) {
  const [result, setResult] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
    key: string | null;
  }>({ loading: true, key: null });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const load = async () => {
      setResult((previous) => ({
        ...previous,
        error: undefined,
        loading: true,
        key: path,
      }));
      try {
        const data = await api<T>(path, { signal: controller.signal });
        if (!controller.signal.aborted)
          setResult({ data, loading: false, key: path });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({
            error:
              error instanceof Error ? error.message : "Could not load data.",
            loading: false,
            key: path,
          });
      }
    };
    void load();
    return () => controller.abort();
  }, [path, version]);
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  return {
    data: result.key === path ? result.data : undefined,
    error: result.key === path ? result.error : undefined,
    loading: result.loading || result.key !== path,
    reload,
  };
}
export const number = (value: number) =>
  new Intl.NumberFormat("en-US").format(value);
export const compact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
export const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
export const shortDate = (value: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
export function usePostQuery<T>(path: string, body: unknown) {
  const key = JSON.stringify(body),
    [version, setVersion] = useState(0);
  const [result, setResult] = useState<{
    data?: T;
    error?: string;
    loading: boolean;
  }>({ loading: true });
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setResult((previous) => ({
        ...previous,
        error: undefined,
        loading: true,
      }));
      try {
        const data = await api<T>(path, {
          method: "POST",
          body: JSON.parse(key),
          signal: controller.signal,
        });
        if (!controller.signal.aborted) setResult({ data, loading: false });
      } catch (error) {
        if (!controller.signal.aborted)
          setResult({ error: (error as Error).message, loading: false });
      }
    };
    void load();
    return () => controller.abort();
  }, [path, key, version]);
  return { ...result, reload: () => setVersion((value) => value + 1) };
}
export function downloadCsv(rows: Record<string, unknown>[], filename: string) {
  if (!rows.length) return;
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) =>
    '"' + String(value ?? "").replaceAll('"', '""') + '"';
  const csv =
    "\uFEFF" +
    [
      columns.map(escape).join(","),
      ...rows.map((row) =>
        columns.map((column) => escape(row[column])).join(","),
      ),
    ].join("\r\n");
  const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8;" }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download = filename + ".csv";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
