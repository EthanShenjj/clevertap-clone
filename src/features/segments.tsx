"use client";
import { QueryBuilder } from "@/components/query-builder";
import {
  Avatar,
  Badge,
  Button,
  ChannelIcon,
  ErrorState,
  Field,
  Loading,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { api, endpoint, number, shortDate, useRequest } from "@/lib/client";
import type {
  Campaign,
  Journey,
  ListResponse,
  Person,
  RuleGroup,
  Segment,
  SegmentResult,
} from "@/lib/types";
import {
  ArrowLeft,
  ArrowUpRight,
  Calculator,
  CheckCircle2,
  Info,
  Pencil,
  Plus,
  Save,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SegmentEditorPage({ id }: { id?: string }) {
  const { projectId } = useWorkspace();
  const request = useRequest<{ data: Segment }>(
    id ? endpoint("segments/" + id, projectId) : null,
  );
  if (id && request.error)
    return <ErrorState message={request.error} retry={request.reload} />;
  if (id && !request.data) return <Loading />;
  return (
    <SegmentEditor
      key={projectId + (id || "new")}
      initial={request.data?.data}
    />
  );
}
function SegmentEditor({ initial }: { initial?: Segment }) {
  const { projectId, toast } = useWorkspace(),
    router = useRouter();
  const [name, setName] = useState(initial?.name || ""),
    [description, setDescription] = useState(initial?.description || "");
  const [query, setQuery] = useState<RuleGroup>(
    initial?.query || { combinator: "and", rules: [] },
  );
  const [result, setResult] = useState<SegmentResult>(),
    [resultKey, setResultKey] = useState(""),
    [calculating, setCalculating] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const calculate = async () => {
    setCalculating(true);
    setError("");
    try {
      const response = await api<{ data: SegmentResult }>(
        endpoint("segments/evaluate", projectId),
        { method: "POST", body: { query } },
      );
      setResult(response.data);
      setResultKey(JSON.stringify(query));
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setCalculating(false);
    }
  };
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      const response = await api<{ data: Segment }>(
        endpoint("segments" + (initial ? "/" + initial.id : ""), projectId),
        {
          method: initial ? "PATCH" : "POST",
          body: { name, description, query, type: "Past behavior" },
        },
      );
      toast("Segment saved. Your audience is ready.");
      router.push("/segments/" + response.data.id);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Link
        className="back-link"
        href={initial ? "/segments/" + initial.id : "/segments"}
      >
        <ArrowLeft size={15} />
        Back to segments
      </Link>
      <PageHeader
        eyebrow="AUDIENCE BUILDER"
        title={initial ? "Edit segment" : "Create a segment"}
        description="A shared understanding starts with the right audience."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={calculate}
              loading={calculating}
            >
              <Calculator size={16} />
              Calculate audience
            </Button>
            <Button onClick={save} loading={saving}>
              <Save size={16} />
              Save segment
            </Button>
          </>
        }
      />
      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="editor-grid">
        <div>
          <section className="panel form-panel">
            <SectionHeading title="Give your audience a name" />
            <Field label="Segment name">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. High-intent shoppers"
                maxLength={120}
              />
            </Field>
            <Field label="Description (optional)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What makes this audience special?"
                rows={2}
              />
            </Field>
          </section>
          <section className="panel form-panel">
            <SectionHeading
              title="Define your audience"
              description="Combine customer properties and actions to find the right people."
            />
            <QueryBuilder query={query} onChange={setQuery} />
          </section>
          {result ? (
            <section className="panel">
              <SectionHeading
                title="A few people in this audience"
                description="Open a profile to understand their story."
              />
              <PersonSample people={result.users.slice(0, 8)} />
            </section>
          ) : null}
        </div>
        <aside>
          <section className="panel audience-summary">
            <span className="summary-icon blue">
              <Users size={24} />
            </span>
            <h3>Your audience</h3>
            <strong>{result ? number(result.count) : "—"}</strong>
            <p>
              {result
                ? "customers match your conditions"
                : "Calculate to see who's in your audience."}
            </p>
            {resultKey && resultKey !== JSON.stringify(query) ? (
              <div className="pending-note">
                Conditions changed. Calculate again to update this estimate.
              </div>
            ) : result ? (
              <span className="calculated-note">
                <CheckCircle2 size={14} />
                Audience calculated
              </span>
            ) : null}
            <Button
              variant="secondary"
              onClick={calculate}
              loading={calculating}
            >
              Calculate audience
            </Button>
          </section>
          {result ? (
            <section className="panel reachability-panel">
              <SectionHeading title="Reach them where they are" />
              {Object.entries(result.reachability)
                .slice(0, 6)
                .map(([channel, count]) => (
                  <div key={channel}>
                    <span>
                      <ChannelIcon channel={channel} />
                      {channel}
                    </span>
                    <strong>{number(count)}</strong>
                  </div>
                ))}
            </section>
          ) : (
            <div className="aside-note">
              <Info size={18} />
              <p>
                Your segment will be available across analytics, campaigns and
                journeys.
              </p>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
export function PersonSample({ people }: { people: Person[] }) {
  return people.length ? (
    <div className="person-sample">
      {people.map((person) => (
        <Link key={person.id} href={"/people/" + person.id}>
          <Avatar name={person.name} size="small" />
          <span>
            <strong>{person.name}</strong>
            <small>
              {person.city}, {person.country}
            </small>
          </span>
          <ArrowUpRight size={15} />
        </Link>
      ))}
    </div>
  ) : (
    <div className="empty-inline">No users match these conditions yet.</div>
  );
}
export function SegmentDetail({ id }: { id: string }) {
  const { projectId } = useWorkspace();
  const request = useRequest<{
    data: Segment;
    references: { campaigns: Campaign[]; journeys: Journey[] };
  }>(endpoint("segments/" + id, projectId));
  const people = useRequest<ListResponse<Person>>(
    endpoint("people", projectId, { segmentId: id, pageSize: 10 }),
  );
  if (request.error)
    return <ErrorState message={request.error} retry={request.reload} />;
  if (!request.data) return <Loading />;
  const segment = request.data.data;
  return (
    <>
      <Link className="back-link" href="/segments">
        <ArrowLeft size={15} />
        All segments
      </Link>
      <PageHeader
        eyebrow="SEGMENT DETAILS"
        title={segment.name}
        description={segment.description || "A closer look at your audience."}
        actions={
          <>
            <Link className="btn secondary" href={"/segments/" + id + "/edit"}>
              <Pencil size={16} />
              Edit segment
            </Link>
            <Link
              className="btn primary"
              href={"/campaigns/new?segmentId=" + id}
            >
              <Plus size={16} />
              Create campaign
            </Link>
          </>
        }
      />
      <div className="detail-meta">
        <Badge status={segment.status} />
        <span>{segment.type}</span>
        <span>Created {shortDate(segment.createdAt)}</span>
        <span>By {segment.createdBy}</span>
      </div>
      <div className="segment-detail-grid">
        <section className="panel segment-size">
          <span className="summary-icon purple">
            <Users size={22} />
          </span>
          <span>Users in this segment</span>
          <strong>{number(segment.userCount)}</strong>
          <small>Calculated from customer profiles and events</small>
        </section>
        <section className="panel segment-reach">
          <SectionHeading
            title="Channel reachability"
            description="Connect through the channels your customers use."
          />
          <div>
            {Object.entries(segment.reachability || {})
              .slice(0, 6)
              .map(([channel, count]) => (
                <div key={channel}>
                  <ChannelIcon channel={channel} boxed />
                  <strong>{number(count)}</strong>
                  <span>{channel}</span>
                  <small>
                    {segment.userCount
                      ? Math.round((count / segment.userCount) * 100)
                      : 0}
                    % reachable
                  </small>
                </div>
              ))}
          </div>
        </section>
      </div>
      <div className="two-column">
        <section className="panel form-panel">
          <SectionHeading
            title="Audience definition"
            action={
              <Link className="text-link" href={"/segments/" + id + "/edit"}>
                Edit
                <Pencil size={13} />
              </Link>
            }
          />
          <div className="condition-summary">
            {segment.query.funnel ? (
              <p>From funnel: {segment.query.funnel.steps.join(" → ")}</p>
            ) : null}
            {segment.query.rules.length ? (
              segment.query.rules.map((rule, index) => (
                <div key={rule.id}>
                  {index ? (
                    <span className="rule-pill">
                      {segment.query.combinator.toUpperCase()}
                    </span>
                  ) : null}
                  <p>
                    <span>
                      {rule.kind === "property"
                        ? "User property"
                        : "User behavior"}
                    </span>
                    <strong>{rule.field}</strong>{" "}
                    {rule.operator.replaceAll("_", " ")}{" "}
                    <strong>
                      {rule.operator === "did_not" ? "" : rule.value}
                    </strong>
                    {rule.kind === "event"
                      ? " in the last " + rule.days + " days"
                      : ""}
                  </p>
                </div>
              ))
            ) : (
              <p>All users in this project</p>
            )}
          </div>
        </section>
        <section className="panel">
          <SectionHeading title="Where this audience connects" />
          <div className="reference-list">
            {request.data.references.campaigns.map((item) => (
              <Link key={item.id} href={"/campaigns/" + item.id}>
                <ChannelIcon channel={item.channel} />
                <span>{item.name}</span>
                <Badge status={item.status} />
              </Link>
            ))}
            {request.data.references.journeys.map((item) => (
              <Link key={item.id} href={"/journeys/" + item.id}>
                <Users size={17} />
                <span>{item.name}</span>
                <Badge status={item.status} />
              </Link>
            ))}
            {!request.data.references.campaigns.length &&
            !request.data.references.journeys.length ? (
              <div className="empty-inline">
                Create a campaign or journey to use this audience.
              </div>
            ) : null}
          </div>
        </section>
      </div>
      <section className="panel">
        <SectionHeading
          title="Meet your audience"
          action={
            <Link className="text-link" href={"/people?segmentId=" + id}>
              View all users
              <ArrowUpRight size={14} />
            </Link>
          }
        />
        {people.data ? <PersonSample people={people.data.data} /> : <Loading />}
      </section>
    </>
  );
}
