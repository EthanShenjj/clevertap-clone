"use client";
import { MessageEditor } from "@/components/message-editor";
import { EVENT_NAMES } from "@/components/query-builder";
import {
  Badge,
  Button,
  ChannelIcon,
  DataTable,
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
import { api, endpoint, number, shortDate, useRequest } from "@/lib/client";
import { validateJourney } from "@/lib/domain";
import {
  EMPTY_CONTENT,
  type ChannelType,
  type Journey,
  type JourneyEdge,
  type JourneyNode,
  type ListResponse,
  type RunRecord,
  type Segment,
} from "@/lib/types";
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
} from "@xyflow/react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Flag,
  GitBranch,
  Maximize2,
  Pause,
  Pencil,
  Play,
  Plus,
  Redo2,
  Rocket,
  Save,
  Settings2,
  ShieldCheck,
  Trash2,
  Undo2,
  Users,
  Workflow,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";

type FlowNode = Node<JourneyNode["data"], "journey">;
const nodeColors: Record<string, string> = {
  entry: "#497bed",
  message: "#9272df",
  delay: "#e7ad4a",
  condition: "#3cb299",
  exit: "#8390a7",
};
function JourneyNodeView({ data, selected }: NodeProps<FlowNode>) {
  const label =
    data.kind === "entry"
      ? "ENTRY SEGMENT"
      : data.kind === "message"
        ? data.channel?.toUpperCase()
        : data.kind === "delay"
          ? "WAIT"
          : data.kind === "condition"
            ? "CONDITION"
            : "EXIT";
  return (
    <div
      className={"journey-node " + data.kind + (selected ? " selected" : "")}
      style={{ "--node-color": nodeColors[data.kind] } as React.CSSProperties}
    >
      {data.kind !== "entry" ? (
        <Handle type="target" position={Position.Top} />
      ) : null}
      <div className="journey-node-top">
        <span className="journey-node-icon">
          {data.kind === "entry" ? (
            <Users size={17} />
          ) : data.kind === "message" ? (
            <ChannelIcon channel={data.channel || "Push"} size={17} />
          ) : data.kind === "delay" ? (
            <Clock3 size={17} />
          ) : data.kind === "condition" ? (
            <GitBranch size={17} />
          ) : (
            <Flag size={17} />
          )}
        </span>
        <span>{label}</span>
        <Settings2 size={12} />
      </div>
      <strong>{data.label}</strong>
      <p>
        {data.kind === "entry"
          ? "Users who match your audience"
          : data.kind === "message"
            ? data.content?.title ||
              data.content?.subject ||
              "Personalized message"
            : data.kind === "delay"
              ? "Wait for " + (data.hours || 0) + " hours"
              : data.kind === "condition"
                ? data.event || "Check customer behavior"
                : "A meaningful journey, complete."}
      </p>
      {typeof data.count === "number" ? (
        <div className="journey-node-count">{number(data.count)} users</div>
      ) : null}
      {data.kind === "condition" ? (
        <>
          <span className="node-port-label yes">Yes</span>
          <span className="node-port-label no">No</span>
          <Handle
            type="source"
            position={Position.Bottom}
            id="yes"
            style={{ left: "27%" }}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            id="no"
            style={{ left: "73%" }}
          />
        </>
      ) : data.kind !== "exit" ? (
        <Handle type="source" position={Position.Bottom} />
      ) : null}
    </div>
  );
}
const nodeTypes = { journey: JourneyNodeView };
const normalizeEdges = (edges: JourneyEdge[], nodes: JourneyNode[]): Edge[] =>
  edges.map((edge) => ({
    ...edge,
    type: "smoothstep",
    sourceHandle:
      nodes.find((node) => node.id === edge.source)?.data.kind === "condition"
        ? edge.label?.toLowerCase() === "yes"
          ? "yes"
          : "no"
        : edge.sourceHandle,
    markerEnd: { type: MarkerType.ArrowClosed, width: 13, height: 13 },
    style: { stroke: "#a5aec1", strokeWidth: 1.5 },
    labelStyle: { fontSize: 10, fill: "#78839a" },
    labelBgStyle: { fill: "#fafbfe" },
  }));
