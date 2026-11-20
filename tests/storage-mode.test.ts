import assert from "node:assert/strict";
import test from "node:test";
import { usesCloudStorage } from "../src/server/database-context.ts";

test("serverless requests cannot fall back to an ephemeral local database", () => {
  const keys = [
    "WORKSPACE_STORAGE",
    "NETLIFY_DB_URL",
    "AWS_LAMBDA_FUNCTION_NAME",
  ] as const;
  const saved = keys.map((key) => process.env[key]);
  try {
    keys.forEach((key) => delete process.env[key]);
    assert.equal(usesCloudStorage(), false);
    process.env.WORKSPACE_STORAGE = "netlify";
    assert.equal(usesCloudStorage(), true);
    delete process.env.WORKSPACE_STORAGE;
    process.env.NETLIFY_DB_URL = "postgres://localhost/test";
    assert.equal(usesCloudStorage(), true);
    delete process.env.NETLIFY_DB_URL;
    process.env.AWS_LAMBDA_FUNCTION_NAME = "netlify-server-handler";
    assert.equal(usesCloudStorage(), true);
  } finally {
    keys.forEach((key, index) => {
      if (saved[index] === undefined) delete process.env[key];
      else process.env[key] = saved[index];
    });
  }
});
