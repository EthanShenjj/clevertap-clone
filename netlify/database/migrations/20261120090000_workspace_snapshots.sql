-- PostgreSQL is the durable source of truth for the demo workspace.
-- Each API transaction locks this row while SQLite computes the request.
CREATE TABLE workspace_snapshots (
  id TEXT PRIMARY KEY,
  revision BIGINT NOT NULL DEFAULT 0,
  payload BYTEA,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO workspace_snapshots (id) VALUES ('workspace-v1');