export function JourneyEditorPage({ id }: { id?: string }) {
  const { projectId } = useWorkspace(),
    request = useRequest<{ data: Journey }>(
      id ? endpoint("journeys/" + id, projectId) : null,
    );
  if (id && request.error)
    return <ErrorState message={request.error} retry={request.reload} />;
  if (id && !request.data) return <Loading />;
  return <JourneyEditor key={id || projectId} initial={request.data?.data} />;
}
function JourneyEditor({ initial }: { initial?: Journey }) {
  const { projectId, toast } = useWorkspace(),
    router = useRouter();
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>(
    (initial?.nodes || []).map((node) => ({ ...node, type: "journey" })),
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    normalizeEdges(initial?.edges || [], initial?.nodes || []),
  );
  const [name, setName] = useState(initial?.name || "Untitled journey"),
    [goal, setGoal] = useState(initial?.goal || "Charged"),
    [timeoutHours, setTimeout] = useState(initial?.timeoutHours || 168),
    [draftId, setDraftId] = useState(initial?.id || "");
  const [selectedId, setSelected] = useState<string | null>(null),
    [selectedEdgeId, setSelectedEdge] = useState<string | null>(null),
    [setup, setSetup] = useState(!initial),
    [busy, setBusy] = useState(false),
    [errors, setErrors] = useState<string[]>([]),
    [checked, setChecked] = useState(false),
    [version, setVersion] = useState(initial?.version || 1);
  const [history, setHistory] = useState<
      { nodes: FlowNode[]; edges: Edge[] }[]
    >([]),
    [future, setFuture] = useState<{ nodes: FlowNode[]; edges: Edge[] }[]>([]);
  const flow = useRef<ReactFlowInstance<FlowNode, Edge> | null>(null),
    wrapper = useRef<HTMLDivElement>(null);
  const segments = useRequest<ListResponse<Segment>>(
    endpoint("segments", projectId, { pageSize: 100 }),
  );
  const selected = nodes.find((node) => node.id === selectedId),
    selectedEdge = edges.find((edge) => edge.id === selectedEdgeId);
  const checkpoint = () => {
    setHistory((previous) => [
      ...previous.slice(-29),
      { nodes: structuredClone(nodes), edges: structuredClone(edges) },
    ]);
    setFuture([]);
    setChecked(false);
  };
  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setFuture((next) => [...next, { nodes, edges }]);
    setNodes(previous.nodes);
    setEdges(previous.edges);
    setHistory(history.slice(0, -1));
  };
  const redo = () => {
    const next = future.at(-1);
    if (!next) return;
    setHistory((previous) => [...previous, { nodes, edges }]);
    setNodes(next.nodes);
    setEdges(next.edges);
    setFuture(future.slice(0, -1));
  };
  const addNode = (
    kind: string,
    channel?: ChannelType,
    position?: { x: number; y: number },
  ) => {
    checkpoint();
    const data: JourneyNode["data"] = {
      label:
        kind === "entry"
          ? "Enter audience"
          : kind === "message"
            ? "Send " + channel
            : kind === "delay"
              ? "Take a little pause"
              : kind === "condition"
                ? "Completed a purchase?"
                : "Journey complete",
      kind,
      ...(channel
        ? {
            channel,
            content: {
              ...EMPTY_CONTENT,
              title: "A little something for you",
              body: "Hi {{first_name}}, discover something you'll love.",
            },
          }
        : {}),
      ...(kind === "entry"
        ? { segmentId: segments.data?.data[0]?.id || "", event: "Signed Up" }
        : {}),
      ...(kind === "condition" ? { event: "Charged" } : {}),
      ...(kind === "delay" ? { hours: 24 } : {}),
    };
    const node: FlowNode = {
      id: "node-" + crypto.randomUUID().slice(0, 8),
      type: "journey",
      position: position || {
        x: 160 + (nodes.length % 2) * 260,
        y: 60 + nodes.length * 170,
      },
      data,
    };
    setNodes((previous) => [...previous, node]);
    setSelected(node.id);
  };
  const onConnect = (connection: Connection) => {
    checkpoint();
    const source = nodes.find((node) => node.id === connection.source);
    setEdges((previous) =>
      addEdge(
        {
          ...connection,
          id: "edge-" + crypto.randomUUID(),
          label:
            connection.sourceHandle === "yes"
              ? "Yes"
              : connection.sourceHandle === "no"
                ? "No"
                : source?.data.kind === "message"
                  ? "Sent"
                  : "Continue",
          type: "smoothstep",
          markerEnd: { type: MarkerType.ArrowClosed },
          data: { hours: 0 },
        },
        previous,
      ),
    );
  };
  const changeNode = (patch: Partial<JourneyNode["data"]>) => {
    setNodes((previous) =>
      previous.map((node) =>
        node.id === selectedId
          ? { ...node, data: { ...node.data, ...patch } }
          : node,
      ),
    );
    setChecked(false);
  };
  const save = async (shouldPublish: boolean) => {
    setBusy(true);
    setErrors([]);
    try {
      const cleanNodes = nodes.map(({ id, type, position, data }) => ({
        id,
        type,
        position,
        data,
      }));
      const cleanEdges = edges.map(
        ({ id, source, target, label, sourceHandle, targetHandle, data }) => ({
          id,
          source,
          target,
          label: String(label || ""),
          sourceHandle,
          targetHandle,
          data,
        }),
      );
      const response = await api<{ data: Journey }>(
        endpoint("journeys" + (draftId ? "/" + draftId : ""), projectId),
        {
          method: draftId ? "PATCH" : "POST",
          body: {
            name,
            nodes: cleanNodes,
            edges: cleanEdges,
            goal,
            timeoutHours,
          },
        },
      );
      setDraftId(response.data.id);
      setVersion(response.data.version);
      if (shouldPublish) {
        await api(
          endpoint("journeys/" + response.data.id + "/publish", projectId),
          { method: "POST" },
        );
        toast("Journey published in demo mode.");
        router.push("/journeys/" + response.data.id);
      } else {
        toast("Journey draft saved.");
        if (!initial) router.replace("/journeys/" + response.data.id + "/edit");
      }
    } catch (error) {
      setErrors([(error as Error).message]);
    } finally {
      setBusy(false);
    }
  };
  const validate = () => {
    const result = validateJourney(
      nodes as JourneyNode[],
      edges.map((e) => ({
        ...e,
        label: String(e.label || ""),
      })) as JourneyEdge[],
    );
    setErrors(result);
    setChecked(!result.length);
    if (!result.length)
      toast("All paths look good. Your journey is ready to publish.");
  };
  const drop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const payload = event.dataTransfer.getData("application/clevertap-node");
    if (!payload) return;
    const [kind, channel] = payload.split("|");
    addNode(
      kind,
      channel ? (channel as ChannelType) : undefined,
      flow.current?.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      }),
    );
  };
  const palette = [
    {
      title: "AUDIENCE",
      items: [
        { kind: "entry", label: "Entry segment", icon: Users },
        { kind: "condition", label: "Behavior condition", icon: GitBranch },
      ],
    },
    {
      title: "ENGAGEMENT",
      items: ["Push", "Email", "In-App", "Web Pop-up"].map((channel) => ({
        kind: "message",
        label: channel,
        channel: channel as ChannelType,
        icon: Users,
      })),
    },
    {
      title: "CONTROLLERS",
      items: [
        { kind: "delay", label: "Wait", icon: Clock3 },
        { kind: "exit", label: "Force exit", icon: Flag },
      ],
    },
  ];
  return (
    <div className="journey-editor-page">
      <div className="journey-editor-header">
        <div>
          <Link
            aria-label="Back to journeys"
            className="icon-button"
            href="/journeys"
          >
            <ArrowLeft size={19} />
          </Link>
          <div>
            <h1>{name}</h1>
            <span>
              Journey builder · Version {version}
              {initial?.status === "Running"
                ? " · Edits create a new draft version"
                : ""}
            </span>
          </div>
        </div>
        <div>
          <Button variant="secondary" onClick={() => setSetup(true)}>
            <Settings2 size={15} />
            Setup & goals
          </Button>
          <Button variant="secondary" onClick={validate}>
            <ShieldCheck size={15} />
            Validate
          </Button>
          <Button
            variant="secondary"
            onClick={() => save(false)}
            loading={busy}
          >
            <Save size={15} />
            Save draft
          </Button>
          <Button onClick={() => save(true)} loading={busy}>
            <Rocket size={15} />
            Publish
          </Button>
        </div>
      </div>
      {errors.length ? (
        <div className="canvas-errors" role="alert">
          <strong>A few things need your attention</strong>
          <ul>
            {errors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
          <IconButton
            label="Dismiss validation messages"
            onClick={() => setErrors([])}
          >
            <X size={15} />
          </IconButton>
        </div>
      ) : null}
      <div className="journey-workspace">
        <aside className="journey-palette">
          <div className="palette-heading">
            <Workflow size={19} />
            <strong>Build your journey</strong>
            <p>Drag a node or click to add.</p>
          </div>
          {palette.map((group) => (
            <div className="palette-group" key={group.title}>
              <h3>{group.title}</h3>
              {group.items.map((item) => (
                <button
                  key={item.label}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData(
                      "application/clevertap-node",
                      item.kind + ("channel" in item ? "|" + item.channel : ""),
                    )
                  }
                  onClick={() =>
                    addNode(
                      item.kind,
                      "channel" in item ? item.channel : undefined,
                    )
                  }
                >
                  <span
                    style={{
                      color: nodeColors[item.kind],
                      background: nodeColors[item.kind] + "12",
                    }}
                  >
                    {"channel" in item ? (
                      <ChannelIcon channel={item.channel} size={18} />
                    ) : (
                      <item.icon size={18} />
                    )}
                  </span>
                  {item.label}
                  <Plus size={13} />
                </button>
              ))}
            </div>
          ))}
          <div className="palette-help">
            <CheckCircle2 size={17} />
            <p>Connect your audience to the moments that matter.</p>
          </div>
        </aside>
        <div
          className="journey-canvas"
          ref={wrapper}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
          }}
          onDrop={drop}
        >
          <div className="canvas-topbar">
            <span className={checked ? "text-success" : ""}>
              {checked ? (
                <CheckCircle2 size={14} />
              ) : (
                <span className="live-dot" />
              )}
              {checked
                ? "All paths validated"
                : nodes.length + " nodes · " + edges.length + " connections"}
            </span>
            <div>
              <IconButton
                label="Undo"
                disabled={!history.length}
                onClick={undo}
              >
                <Undo2 size={16} />
              </IconButton>
              <IconButton label="Redo" disabled={!future.length} onClick={redo}>
                <Redo2 size={16} />
              </IconButton>
              <span />
              <Button
                variant="ghost"
                onClick={() => {
                  checkpoint();
                  const rows = new Map<string, number>();
                  setNodes((previous) =>
                    previous.map((node, index) => {
                      const rank = index;
                      rows.set(node.id, rank);
                      return {
                        ...node,
                        position: {
                          x: 210 + (node.data.kind === "exit" ? -180 : 0),
                          y: 50 + rank * 165,
                        },
                      };
                    }),
                  );
                  window.setTimeout(
                    () =>
                      flow.current?.fitView({ padding: 0.2, duration: 200 }),
                    50,
                  );
                }}
              >
                Align nodes
              </Button>
              <IconButton
                label="Fit journey to view"
                onClick={() =>
                  flow.current?.fitView({ padding: 0.2, duration: 200 })
                }
              >
                <Maximize2 size={16} />
              </IconButton>
            </div>
          </div>
          <ReactFlow<FlowNode, Edge>
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            onInit={(instance) => {
              flow.current = instance;
            }}
            onNodeClick={(_, node) => {
              checkpoint();
              setSelected(node.id);
              setSelectedEdge(null);
            }}
            onEdgeClick={(_, edge) => {
              checkpoint();
              setSelectedEdge(edge.id);
              setSelected(null);
            }}
            onNodeDragStart={checkpoint}
            onPaneClick={() => {
              setSelected(null);
              setSelectedEdge(null);
            }}
            defaultViewport={{ x: 80, y: 80, zoom: 0.9 }}
            minZoom={0.25}
            maxZoom={1.5}
            deleteKeyCode={null}
            defaultEdgeOptions={{ type: "smoothstep" }}
          >
            <Background color="#dbe0ec" gap={20} size={1} />
            <Controls showInteractive={false} />
            <MiniMap
              nodeColor={(node) => nodeColors[String(node.data.kind)]}
              pannable
              zoomable
            />
          </ReactFlow>
          {!nodes.length ? (
            <div className="canvas-empty">
              <span>
                <Workflow size={35} />
              </span>
              <h2>Every journey starts with a connection</h2>
              <p>Add an entry segment, then build the experience from there.</p>
              <Button onClick={() => addNode("entry")}>
                <Plus size={15} />
                Add entry segment
              </Button>
            </div>
          ) : null}
        </div>
      </div>
      {setup ? (
        <Modal
          title="Set up your journey"
          description="A clear purpose makes every connection better."
          onClose={() => setSetup(false)}
          footer={
            <Button onClick={() => setSetup(false)}>
              Done
              <ArrowLeft size={14} className="rotate-180" />
            </Button>
          }
        >
          <Field label="Journey name">
            <input
              autoFocus
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>
          <Field label="Conversion goal">
            <select
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
            >
              {EVENT_NAMES.map((event) => (
                <option key={event}>{event}</option>
              ))}
            </select>
          </Field>
          <Field
            label="Journey timeout (hours)"
            hint="Users exit when the configured journey time is exceeded."
          >
            <input
              type="number"
              min={1}
              max={8760}
              value={timeoutHours}
              onChange={(event) => setTimeout(Number(event.target.value))}
            />
          </Field>
        </Modal>
      ) : null}
      {selected ? (
        <Modal
          drawer
          wide={selected.data.kind === "message"}
          title={
            selected.data.kind === "message"
              ? "Design your " + selected.data.channel + " message"
              : "Configure " + selected.data.kind
          }
          onClose={() => setSelected(null)}
          footer={
            <>
              <IconButton
                label="Duplicate selected node"
                onClick={() => {
                  checkpoint();
                  const copy = {
                    ...structuredClone(selected),
                    id: "node-" + crypto.randomUUID().slice(0, 8),
                    position: {
                      x: selected.position.x + 270,
                      y: selected.position.y + 30,
                    },
                    data: {
                      ...structuredClone(selected.data),
                      label: selected.data.label + " (copy)",
                    },
                  };
                  setNodes((previous) => [...previous, copy]);
                  setSelected(copy.id);
                }}
              >
                <Copy size={16} />
              </IconButton>
              <Button
                variant="danger"
                onClick={() => {
                  checkpoint();
                  setNodes((previous) =>
                    previous.filter((node) => node.id !== selected.id),
                  );
                  setEdges((previous) =>
                    previous.filter(
                      (edge) =>
                        edge.source !== selected.id &&
                        edge.target !== selected.id,
                    ),
                  );
                  setSelected(null);
                }}
              >
                <Trash2 size={15} />
                Delete node
              </Button>
              <Button onClick={() => setSelected(null)}>Save & close</Button>
            </>
          }
        >
          <Field label="Node name">
            <input
              value={selected.data.label}
              onChange={(event) => changeNode({ label: event.target.value })}
            />
          </Field>
          {selected.data.kind === "entry" ? (
            <>
              <Field label="Target audience">
                <select
                  value={selected.data.segmentId || ""}
                  onChange={(event) =>
                    changeNode({ segmentId: event.target.value })
                  }
                >
                  <option value="">Choose a segment</option>
                  {segments.data?.data.map((segment) => (
                    <option key={segment.id} value={segment.id}>
                      {segment.name} ({number(segment.userCount)})
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Entry event">
                <select
                  value={selected.data.event || "Signed Up"}
                  onChange={(event) =>
                    changeNode({ event: event.target.value })
                  }
                >
                  {EVENT_NAMES.map((event) => (
                    <option key={event}>{event}</option>
                  ))}
                </select>
              </Field>
              <p className="muted small">
                The simulator evaluates your saved audience and follows this
                journey from its entry node.
              </p>
            </>
          ) : null}
          {selected.data.kind === "condition" ? (
            <>
              <Field label="Has performed this event">
                <select
                  value={selected.data.event || "Charged"}
                  onChange={(event) =>
                    changeNode({ event: event.target.value })
                  }
                >
                  {EVENT_NAMES.map((event) => (
                    <option key={event}>{event}</option>
                  ))}
                </select>
              </Field>
              <p className="muted small">
                Connect both the Yes and No handles to define each path.
              </p>
            </>
          ) : null}
          {selected.data.kind === "delay" ? (
            <Field label="Wait for (hours)">
              <input
                type="number"
                min={0}
                max={8760}
                value={selected.data.hours || 0}
                onChange={(event) =>
                  changeNode({ hours: Number(event.target.value) })
                }
              />
            </Field>
          ) : null}
          {selected.data.kind === "message" ? (
            <MessageEditor
              channel={selected.data.channel || "Push"}
              content={selected.data.content || EMPTY_CONTENT}
              onChange={(content) => changeNode({ content })}
            />
          ) : null}
          {selected.data.kind === "exit" ? (
            <div className="aside-note">
              <Flag size={20} />
              <p>Customers leave the journey when they reach this node.</p>
            </div>
          ) : null}
        </Modal>
      ) : null}
      {selectedEdge ? (
        <Modal
          title="Configure this path"
          onClose={() => setSelectedEdge(null)}
          footer={
            <>
              <Button
                variant="danger"
                onClick={() => {
                  checkpoint();
                  setEdges((previous) =>
                    previous.filter((edge) => edge.id !== selectedEdge.id),
                  );
                  setSelectedEdge(null);
                }}
              >
                <Trash2 size={15} />
                Remove connection
              </Button>
              <Button onClick={() => setSelectedEdge(null)}>Save path</Button>
            </>
          }
        >
          <Field label="Path action">
            <select
              value={String(selectedEdge.label || "Continue")}
              onChange={(event) =>
                setEdges((previous) =>
                  previous.map((edge) =>
                    edge.id === selectedEdge.id
                      ? { ...edge, label: event.target.value }
                      : edge,
                  ),
                )
              }
            >
              {[
                "Continue",
                "Yes",
                "No",
                "Sent",
                "Viewed",
                "Clicked",
                "Failed",
                "Unreachable",
                "After 24h",
              ].map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </Field>
          <Field label="Sleep time (hours)">
            <input
              type="number"
              min={0}
              max={8760}
              value={Number(selectedEdge.data?.hours || 0)}
              onChange={(event) =>
                setEdges((previous) =>
                  previous.map((edge) =>
                    edge.id === selectedEdge.id
                      ? { ...edge, data: { hours: Number(event.target.value) } }
                      : edge,
                  ),
                )
              }
            />
          </Field>
        </Modal>
      ) : null}
    </div>
  );
}
export function JourneyDetail({ id }: { id: string }) {
  const { projectId, toast } = useWorkspace(),
    [busy, setBusy] = useState(false),
    [tab, setTab] = useState("Overview");
  const request = useRequest<{ data: Journey }>(
      endpoint("journeys/" + id, projectId),
    ),
    runs = useRequest<{ data: RunRecord[] }>(
      endpoint("journeys/" + id + "/runs", projectId),
    );
  const action = async (name: string, body?: unknown) => {
    setBusy(true);
    try {
      await api(endpoint("journeys/" + id + "/" + name, projectId), {
        method: "POST",
        body,
      });
      toast(
        name === "simulate"
          ? "Journey simulation complete. User paths have been saved."
          : "Journey updated.",
      );
      request.reload();
      runs.reload();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  if (request.error)
    return <ErrorState message={request.error} retry={request.reload} />;
  if (!request.data) return <Loading />;
  const journey = request.data.data,
    run = runs.data?.data[0];
  const viewNodes = journey.nodes.map((node) => ({
    ...node,
    type: "journey",
    data: {
      ...node.data,
      count: run?.result.nodes?.find((n) => n.id === node.id)?.entered,
    },
  })) as FlowNode[];
  return (
    <>
      <Link className="back-link" href="/journeys">
        <ArrowLeft size={15} />
        All journeys
      </Link>
      <PageHeader
        eyebrow="CONNECTED MOMENTS"
        title={journey.name}
        description="A thoughtful path, from one meaningful moment to the next."
        actions={
          <>
            <Link className="btn secondary" href={"/journeys/" + id + "/edit"}>
              <Pencil size={15} />
              Edit journey
            </Link>
            {journey.status === "Running" ? (
              <>
                <Button
                  variant="secondary"
                  loading={busy}
                  onClick={() => action("status", { status: "Paused" })}
                >
                  <Pause size={15} />
                  Pause
                </Button>
                <Button loading={busy} onClick={() => action("simulate")}>
                  <Play size={15} />
                  Run simulation
                </Button>
              </>
            ) : (
              <Button
                loading={busy}
                onClick={() =>
                  action(
                    journey.status === "Paused" ? "status" : "publish",
                    journey.status === "Paused"
                      ? { status: "Running" }
                      : undefined,
                  )
                }
              >
                <Rocket size={15} />
                {journey.status === "Paused" ? "Resume" : "Publish"}
              </Button>
            )}
          </>
        }
      />
      <div className="detail-meta">
        <Badge status={journey.status} />
        <span>Version {journey.version}</span>
        <span>Goal: {journey.goal}</span>
        <span>Created {shortDate(journey.createdAt)}</span>
      </div>
      <div className="metric-grid">
        {[
          { label: "Entered journey", value: number(journey.stats.entered) },
          { label: "Goal completed", value: number(journey.stats.converted) },
          {
            label: "Conversion rate",
            value:
              (journey.stats.entered
                ? (journey.stats.converted / journey.stats.entered) * 100
                : 0
              ).toFixed(1) + "%",
          },
          {
            label: "Touchpoints",
            value: String(
              journey.nodes.filter((node) => node.data.kind === "message")
                .length,
            ),
          },
        ].map((item) => (
          <div className="metric-card" key={item.label}>
            <span className="metric-heading">{item.label}</span>
            <strong className="metric-value">{item.value}</strong>
            <span className="muted small">Journey performance</span>
          </div>
        ))}
      </div>
      <div className="tabs standalone-tabs">
        {["Overview", "Run history"].map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Overview" ? (
        <section className="panel journey-detail-canvas">
          <div className="canvas-caption">
            <span>
              {run
                ? "Latest simulation · " +
                  new Date(run.createdAt).toLocaleString()
                : "Your configured customer journey"}
            </span>
            <Link className="text-link" href={"/journeys/" + id + "/edit"}>
              Open canvas
              <Maximize2 size={14} />
            </Link>
          </div>
          <ReactFlow
            nodes={viewNodes}
            edges={normalizeEdges(journey.edges, journey.nodes)}
            nodeTypes={nodeTypes}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <Background color="#dce2ef" gap={20} />
            <Controls showInteractive={false} />
          </ReactFlow>
        </section>
      ) : (
        <section className="panel">
          <SectionHeading
            title="Journey simulations"
            description="Each run retains the original journey version and its user paths."
          />
          {runs.data?.data.length ? (
            <DataTable
              rows={runs.data.data}
              columns={[
                {
                  key: "date",
                  label: "Run",
                  render: (item) => (
                    <div>
                      <strong>
                        {new Date(item.createdAt).toLocaleString()}
                      </strong>
                      <small className="block muted">
                        Run {item.id.slice(0, 8)}
                      </small>
                    </div>
                  ),
                },
                {
                  key: "version",
                  label: "Version",
                  render: (item) => (
                    <span className="type-tag">
                      v{(item.snapshot as Journey).version}
                    </span>
                  ),
                },
                {
                  key: "sent",
                  label: "Reached",
                  render: (item) => number(item.result.stats.sent),
                },
                {
                  key: "converted",
                  label: "Converted",
                  render: (item) => number(item.result.stats.converted),
                },
                {
                  key: "path",
                  label: "Node transitions",
                  render: (item) => number(item.records.length),
                },
              ]}
            />
          ) : (
            <Empty
              title="A journey waiting to unfold"
              description="Run a simulation to see how customers move through each touchpoint."
            />
          )}
        </section>
      )}
      {run?.result.nodes?.length ? (
        <section className="panel">
          <SectionHeading title="A closer look at each moment" />
          <DataTable
            rows={run.result.nodes}
            columns={[
              {
                key: "label",
                label: "Touchpoint",
                render: (node) => <strong>{node.label}</strong>,
              },
              {
                key: "entered",
                label: "Entered",
                render: (node) => number(node.entered),
              },
              {
                key: "exited",
                label: "Moved forward",
                render: (node) => number(node.exited),
              },
            ]}
          />
        </section>
      ) : null}
    </>
  );
}
