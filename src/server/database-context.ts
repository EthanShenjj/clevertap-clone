import { AsyncLocalStorage } from "node:async_hooks";
import type { DatabaseSync } from "node:sqlite";

// A cloud request gets its own SQLite projection, never the process-global DB.
export const databaseContext = new AsyncLocalStorage<DatabaseSync>();

export function usesCloudStorage() {
  return (
    process.env.WORKSPACE_STORAGE === "netlify" ||
    Boolean(process.env.NETLIFY_DB_URL) ||
    // Netlify's Node Functions run in Lambda. Fail closed into cloud storage
    // even if an optional mode variable was not injected into the runtime.
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME)
  );
}
