"use client";
import { usePathname, useSearchParams } from "next/navigation";
export function useTableState() {
  const params = useSearchParams(),
    pathname = usePathname();
  const update = (values: Record<string, string | number>) => {
    const next = new URLSearchParams(params.toString());
    if (!("page" in values)) next.set("page", "1");
    for (const [key, value] of Object.entries(values)) {
      if (value === "" || value === "All") next.delete(key);
      else next.set(key, String(value));
    }
    window.history.replaceState(
      null,
      "",
      pathname + (next.size ? "?" + next.toString() : ""),
    );
  };
  return {
    search: params.get("search") || "",
    status: params.get("status") || "All",
    channel: params.get("channel") || "All",
    page: Number(params.get("page") || 1),
    pageSize: Number(params.get("pageSize") || 10),
    sort: params.get("sort") || "updatedAt",
    direction: params.get("direction") || "desc",
    update,
    query: Object.fromEntries(params.entries()),
    onSort: (sort: string) =>
      update({
        sort,
        direction:
          params.get("sort") === sort && params.get("direction") !== "asc"
            ? "asc"
            : "desc",
      }),
  };
}
