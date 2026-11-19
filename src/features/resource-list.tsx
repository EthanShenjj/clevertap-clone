"use client";
import { clickRate } from "@/lib/domain";
import { useTableState } from "@/components/table-state";
import {
  Badge,
  Button,
  ChannelIcon,
  DataTable,
  Empty,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  type Column,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { api, endpoint, number, shortDate, useRequest } from "@/lib/client";
import {
  CHANNELS,
  type Campaign,
  type Entity,
  type Journey,
  type ListResponse,
  type Resource,
  type Segment,
} from "@/lib/types";
import {
  ArrowUpRight,
  Copy,
  Download,
  Info,
  Layers,
  Megaphone,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type ListResource = "campaigns" | "segments" | "journeys";
const config = {
  campaigns: {
    title: "Campaigns",
    singular: "campaign",
    description: "The right message. The right moment. Every time.",
    icon: Megaphone,
    tabs: ["All", "Running", "Draft", "Scheduled", "Paused", "Completed"],
  },
  segments: {
    title: "Segments",
    singular: "segment",
    description: "Know your audience. Make every connection count.",
    icon: Layers,
    tabs: ["All", "Active"],
  },
  journeys: {
    title: "Journeys",
    singular: "journey",
    description: "Turn individual moments into meaningful customer journeys.",
    icon: Workflow,
    tabs: ["All", "Running", "Draft", "Paused"],
  },
};
export function ResourceActions({
  resource,
  item,
  onChange,
  onDelete,
}: {
  resource: Resource;
  item: Entity;
  onChange: () => void;
  onDelete: () => void;
}) {
  const { projectId, toast } = useWorkspace(),
    router = useRouter(),
    [busy, setBusy] = useState(false);
  const perform = async (action: string, body?: unknown) => {
    setBusy(true);
    try {
      const result = await api<{ data: Entity }>(
        endpoint(resource + "/" + item.id + "/" + action, projectId),
        { method: "POST", body },
      );
      toast(
        action === "duplicate" ? "A copy has been created." : "Status updated.",
      );
      if (action === "duplicate")
        router.push(
          "/" +
            resource +
            "/" +
            result.data.id +
            (resource === "boards" || resource === "templates" ? "" : "/edit"),
        );
      onChange();
    } catch (error) {
      toast((error as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="row-menu">
      <summary aria-label={"Actions for " + item.name}>
        <MoreHorizontal size={19} />
      </summary>
      <div className="row-menu-content">
        <Link
          href={
            "/" +
            resource +
            "/" +
            item.id +
            (resource === "templates" || resource === "boards" ? "" : "/edit")
          }
        >
          <Pencil size={14} />
          Edit
        </Link>
        <button disabled={busy} onClick={() => perform("duplicate")}>
          <Copy size={14} />
          Duplicate
        </button>
        {["Running", "Scheduled"].includes(item.status) ? (
          <button
            disabled={busy}
            onClick={() => perform("status", { status: "Paused" })}
          >
            <Pause size={14} />
            Pause
          </button>
        ) : item.status === "Paused" ? (
          <button
            disabled={busy}
            onClick={() => perform("status", { status: "Running" })}
          >
            <Play size={14} />
            Resume
          </button>
        ) : null}
        <button className="text-danger" onClick={onDelete}>
          <Trash2 size={14} />
          Delete
        </button>
      </div>
    </details>
  );
}
export function DeleteDialog({
  resource,
  item,
  onClose,
  onDeleted,
}: {
  resource: Resource;
  item: Entity;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const { projectId, toast } = useWorkspace(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      await api(endpoint(resource + "/" + item.id, projectId), {
        method: "DELETE",
      });
      toast("Deleted " + item.name + ".");
      onDeleted();
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={"Delete " + resource.slice(0, -1) + "?"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button variant="danger" loading={busy} onClick={remove}>
            Delete {resource.slice(0, -1)}
          </Button>
        </>
      }
    >
      <p>
        You are about to delete <strong>{item.name}</strong>. References are
        checked before this item is removed.
      </p>
      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}
    </Modal>
  );
}
export function ResourceList({ resource }: { resource: ListResource }) {
  const { projectId } = useWorkspace(),
    state = useTableState(),
    pageConfig = config[resource];
  const [deleting, setDeleting] = useState<Entity | null>(null);
  const request = useRequest<ListResponse<Entity>>(
    endpoint(resource, projectId, {
      ...state.query,
      page: state.page,
      pageSize: state.pageSize,
      sort: state.sort,
    }),
  );
  const summary = useRequest<{
    data: { total: number; statuses: Record<string, number> };
  }>(endpoint(resource + "/summary", projectId));
  const reload = () => {
    request.reload();
    summary.reload();
  };
  const columns: Column<Entity>[] = [
    {
      key: "name",
      label:
        resource === "segments"
          ? "Segment name"
          : resource === "journeys"
            ? "Journey name"
            : "Campaign name",
      sort: "name",
      width: "31%",
      render: (item) => (
        <div className="name-cell">
          <span className={"entity-icon " + resource}>
            <pageConfig.icon size={17} />
          </span>
          <div>
            <Link className="table-name" href={"/" + resource + "/" + item.id}>
              {item.name}
            </Link>
            <div className="cell-secondary">
              {item.tags.length
                ? item.tags.map((tag) => (
                    <span key={tag} className="mini-tag">
                      {tag}
                    </span>
                  ))
                : "Created by " + item.createdBy}
            </div>
          </div>
        </div>
      ),
    },
    ...(resource === "campaigns"
      ? [
          {
            key: "channel",
            label: "Channel",
            sort: "channel",
            render: (item: Entity) => (
              <span className="inline-channel">
                <ChannelIcon channel={(item as Campaign).channel} />
                {(item as Campaign).channel}
              </span>
            ),
          },
          {
            key: "audience",
            label: "Delivery",
            render: () => <span className="muted">One-time</span>,
          },
        ]
      : resource === "segments"
        ? [
            {
              key: "type",
              label: "Type",
              render: (item: Entity) => (
                <span className="type-tag">{(item as Segment).type}</span>
              ),
            },
            {
              key: "users",
              label: "Users",
              sort: "userCount",
              render: (item: Entity) => (
                <strong className="numeric">
                  {number((item as Segment).userCount)}
                </strong>
              ),
            },
          ]
        : [
            {
              key: "nodes",
              label: "Touchpoints",
              render: (item: Entity) => (
                <span className="channel-stack">
                  {(item as Journey).nodes
                    .filter((n) => n.data.kind === "message")
                    .map((n) => (
                      <span key={n.id} title={n.data.channel}>
                        <ChannelIcon
                          channel={n.data.channel || "Push"}
                          boxed
                          size={14}
                        />
                      </span>
                    ))}
                </span>
              ),
            },
            {
              key: "entered",
              label: "Users entered",
              render: (item: Entity) => (
                <strong className="numeric">
                  {number((item as Journey).stats.entered)}
                </strong>
              ),
            },
          ]),
    {
      key: "status",
      label: "Status",
      sort: "status",
      render: (item) => <Badge status={item.status} />,
    },
    ...(resource === "campaigns"
      ? [
          {
            key: "engagement",
            label: "Engagement",
            render: (item: Entity) => {
              const c = item as Campaign;
              return c.stats.sent ? (
                <div>
                  <strong className="numeric">
                    {clickRate(c.channel, c.stats).toFixed(1)}%
                  </strong>
                  <small className="block muted">click rate</small>
                </div>
              ) : (
                <span className="muted">—</span>
              );
            },
          },
        ]
      : []),
    {
      key: "updated",
      label: "Last updated",
      sort: "updatedAt",
      render: (item) => (
        <div>
          <span>{shortDate(item.updatedAt)}</span>
          <small className="block cell-secondary">{item.createdBy}</small>
        </div>
      ),
    },
    {
      key: "actions",
      label: "",
      width: "50px",
      render: (item) => (
        <ResourceActions
          resource={resource}
          item={item}
          onChange={reload}
          onDelete={() => setDeleting(item)}
        />
      ),
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow={
          resource === "segments"
            ? "UNDERSTAND YOUR CUSTOMERS"
            : "CUSTOMER ENGAGEMENT"
        }
        title={pageConfig.title}
        description={pageConfig.description}
        actions={
          <>
            <a
              className="btn secondary"
              href={endpoint("exports/" + resource, projectId, state.query)}
            >
              <Download size={16} />
              Export
            </a>
            <Link className="btn primary" href={"/" + resource + "/new"}>
              <Plus size={17} />
              Create {pageConfig.singular}
            </Link>
          </>
        }
      />
      <div className="list-summary">
        <div>
          <span className="summary-icon blue">
            <pageConfig.icon size={19} />
          </span>
          <span>
            Total {resource}
            <strong>{summary.data?.data.total ?? "—"}</strong>
          </span>
        </div>
        <div>
          <span className="summary-icon green">
            <Play size={18} />
          </span>
          <span>
            {resource === "segments" ? "Active segments" : "Currently running"}
            <strong>
              {summary.data?.data.statuses[
                resource === "segments" ? "Active" : "Running"
              ] ?? 0}
              <small>Ready to make an impact</small>
            </strong>
          </span>
        </div>
        <div>
          <span className="summary-icon purple">
            {resource === "segments" ? (
              <Users size={19} />
            ) : (
              <Pencil size={18} />
            )}
          </span>
          <span>
            {resource === "segments"
              ? "Built for every moment"
              : "Work in progress"}
            <strong>
              {resource === "segments"
                ? "Dynamic audiences"
                : (summary.data?.data.statuses.Draft ?? 0)}
              <small>
                {resource === "segments"
                  ? "Based on real customer behavior"
                  : "Saved drafts"}
              </small>
            </strong>
          </span>
        </div>
      </div>
      <section className="panel resource-panel">
        <div className="tabs">
          {pageConfig.tabs.map((tab) => (
            <button
              key={tab}
              className={state.status === tab ? "active" : ""}
              onClick={() => state.update({ status: tab })}
            >
              {tab === "All"
                ? "All " + resource
                : tab === "Draft"
                  ? "Drafts"
                  : tab}
              <span>
                {tab === "All"
                  ? (summary.data?.data.total ?? 0)
                  : (summary.data?.data.statuses[tab] ?? 0)}
              </span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <SearchInput
            value={state.search}
            onChange={(search) => state.update({ search })}
            placeholder={"Search " + resource + "..."}
          />
          <div className="toolbar-right">
            {resource === "campaigns" ? (
              <select
                aria-label="Filter by channel"
                value={state.channel}
                onChange={(event) =>
                  state.update({ channel: event.target.value })
                }
              >
                <option value="All">All channels</option>
                {CHANNELS.map((channel) => (
                  <option key={channel}>{channel}</option>
                ))}
              </select>
            ) : null}
            <span className="result-count">
              {request.data?.meta.total ?? 0} {resource}
            </span>
          </div>
        </div>
        {request.error ? (
          <ErrorState message={request.error} retry={request.reload} />
        ) : request.loading ? (
          <Loading />
        ) : request.data?.data.length ? (
          <>
            <DataTable
              columns={columns}
              rows={request.data.data}
              sort={state.sort}
              onSort={state.onSort}
            />
            <Pagination
              meta={request.data.meta}
              onPage={(page) => state.update({ page })}
              onSize={(pageSize) => state.update({ pageSize })}
            />
          </>
        ) : (
          <Empty
            title={"No " + resource + " found"}
            action={
              <Button
                variant="secondary"
                onClick={() =>
                  state.update({ search: "", status: "All", channel: "All" })
                }
              >
                Clear filters
              </Button>
            }
          />
        )}
      </section>
      <div className="bottom-tip">
        <Info size={16} />
        <span>
          {resource === "segments"
            ? "Segments update as your customers take action. Use them across campaigns and journeys."
            : "A thoughtful message can turn a moment into a lasting connection."}
        </span>
        <a
          href={
            "https://docs.clevertap.com/docs/" +
            (resource === "campaigns" ? "intro-to-campaigns" : resource)
          }
          target="_blank"
          rel="noreferrer"
        >
          Learn more
          <ArrowUpRight size={13} />
        </a>
      </div>
      {deleting ? (
        <DeleteDialog
          resource={resource}
          item={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={reload}
        />
      ) : null}
    </>
  );
}
