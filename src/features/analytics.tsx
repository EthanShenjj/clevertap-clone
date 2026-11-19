"use client";
import { CHART_COLORS, MultiLineChart } from "@/components/charts";
import { EVENT_NAMES } from "@/components/query-builder";
import {
  Button,
  DataTable,
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
  downloadCsv,
  endpoint,
  number,
  usePostQuery,
  useRequest,
} from "@/lib/client";
import type { Board, ListResponse, Person, Segment } from "@/lib/types";
import {
  ArrowDown,
  ArrowUp,
  Download,
  Info,
  Pin,
  Play,
  Plus,
  Save,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PersonSample } from "./segments";

export function PinToBoard({
  event,
  onClose,
}: {
  event: string;
  onClose: () => void;
}) {
  const { projectId, toast } = useWorkspace();
  const boards = useRequest<ListResponse<Board>>(
    endpoint("boards", projectId, { pageSize: 100 }),
  );
  const [selected, setSelected] = useState(""),
    [title, setTitle] = useState(event),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    const board = boards.data?.data.find((board) => board.id === selected);
    if (!board) {
      setError("Choose a board.");
      return;
    }
    setBusy(true);
    try {
      await api(endpoint("boards/" + board.id, projectId), {
        method: "PATCH",
        body: {
          tiles: [
            ...board.tiles,
            {
              id: crypto.randomUUID(),
              title,
              event,
              metric: "events",
              size: "normal",
            },
          ],
        },
      });
      toast("Analysis added to " + board.name + ".");
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Add analysis to a board"
      description="Keep the insights you care about close."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            <Pin size={15} />
            Add to board
          </Button>
        </>
      }
    >
      <Field label="Board">
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose a board</option>
          {boards.data?.data.map((board) => (
            <option value={board.id} key={board.id}>
              {board.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Tile title">
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
      </Field>
      {error ? <div className="inline-error">{error}</div> : null}
    </Modal>
  );
}
export function Trends({ eventName }: { eventName?: string }) {
  const { projectId, from, to } = useWorkspace();
  const [events, setEvents] = useState([eventName || "App Launched"]),
    [metric, setMetric] = useState("users"),
    [segmentId, setSegmentId] = useState("");
  const [applied, setApplied] = useState({ events, metric, segmentId }),
    [pin, setPin] = useState(false);
  const segments = useRequest<ListResponse<Segment>>(
    endpoint("segments", projectId, { pageSize: 100 }),
  );
  const request = usePostQuery<{
    data: (Record<string, string | number> & { date: string })[];
    events: string[];
    total: number;
  }>(endpoint("analytics/query", projectId), {
    type: "trends",
    ...applied,
    from,
    to,
  });
  return (
    <>
      <PageHeader
        eyebrow="TURN BEHAVIOR INTO UNDERSTANDING"
        title={eventName || "Trends"}
        description="Every event is a signal. Find the patterns that matter."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={!request.data}
              onClick={() => downloadCsv(request.data!.data, "trends")}
            >
              <Download size={16} />
              Export
            </Button>
            <Button variant="secondary" onClick={() => setPin(true)}>
              <Pin size={15} />
              Add to board
            </Button>
          </>
        }
      />
      <section className="panel analytics-query-panel">
        <SectionHeading title="What would you like to explore?" />
        <div className="analysis-event-fields">
          {events.map((event, index) => (
            <div className="analysis-event" key={index}>
              <span
                className="event-letter"
                style={{
                  background: CHART_COLORS[index] + "15",
                  color: CHART_COLORS[index],
                }}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <select
                aria-label={"Event " + (index + 1)}
                value={event}
                onChange={(e) =>
                  setEvents(
                    events.map((value, i) =>
                      i === index ? e.target.value : value,
                    ),
                  )
                }
              >
                {EVENT_NAMES.map((name) => (
                  <option key={name}>{name}</option>
                ))}
              </select>
              {events.length > 1 ? (
                <IconButton
                  label={"Remove event " + (index + 1)}
                  onClick={() =>
                    setEvents(events.filter((_, i) => i !== index))
                  }
                >
                  <X size={14} />
                </IconButton>
              ) : null}
            </div>
          ))}
          {events.length < 5 ? (
            <Button
              variant="ghost"
              onClick={() =>
                setEvents([
                  ...events,
                  EVENT_NAMES.find((event) => !events.includes(event)) ||
                    "Charged",
                ])
              }
            >
              <Plus size={15} />
              Add event
            </Button>
          ) : null}
        </div>
        <div className="analysis-options">
          <Field label="Measured by">
            <select value={metric} onChange={(e) => setMetric(e.target.value)}>
              <option value="users">Unique users</option>
              <option value="events">Total events</option>
              <option value="revenue">Revenue (Charged events)</option>
            </select>
          </Field>
          <Field label="Audience">
            <select
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
            >
              <option value="">All users</option>
              {segments.data?.data.map((segment) => (
                <option key={segment.id} value={segment.id}>
                  {segment.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="analysis-run">
            <Button
              onClick={() => {
                setApplied({ events, metric, segmentId });
                request.reload();
              }}
              loading={request.loading}
            >
              <Play size={15} />
              Run analysis
            </Button>
          </div>
        </div>
      </section>
      <section className="panel analysis-result">
        <SectionHeading
          title={
            applied.metric === "users"
              ? "Unique users over time"
              : applied.metric === "revenue"
                ? "Revenue over time"
                : "Events over time"
          }
          description={from + " – " + to}
          action={<span className="tag">Daily</span>}
        />
        {request.error ? (
          <ErrorState message={request.error} retry={request.reload} />
        ) : request.loading ? (
          <Loading />
        ) : request.data ? (
          <>
            <MultiLineChart
              data={request.data.data}
              events={request.data.events}
            />
            <div className="analysis-table">
              <DataTable
                rows={request.data.data.map((row) => ({
                  ...row,
                  id: String(row.date),
                }))}
                columns={[
                  {
                    key: "date",
                    label: "Date",
                    render: (row) => String(row.date),
                  },
                  ...request.data.events.map((name) => ({
                    key: name,
                    label: name,
                    render: (row: Record<string, string | number>) => (
                      <strong className="numeric">
                        {number(Number(row[name] || 0))}
                      </strong>
                    ),
                  })),
                ]}
              />
            </div>
          </>
        ) : null}
      </section>
      {pin ? (
        <PinToBoard event={applied.events[0]} onClose={() => setPin(false)} />
      ) : null}
    </>
  );
}
type FunnelStep = {
  name: string;
  users: number;
  conversion: number;
  dropoff: number;
  ids: string[];
};
export function Funnels() {
  const { projectId, from, to, toast } = useWorkspace(),
    router = useRouter();
  const [steps, setSteps] = useState([
      "App Launched",
      "Product Viewed",
      "Added to Cart",
      "Charged",
    ]),
    [windowDays, setWindow] = useState(7),
    [segmentId, setSegmentId] = useState("");
  const [applied, setApplied] = useState({ steps, windowDays, segmentId }),
    [selected, setSelected] = useState<number | null>(null),
    [saving, setSaving] = useState(false),
    [saveName, setSaveName] = useState(""),
    [dropoff, setDropoff] = useState(true),
    [error, setError] = useState("");
  const segments = useRequest<ListResponse<Segment>>(
    endpoint("segments", projectId, { pageSize: 100 }),
  );
  const result = usePostQuery<{
    data: FunnelStep[];
    range: { start: string; end: string };
  }>(endpoint("analytics/query", projectId), {
    type: "funnel",
    ...applied,
    from,
    to,
  });
  const selectedIds =
    selected !== null
      ? result.data?.data[selected]?.ids.slice(0, 10) || []
      : [];
  const sample = useRequest<ListResponse<Person>>(
    selectedIds.length
      ? endpoint("people", projectId, {
          ids: selectedIds.join(","),
          pageSize: 10,
        })
      : null,
  );
  const save = async () => {
    if (selected === null || !result.data) return;
    setSaving(true);
    setError("");
    try {
      const response = await api<{ data: Segment }>(
        endpoint("segments", projectId),
        {
          method: "POST",
          body: {
            name: saveName,
            description: "Saved from a funnel analysis",
            query: {
              combinator: "and",
              rules: [],
              funnel: {
                steps: applied.steps,
                windowDays: applied.windowDays,
                from: result.data.range.start,
                to: result.data.range.end,
                step: selected,
                dropoff: dropoff && selected < applied.steps.length - 1,
              },
            },
          },
        },
      );
      toast("Funnel audience saved as a segment.");
      router.push("/segments/" + response.data.id);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="UNDERSTAND THE PATH TO CONVERSION"
        title="Funnels"
        description="See where customers move forward. And where they need a nudge."
        actions={
          <Button
            variant="secondary"
            disabled={!result.data}
            onClick={() =>
              downloadCsv(
                result.data!.data.map((row) => ({
                  name: row.name,
                  users: row.users,
                  conversion: row.conversion,
                  dropoff: row.dropoff,
                })),
                "funnel",
              )
            }
          >
            <Download size={16} />
            Export
          </Button>
        }
      />
      <section className="panel analytics-query-panel">
        <SectionHeading
          title="Define your customer path"
          description="Add events in the order you want your customers to complete them."
        />
        <div className="funnel-step-builder">
          {steps.map((step, index) => (
            <div className="funnel-step-input" key={index}>
              <span>{index + 1}</span>
              <select
                aria-label={"Funnel step " + (index + 1)}
                value={step}
                onChange={(e) =>
                  setSteps(
                    steps.map((value, i) =>
                      i === index ? e.target.value : value,
                    ),
                  )
                }
              >
                {EVENT_NAMES.map((event) => (
                  <option key={event}>{event}</option>
                ))}
              </select>
              <IconButton
                label={"Move funnel step " + (index + 1) + " up"}
                disabled={index === 0}
                onClick={() => {
                  const next = [...steps];
                  [next[index], next[index - 1]] = [
                    next[index - 1],
                    next[index],
                  ];
                  setSteps(next);
                }}
              >
                <ArrowUp size={13} />
              </IconButton>
              <IconButton
                label={"Remove funnel step " + (index + 1)}
                disabled={steps.length <= 2}
                onClick={() => setSteps(steps.filter((_, i) => i !== index))}
              >
                <X size={14} />
              </IconButton>
            </div>
          ))}
          {steps.length < 8 ? (
            <Button
              variant="ghost"
              onClick={() => setSteps([...steps, "Charged"])}
            >
              <Plus size={15} />
              Add step
            </Button>
          ) : null}
        </div>
        <div className="analysis-options">
          <Field label="Conversion window">
            <div className="input-unit">
              <input
                type="number"
                min={1}
                max={365}
                value={windowDays}
                onChange={(e) => setWindow(Number(e.target.value))}
              />
              <span>days</span>
            </div>
          </Field>
          <Field label="Audience">
            <select
              value={segmentId}
              onChange={(e) => setSegmentId(e.target.value)}
            >
              <option value="">All users</option>
              {segments.data?.data.map((segment) => (
                <option value={segment.id} key={segment.id}>
                  {segment.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="analysis-run">
            <Button
              onClick={() => {
                setApplied({ steps, windowDays, segmentId });
                setSelected(null);
                result.reload();
              }}
              loading={result.loading}
            >
              <Play size={15} />
              View funnel
            </Button>
          </div>
        </div>
      </section>
      <section className="panel analysis-result">
        <SectionHeading
          title="From first step to conversion"
          description="Strict order · Unique users · Click a step to explore its audience"
          action={
            <span className="funnel-total">
              {result.data?.data.at(-1)?.conversion.toFixed(1) || "0"}%
              <small>overall conversion</small>
            </span>
          }
        />
        {result.error ? (
          <ErrorState message={result.error} retry={result.reload} />
        ) : result.loading ? (
          <Loading />
        ) : result.data ? (
          <div className="funnel-chart">
            {result.data.data.map((step, index) => (
              <button
                className="funnel-chart-step"
                key={index}
                onClick={() => {
                  setSelected(index);
                  setSaveName(
                    step.name +
                      (index < applied.steps.length - 1
                        ? " drop-offs"
                        : " audience"),
                  );
                  setDropoff(index < applied.steps.length - 1);
                }}
              >
                <div className="funnel-chart-top">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step.name}</strong>
                  <span>{number(step.users)} users</span>
                  <b>{step.conversion.toFixed(1)}%</b>
                </div>
                <div className="funnel-bar-track">
                  <span
                    style={{
                      width: Math.max(1, step.conversion) + "%",
                      background: CHART_COLORS[index % 5],
                    }}
                  />
                </div>
                {index > 0 ? (
                  <span className="funnel-drop">
                    <ArrowDown size={12} />
                    {number(step.dropoff)} users dropped off
                  </span>
                ) : (
                  <span className="funnel-drop">Your starting audience</span>
                )}
              </button>
            ))}
          </div>
        ) : null}
      </section>
      <div className="bottom-tip">
        <Info size={16} />
        Save a step audience as a segment, then engage those customers with a
        campaign.
      </div>
      {selected !== null && result.data ? (
        <Modal
          wide
          title={result.data.data[selected].name + " audience"}
          description={
            number(result.data.data[selected].users) +
            " users reached this step."
          }
          onClose={() => setSelected(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setSelected(null)}>
                Close
              </Button>
              <Button onClick={save} loading={saving}>
                <Save size={15} />
                Save as segment
              </Button>
            </>
          }
        >
          <Field label="Segment name">
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
          </Field>
          {selected < applied.steps.length - 1 ? (
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={dropoff}
                onChange={(e) => setDropoff(e.target.checked)}
              />
              Only users who did not reach the next step
            </label>
          ) : null}
          <SectionHeading title="Sample users who reached this step" />
          {sample.data ? (
            <PersonSample people={sample.data.data} />
          ) : selectedIds.length ? (
            <Loading />
          ) : (
            <p className="muted">No users in this step.</p>
          )}
          {error ? <div className="inline-error">{error}</div> : null}
        </Modal>
      ) : null}
    </>
  );
}
