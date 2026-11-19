"use client";
import { useTableState } from "@/components/table-state";
import {
  Avatar,
  ChannelIcon,
  DataTable,
  Empty,
  ErrorState,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  SectionHeading,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { endpoint, money, number, shortDate, useRequest } from "@/lib/client";
import type { EventRecord, ListResponse, Person } from "@/lib/types";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  Download,
  MapPin,
  Smartphone,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function People() {
  const { projectId } = useWorkspace(),
    state = useTableState(),
    request = useRequest<ListResponse<Person>>(
      endpoint("people", projectId, {
        ...state.query,
        pageSize: state.pageSize,
        sort: state.query.sort || "lastSeen",
      }),
    );
  return (
    <>
      <PageHeader
        eyebrow="EVERY CUSTOMER HAS A STORY"
        title="Find people"
        description="Get to know the people behind the numbers."
        actions={
          <a
            className="btn secondary"
            href={endpoint("exports/people", projectId, state.query)}
          >
            <Download size={16} />
            Export users
          </a>
        }
      />
      <section className="panel">
        <div className="table-toolbar">
          <SearchInput
            value={state.search}
            onChange={(search) => state.update({ search })}
            placeholder="Search by name or email..."
          />
          <div className="toolbar-right">
            <select
              aria-label="Filter users by platform"
              value={state.query.platform || "All"}
              onChange={(event) =>
                state.update({ platform: event.target.value })
              }
            >
              <option value="All">All platforms</option>
              {["Android", "iOS", "Web"].map((platform) => (
                <option key={platform}>{platform}</option>
              ))}
            </select>
            <span className="result-count">
              {number(request.data?.meta.total || 0)} users
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
              rows={request.data.data}
              sort={state.sort}
              onSort={state.onSort}
              columns={[
                {
                  key: "name",
                  label: "Customer",
                  sort: "name",
                  render: (person) => (
                    <Link className="name-cell" href={"/people/" + person.id}>
                      <Avatar name={person.name} />
                      <div>
                        <strong className="table-name">{person.name}</strong>
                        <small className="cell-secondary block">
                          {person.email}
                        </small>
                      </div>
                    </Link>
                  ),
                },
                {
                  key: "country",
                  label: "Location",
                  render: (person) => (
                    <div>
                      {person.city}
                      <small className="block muted">{person.country}</small>
                    </div>
                  ),
                },
                {
                  key: "platform",
                  label: "Platform",
                  render: (person) => (
                    <span className="inline-channel">
                      <Smartphone size={15} />
                      {person.platform}
                    </span>
                  ),
                },
                {
                  key: "plan",
                  label: "Plan",
                  render: (person) => (
                    <span className={"plan-tag " + person.plan.toLowerCase()}>
                      {person.plan}
                    </span>
                  ),
                },
                {
                  key: "value",
                  label: "Lifetime value",
                  sort: "value",
                  render: (person) => (
                    <strong className="numeric">{money(person.value)}</strong>
                  ),
                },
                {
                  key: "reachability",
                  label: "Reachable on",
                  render: (person) => (
                    <span className="reachability-icons">
                      {["Push", "Email", "SMS"].map((channel) => (
                        <span
                          key={channel}
                          className={
                            person.reachability[channel] ? "" : "not-reachable"
                          }
                          title={
                            channel +
                            (person.reachability[channel]
                              ? " reachable"
                              : " unavailable")
                          }
                        >
                          <ChannelIcon channel={channel} size={16} />
                        </span>
                      ))}
                    </span>
                  ),
                },
                {
                  key: "lastSeen",
                  label: "Last seen",
                  sort: "lastSeen",
                  render: (person) => <span>{shortDate(person.lastSeen)}</span>,
                },
                {
                  key: "view",
                  label: "",
                  render: (person) => (
                    <Link
                      aria-label={"View " + person.name}
                      href={"/people/" + person.id}
                    >
                      <ChevronRight size={17} />
                    </Link>
                  ),
                },
              ]}
            />
            <Pagination
              meta={request.data.meta}
              onPage={(page) => state.update({ page })}
              onSize={(pageSize) => state.update({ pageSize })}
            />
          </>
        ) : (
          <Empty
            title="No customers found"
            description="Try a different name, email or platform."
          />
        )}
      </section>
    </>
  );
}
export function PersonDetail({ id }: { id: string }) {
  const { projectId } = useWorkspace(),
    [tab, setTab] = useState("Activity"),
    [search, setSearch] = useState("");
  const request = useRequest<{ data: Person }>(
      endpoint("people/" + id, projectId),
    ),
    events = useRequest<{ data: EventRecord[] }>(
      endpoint("people/" + id + "/events", projectId),
    );
  if (request.error)
    return <ErrorState message={request.error} retry={request.reload} />;
  if (!request.data) return <Loading />;
  const person = request.data.data,
    items =
      events.data?.data.filter((event) =>
        event.name.toLowerCase().includes(search.toLowerCase()),
      ) || [];
  return (
    <>
      <Link className="back-link" href="/people">
        <ArrowLeft size={15} />
        All people
      </Link>
      <div className="person-profile-header">
        <Avatar name={person.name} size="large" />
        <div>
          <h1>{person.name}</h1>
          <span>{person.email}</span>
          <div className="person-header-meta">
            <span>
              <MapPin size={13} />
              {person.city}, {person.country}
            </span>
            <span>
              <Smartphone size={13} />
              {person.platform}
            </span>
            <span className={"plan-tag " + person.plan.toLowerCase()}>
              {person.plan}
            </span>
          </div>
        </div>
        <span className="tag">Identified user</span>
      </div>
      <div className="profile-layout">
        <aside>
          <section className="panel form-panel">
            <SectionHeading title="Customer details" />
            <dl className="property-list">
              {[
                ["Email", person.email],
                ["Phone", person.phone],
                ["Customer ID", person.id],
                ["First seen", shortDate(person.createdAt)],
                ["Last seen", shortDate(person.lastSeen)],
                ["Lifetime value", money(person.value)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </section>
          <section className="panel reachability-panel">
            <SectionHeading title="Channel reachability" />
            {Object.entries(person.reachability).map(([channel, reachable]) => (
              <div key={channel}>
                <span>
                  <ChannelIcon channel={channel} size={16} />
                  {channel}
                </span>
                <span
                  className={reachable ? "text-success small" : "muted small"}
                >
                  {reachable ? "Reachable" : "Not reachable"}
                </span>
              </div>
            ))}
          </section>
        </aside>
        <section className="panel">
          <div className="tabs">
            {["Activity", "Properties"].map((item) => (
              <button
                key={item}
                className={tab === item ? "active" : ""}
                onClick={() => setTab(item)}
              >
                {item}
                {item === "Activity" ? (
                  <span>{events.data?.data.length ?? 0}</span>
                ) : null}
              </button>
            ))}
          </div>
          {tab === "Activity" ? (
            <>
              <div className="table-toolbar">
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Search activity..."
                />
                <span className="result-count">{items.length} events</span>
              </div>
              {events.loading ? (
                <Loading />
              ) : events.error ? (
                <ErrorState message={events.error} retry={events.reload} />
              ) : (
                <div className="activity-timeline">
                  {items.slice(0, 100).map((event) => (
                    <div className="timeline-event" key={event.id}>
                      <span
                        className={
                          "timeline-icon " +
                          (event.name === "Charged" ? "purchase" : "")
                        }
                      >
                        <Activity size={15} />
                      </span>
                      <div>
                        <div>
                          <strong>{event.name}</strong>
                          <time>
                            {new Date(event.timestamp).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                        </div>
                        <div className="event-properties">
                          {Object.entries(event.properties).map(
                            ([key, value]) => (
                              <span key={key}>
                                <small>{key}</small>
                                {String(value)}
                              </span>
                            ),
                          )}
                          {event.runId ? (
                            <span className="run-tag">Demo run</span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!items.length ? (
                    <Empty title="No matching activity" />
                  ) : null}
                </div>
              )}
            </>
          ) : (
            <div className="form-panel">
              <dl className="property-list">
                {Object.entries(person)
                  .filter(([, value]) => typeof value !== "object")
                  .map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{String(value)}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
