"use client";
import {
  Badge,
  DataTable,
  ErrorState,
  Loading,
  Modal,
  PageHeader,
  SearchInput,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { endpoint, number, shortDate, useRequest } from "@/lib/client";
import { ArrowUpRight, Hash } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
type SchemaEvent = {
  id: string;
  name: string;
  type: string;
  status: string;
  count: number;
  properties: string[];
  lastSeen: string;
};
export function Schema() {
  const { projectId } = useWorkspace(),
    [tab, setTab] = useState("Events"),
    [search, setSearch] = useState(""),
    [selected, setSelected] = useState<SchemaEvent | null>(null);
  const request = useRequest<{
    data: {
      events: SchemaEvent[];
      properties: { name: string; type: string }[];
    };
  }>(endpoint("schema", projectId));
  return (
    <>
      <PageHeader
        eyebrow="A SHARED LANGUAGE FOR YOUR DATA"
        title="Data management"
        description="Understand the events and properties that power your workspace."
        actions={
          <a
            className="btn secondary"
            href="https://docs.clevertap.com/docs/schema"
            target="_blank"
            rel="noreferrer"
          >
            Schema guide
            <ArrowUpRight size={15} />
          </a>
        }
      />
      <section className="panel">
        <div className="tabs">
          {["Events", "User properties"].map((item) => (
            <button
              key={item}
              className={tab === item ? "active" : ""}
              onClick={() => setTab(item)}
            >
              {item}
              <span>
                {item === "Events"
                  ? request.data?.data.events.length || 0
                  : request.data?.data.properties.length || 0}
              </span>
            </button>
          ))}
        </div>
        <div className="table-toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={
              tab === "Events" ? "Search events..." : "Search properties..."
            }
          />
          <span className="muted small">Updated from your event data</span>
        </div>
        {request.error ? (
          <ErrorState message={request.error} retry={request.reload} />
        ) : !request.data ? (
          <Loading />
        ) : tab === "Events" ? (
          <DataTable
            rows={request.data.data.events.filter((item) =>
              item.name.toLowerCase().includes(search.toLowerCase()),
            )}
            columns={[
              {
                key: "name",
                label: "Event name",
                render: (event) => (
                  <button
                    className="schema-name"
                    onClick={() => setSelected(event)}
                  >
                    <span className="schema-icon">
                      <Hash size={16} />
                    </span>
                    {event.name}
                  </button>
                ),
              },
              {
                key: "type",
                label: "Type",
                render: (event) => (
                  <span className="type-tag">{event.type}</span>
                ),
              },
              {
                key: "status",
                label: "Status",
                render: (event) => <Badge status={event.status} />,
              },
              {
                key: "count",
                label: "Total events",
                render: (event) => (
                  <strong className="numeric">{number(event.count)}</strong>
                ),
              },
              {
                key: "properties",
                label: "Properties",
                render: (event) => (
                  <span>{event.properties.length} properties</span>
                ),
              },
              {
                key: "last",
                label: "Last received",
                render: (event) => <span>{shortDate(event.lastSeen)}</span>,
              },
              {
                key: "analyze",
                label: "",
                render: (event) => (
                  <Link
                    className="text-link"
                    href={"/analytics/events/" + encodeURIComponent(event.name)}
                  >
                    Analyze
                    <ArrowUpRight size={13} />
                  </Link>
                ),
              },
            ]}
          />
        ) : (
          <DataTable
            rows={request.data.data.properties
              .filter((item) =>
                item.name.toLowerCase().includes(search.toLowerCase()),
              )
              .map((item) => ({ ...item, id: item.name }))}
            columns={[
              {
                key: "name",
                label: "Property name",
                render: (item) => (
                  <span className="schema-name">
                    <Hash size={15} />
                    {item.name}
                  </span>
                ),
              },
              {
                key: "type",
                label: "Data type",
                render: (item) => <span className="type-tag">{item.type}</span>,
              },
              {
                key: "source",
                label: "Source",
                render: () => <span className="muted">Customer profile</span>,
              },
            ]}
          />
        )}
      </section>
      {selected ? (
        <Modal
          title={selected.name}
          description="Event schema and available properties."
          onClose={() => setSelected(null)}
        >
          <div className="detail-meta">
            <Badge status={selected.status} />
            <span>{number(selected.count)} events received</span>
          </div>
          <div className="schema-property-chips">
            {selected.properties.map((property) => (
              <span className="tag" key={property}>
                <Hash size={13} />
                {property}
              </span>
            ))}
          </div>
          <Link
            className="btn primary"
            onClick={() => setSelected(null)}
            href={"/analytics/events/" + encodeURIComponent(selected.name)}
          >
            Analyze this event
            <ArrowUpRight size={15} />
          </Link>
        </Modal>
      ) : null}
    </>
  );
}
