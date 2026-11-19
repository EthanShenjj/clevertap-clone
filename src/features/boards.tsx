"use client";
import { TrendChart } from "@/components/charts";
import { EVENT_NAMES } from "@/components/query-builder";
import {
  Button,
  Empty,
  ErrorState,
  Field,
  IconButton,
  Loading,
  Modal,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import {
  api,
  endpoint,
  number,
  shortDate,
  usePostQuery,
  useRequest,
} from "@/lib/client";
import type { Board, BoardTile, ListResponse } from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Maximize2,
  PanelsTopLeft,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function Boards() {
  const { projectId, toast } = useWorkspace(),
    router = useRouter(),
    request = useRequest<ListResponse<Board>>(
      endpoint("boards", projectId, { pageSize: 100 }),
    );
  const [create, setCreate] = useState(false),
    [name, setName] = useState(""),
    [description, setDescription] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ data: Board }>(endpoint("boards", projectId), {
        method: "POST",
        body: { name, description },
      });
      toast("Your new board is ready.");
      router.push("/boards/" + result.data.id);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="THE BIG PICTURE, YOUR WAY"
        title="Boards"
        description="Bring your most meaningful insights into one view."
        actions={
          <Button onClick={() => setCreate(true)}>
            <Plus size={16} />
            Create board
          </Button>
        }
      />
      {request.error ? (
        <ErrorState message={request.error} retry={request.reload} />
      ) : !request.data ? (
        <Loading />
      ) : (
        <div className="boards-grid">
          {request.data.data.map((board, index) => (
            <Link
              className="panel board-card"
              href={"/boards/" + board.id}
              key={board.id}
            >
              <div className={"board-preview board-preview-" + (index % 3)}>
                <div className="mini-board-metrics">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="mini-board-chart">
                  <PanelsTopLeft size={38} strokeWidth={1} />
                  <span>{board.tiles.length} insights, one perspective</span>
                </div>
                <div className="mini-board-bars">
                  {[45, 70, 55, 90, 65, 85, 72, 95, 80, 100, 88].map(
                    (height, i) => (
                      <i key={i} style={{ height: height + "%" }} />
                    ),
                  )}
                </div>
              </div>
              <div className="board-card-info">
                <span className="summary-icon blue">
                  <PanelsTopLeft size={19} />
                </span>
                <h3>{board.name}</h3>
                <ArrowUpRight size={17} />
              </div>
              <p>{board.description}</p>
              <div className="board-card-meta">
                <span>{board.tiles.length} tiles</span>
                <span>Edited {shortDate(board.updatedAt)}</span>
              </div>
            </Link>
          ))}
          <button className="new-board-card" onClick={() => setCreate(true)}>
            <span>
              <Plus size={24} />
            </span>
            <strong>A fresh perspective</strong>
            <p>Create a board for the insights that matter to you.</p>
          </button>
        </div>
      )}
      {create ? (
        <Modal
          title="Create a board"
          description="A home for your most important insights."
          onClose={() => setCreate(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreate(false)}>
                Cancel
              </Button>
              <Button loading={busy} onClick={save}>
                Create board
              </Button>
            </>
          }
        >
          <Field label="Board name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer engagement"
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What would you like to keep an eye on?"
            />
          </Field>
          {error ? <div className="inline-error">{error}</div> : null}
        </Modal>
      ) : null}
    </>
  );
}
function BoardChart({ tile }: { tile: BoardTile }) {
  const { projectId, from, to } = useWorkspace();
  const query = usePostQuery<{ data: Record<string, string | number>[] }>(
    endpoint("analytics/query", projectId),
    { type: "trends", events: [tile.event], metric: tile.metric, from, to },
  );
  return query.loading ? (
    <Loading />
  ) : query.error ? (
    <ErrorState message={query.error} retry={query.reload} />
  ) : (
    <>
      <div className="board-tile-value">
        <strong>
          {number(Number(query.data?.data.at(-1)?.[tile.event] || 0))}
        </strong>
        <span>on the last day · {tile.metric}</span>
      </div>
      <TrendChart
        data={query.data?.data || []}
        dataKey={tile.event}
        height={200}
      />
    </>
  );
}
export function BoardDetail({ id }: { id: string }) {
  const { projectId, toast } = useWorkspace(),
    request = useRequest<{ data: Board }>(endpoint("boards/" + id, projectId));
  const [adding, setAdding] = useState(false),
    [title, setTitle] = useState(""),
    [event, setEvent] = useState("App Launched"),
    [metric, setMetric] = useState("users"),
    [busy, setBusy] = useState(false),
    [dragged, setDragged] = useState<string | null>(null);
  const update = async (tiles: BoardTile[]) => {
    setBusy(true);
    try {
      await api(endpoint("boards/" + id, projectId), {
        method: "PATCH",
        body: { tiles },
      });
      request.reload();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  if (request.error)
    return <ErrorState message={request.error} retry={request.reload} />;
  if (!request.data) return <Loading />;
  const board = request.data.data;
  const move = (from: number, to: number) => {
    const tiles = [...board.tiles],
      [tile] = tiles.splice(from, 1);
    tiles.splice(to, 0, tile);
    void update(tiles);
  };
  return (
    <>
      <Link className="back-link" href="/boards">
        <ArrowLeft size={15} />
        All boards
      </Link>
      <PageHeader
        eyebrow="YOUR INSIGHTS, CONNECTED"
        title={board.name}
        description={board.description}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus size={16} />
            Add insight
          </Button>
        }
      />
      <div className="board-detail-grid">
        {board.tiles.map((tile, index) => (
          <section
            className={"panel board-tile " + tile.size}
            key={tile.id}
            draggable
            onDragStart={() => setDragged(tile.id)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const start = board.tiles.findIndex((t) => t.id === dragged);
              if (start >= 0 && start !== index) move(start, index);
              setDragged(null);
            }}
          >
            <SectionHeading
              title={tile.title}
              description={tile.event}
              action={
                <div className="tile-controls">
                  <IconButton
                    label={"Move " + tile.title + " left"}
                    disabled={index === 0 || busy}
                    onClick={() => move(index, index - 1)}
                  >
                    <ArrowLeft size={13} />
                  </IconButton>
                  <IconButton
                    label={"Move " + tile.title + " right"}
                    disabled={index === board.tiles.length - 1 || busy}
                    onClick={() => move(index, index + 1)}
                  >
                    <ArrowRight size={13} />
                  </IconButton>
                  <IconButton
                    label={"Resize " + tile.title}
                    onClick={() =>
                      update(
                        board.tiles.map((t) =>
                          t.id === tile.id
                            ? {
                                ...t,
                                size: t.size === "wide" ? "normal" : "wide",
                              }
                            : t,
                        ),
                      )
                    }
                  >
                    <Maximize2 size={13} />
                  </IconButton>
                  <IconButton
                    label={"Remove " + tile.title}
                    onClick={() =>
                      update(board.tiles.filter((t) => t.id !== tile.id))
                    }
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
              }
            />
            <BoardChart tile={tile} />
          </section>
        ))}
      </div>
      {!board.tiles.length ? (
        <section className="panel">
          <Empty
            title="Make room for a little insight"
            description="Add an analysis to start building your perspective."
            action={
              <Button onClick={() => setAdding(true)}>Add insight</Button>
            }
          />
        </section>
      ) : null}
      {adding ? (
        <Modal
          title="Add an insight"
          onClose={() => setAdding(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setAdding(false)}>
                Cancel
              </Button>
              <Button
                loading={busy}
                onClick={async () => {
                  await update([
                    ...board.tiles,
                    {
                      id: crypto.randomUUID(),
                      title: title || event,
                      event,
                      metric,
                      size: "normal",
                    },
                  ]);
                  setAdding(false);
                  setTitle("");
                }}
              >
                Add insight
              </Button>
            </>
          }
        >
          <Field label="Title">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Daily active customers"
            />
          </Field>
          <Field label="Event">
            <select value={event} onChange={(e) => setEvent(e.target.value)}>
              {EVENT_NAMES.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </Field>
          <Field label="Measured by">
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="users">Unique users</option>
              <option value="events">Total events</option>
              <option value="revenue">Revenue</option>
            </select>
          </Field>
        </Modal>
      ) : null}
    </>
  );
}
