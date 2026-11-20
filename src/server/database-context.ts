import { AsyncLocalStorage } from "node:async_hooks";
import type { DatabaseSync } from "node:sqlite";

// A cloud request gets its own SQLite projection, never the process-global DB.
export const databaseContext = new AsyncLocalStorage<DatabaseSync>();

export function usesCloudStorage() {
  return (
    process.env.WORKSPACE_STORAGE === "netlify" ||
    Boolean(process.env.NETLIFY_DB_URL)
  );
}
