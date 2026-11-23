import { getDatabase, type DatabaseConnection } from "@netlify/database";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";
import { gzip, gunzip } from "node:zlib";
import { handleApi } from "./api";
import { databaseContext, usesCloudStorage } from "./database-context";
import { openDatabase } from "./database";

const compress = promisify(gzip);
const decompress = promisify(gunzip);
let connection: DatabaseConnection | undefined;

/**
 * Demo compatibility layer: PostgreSQL holds a compressed workspace snapshot.
 * FOR UPDATE serializes requests across function instances. The response is
 * returned only after COMMIT; /tmp is disposable and never authoritative.
 * For a larger service, move resource tables and queries directly to Postgres.
 */
async function cloudRequest(request: Request, route: string[]) {
  connection ??= getDatabase(
    process.env.NETLIFY_DB_URL
      ? { connectionString: process.env.NETLIFY_DB_URL }
      : undefined,
  );
  const client = await connection.pool.connect();
  let directory: string | undefined;
  let db: DatabaseSync | undefined;
  try {
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '15s'");
    await client.query("SET LOCAL statement_timeout = '25s'");
    const result = await client.query(
      "SELECT payload FROM workspace_snapshots WHERE id=$1 FOR UPDATE",
      ["workspace-v1"],
    );
    if (result.rows.length !== 1)
      throw new Error("Workspace storage migration has not been applied.");

    const payload = result.rows[0].payload as Buffer | null;
    directory = await mkdtemp(path.join(tmpdir(), "clevertap-request-"));
    const file = path.join(directory, "workspace.sqlite");
    if (payload) await writeFile(file, await decompress(payload));
    db = openDatabase(file);
    const response = await databaseContext.run(db, () =>
      handleApi(request, route),
    );

    // Close/checkpoint before reading the snapshot; pending WAL data must land.
    db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    db.close();
    db = undefined;
    if (
      response.ok &&
      (!payload ||
        request.method !== "GET" ||
        (route[0] === "sms" && route[1] === "callbacks"))
    ) {
      const snapshot = await compress(await readFile(file));
      await client.query(
        "UPDATE workspace_snapshots SET payload=$1, revision=revision+1, updated_at=NOW() WHERE id=$2",
        [snapshot, "workspace-v1"],
      );
    }
    await client.query("COMMIT");
    response.headers.set("X-Workspace-Storage", "netlify-postgres");
    return response;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    db?.close();
    client.release();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}

export async function handleStoredApi(request: Request, route: string[]) {
  if (!usesCloudStorage()) return handleApi(request, route);
  try {
    return await cloudRequest(request, route);
  } catch (error) {
    console.error("Cloud workspace request failed", error);
    return Response.json(
      {
        error: {
          code: "STORAGE_UNAVAILABLE",
          message:
            "Workspace storage is temporarily unavailable. Please retry.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
