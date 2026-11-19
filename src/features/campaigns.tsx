"use client";
import { clickRate } from "@/lib/domain";
import { MessageEditor, MessagePreview } from "@/components/message-editor";
import { EVENT_NAMES, QueryBuilder } from "@/components/query-builder";
import {
  Badge,
  Button,
  ChannelIcon,
  DataTable,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import {
  api,
  endpoint,
  money,
  number,
  shortDate,
  useRequest,
} from "@/lib/client";
import {
  CHANNELS,
  EMPTY_CONTENT,
  type Campaign,
  type Channel,
  type ChannelType,
  type ListResponse,
  type MessageContent,
  type MessageTemplate,
  type Person,
  type RuleGroup,
  type RunRecord,
  type Segment,
} from "@/lib/types";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FlaskConical,
  Info,
  Pause,
  Pencil,
  Play,
  Plus,
  Rocket,
  Save,
  Send,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PersonSample } from "./segments";

export function CampaignEditorPage({ id }: { id?: string }) {
  const { projectId } = useWorkspace(),
    params = useSearchParams();
  const request = useRequest<{ data: Campaign }>(
    id ? endpoint("campaigns/" + id, projectId) : null,
  );
  const templateId = params.get("templateId") || "";
  const template = useRequest<{ data: MessageTemplate }>(
    templateId ? endpoint("templates/" + templateId, projectId) : null,
  );
  const channels = useRequest<ListResponse<Channel>>(
    endpoint("channels", projectId, { pageSize: 50 }),
  );
  const channel =
    request.data?.data.channel ||
    params.get("channel") ||
    template.data?.data.channel;
  if (id && request.error)
    return <ErrorState message={request.error} retry={request.reload} />;
  if (
    (id && !request.data) ||
    (templateId && !template.data && !template.error)
  )
    return <Loading />;
  if (template.error)
    return <ErrorState message={template.error} retry={template.reload} />;
  if (!channel || !CHANNELS.includes(channel as ChannelType))
    return (
      <ChannelPicker
        channels={channels.data?.data || []}
        segmentId={params.get("segmentId") || ""}
      />
    );
  return (
    <CampaignEditor
      key={projectId + (id || channel) + (request.data?.data.updatedAt || "")}
      initial={request.data?.data}
      channel={channel as ChannelType}
      initialTemplate={template.data?.data}
      initialSegmentId={params.get("segmentId") || ""}
    />
  );
}
function ChannelPicker({
  channels,
  segmentId,
}: {
  channels: Channel[];
  segmentId: string;
}) {
  const descriptions: Record<string, string> = {
    Push: "A timely nudge, right on their screen.",
    Email: "Room for a more meaningful message.",
    "In-App": "Meet customers in the moment.",
    "Web Pop-up": "Turn a visit into a connection.",
    SMS: "A short message. A lasting impression.",
    WhatsApp: "Start a conversation where they are.",
    "Web Push": "Bring them back to your website.",
    RCS: "Rich conversations, more possibilities.",
  };
  return (
    <>
      <Link href="/campaigns" className="back-link">
        <ArrowLeft size={15} />
        All campaigns
      </Link>
      <PageHeader
        eyebrow="START SOMETHING MEANINGFUL"
        title="Create a campaign"
        description="How would you like to connect with your customers?"
      />
      <section className="channel-picker">
        <SectionHeading
          title="Choose a channel"
          description="A great experience starts with the right conversation."
        />
        <div>
          {CHANNELS.map((channel) => {
            const connected = channels.some(
              (c) => c.channel === channel && c.status === "Connected",
            );
            return (
              <Link
                key={channel}
                href={
                  "/campaigns/new?channel=" +
                  encodeURIComponent(channel) +
                  (segmentId ? "&segmentId=" + segmentId : "")
                }
              >
                <ChannelIcon channel={channel} boxed size={25} />
                <h3>{channel}</h3>
                <p>{descriptions[channel]}</p>
                <span className={connected ? "channel-ready" : "muted small"}>
                  {connected ? (
                    <>
                      <span className="live-dot" />
                      Ready to use
                    </>
                  ) : (
                    "Setup required"
                  )}
                </span>
                <ArrowRight size={17} />
              </Link>
            );
          })}
        </div>
      </section>
    </>
  );
}
function NewAudienceDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { projectId, toast } = useWorkspace(),
    [name, setName] = useState(""),
    [query, setQuery] = useState<RuleGroup>({ combinator: "and", rules: [] }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await api<{ data: Segment }>(
        endpoint("segments", projectId),
        { method: "POST", body: { name, query } },
      );
      toast("Audience saved.");
      onSaved(response.data.id);
      onClose();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Create a target audience"
      description="Find the right people for this conversation."
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save and use audience
          </Button>
        </>
      }
    >
      <Field label="Audience name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Ready for their next purchase"
        />
      </Field>
      <QueryBuilder query={query} onChange={setQuery} />
      {error ? <div className="inline-error">{error}</div> : null}
    </Modal>
  );
}
function CampaignEditor({
  initial,
  channel,
  initialTemplate,
  initialSegmentId,
}: {
  initial?: Campaign;
  channel: ChannelType;
  initialTemplate?: MessageTemplate;
  initialSegmentId: string;
}) {
  const { projectId, toast } = useWorkspace(),
    router = useRouter();
  const [step, setStep] = useState(0),
    [draftId, setDraftId] = useState(initial?.id || ""),
    [name, setName] = useState(initial?.name || ""),
    [segmentId, setSegmentId] = useState(
      initial?.segmentId || initialSegmentId,
    ),
    [templateId, setTemplateId] = useState(
      initial?.templateId || initialTemplate?.id || "",
    );
  const [content, setContent] = useState<MessageContent>(
      initial?.content ||
        initialTemplate?.content || {
          ...EMPTY_CONTENT,
          title: "",
          body: "",
          blocks: [],
        },
    ),
    [variantB, setVariantB] = useState<MessageContent>(
      initial?.variantB || { ...EMPTY_CONTENT },
    ),
    [abEnabled, setAB] = useState(initial?.abEnabled || false),
    [variant, setVariant] = useState("A"),
    [split, setSplit] = useState(initial?.split || 50),
    [goal, setGoal] = useState(initial?.goal || "Charged");
  const [scheduleMode, setScheduleMode] = useState(
      initial?.schedule ? "later" : "now",
    ),
    [schedule, setSchedule] = useState(
      initial?.schedule ? initial.schedule.slice(0, 16) : "",
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [newAudience, setNewAudience] = useState(false),
    [previewUser, setPreviewUser] = useState("");
  const segments = useRequest<ListResponse<Segment>>(
    endpoint("segments", projectId, { pageSize: 100 }),
  );
  const templates = useRequest<ListResponse<MessageTemplate>>(
    endpoint("templates", projectId, { pageSize: 100, channel }),
  );
  const profiles = useRequest<ListResponse<Person>>(
    endpoint("people", projectId, { pageSize: 10 }),
  );
  const channels = useRequest<ListResponse<Channel>>(
    endpoint("channels", projectId, { pageSize: 50 }),
  );
  const selectedSegment = segments.data?.data.find((s) => s.id === segmentId),
    connected = channels.data?.data.some(
      (c) => c.channel === channel && c.status === "Connected",
    );
  const person =
    profiles.data?.data.find((p) => p.id === previewUser) ||
    profiles.data?.data[0];
  const stages = ["Start here", "Who", "What", "When", "Review"];
  const payload = () => ({
    name,
    channel,
    segmentId,
    templateId,
    content,
    variantB,
    abEnabled,
    split,
    goal,
    schedule:
      scheduleMode === "later" && schedule
        ? new Date(schedule).toISOString()
        : "",
  });
  const save = async (shouldPublish: boolean) => {
    setBusy(true);
    setError("");
    try {
      const response = await api<{ data: Campaign }>(
        endpoint("campaigns" + (draftId ? "/" + draftId : ""), projectId),
        { method: draftId ? "PATCH" : "POST", body: payload() },
      );
      setDraftId(response.data.id);
      if (shouldPublish) {
        await api(
          endpoint("campaigns/" + response.data.id + "/publish", projectId),
          { method: "POST" },
        );
        toast("Campaign published in demo mode.");
        router.push("/campaigns/" + response.data.id);
      } else {
        toast("Your draft is saved.");
        router.push("/campaigns/" + response.data.id);
      }
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pause = async () => {
    setBusy(true);
    try {
      await api(endpoint("campaigns/" + initial!.id + "/status", projectId), {
        method: "POST",
        body: { status: "Paused" },
      });
      toast("Campaign paused. You can now edit it.");
      router.refresh();
      window.location.reload();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (initial && ["Running", "Scheduled"].includes(initial.status))
    return (
      <>
        <Link className="back-link" href={"/campaigns/" + initial.id}>
          <ArrowLeft size={15} />
          Back to campaign
        </Link>
        <PageHeader
          title={initial.name}
          description="Pause your campaign to make changes to its configuration."
        />
        <section className="panel form-panel">
          <Badge status={initial.status} />
          <p>
            This campaign is currently {initial.status.toLowerCase()}. Pause it
            before updating your audience, content or schedule.
          </p>
          <Button loading={busy} onClick={pause}>
            <Pause size={16} />
            Pause and edit
          </Button>
          {error ? <div className="inline-error">{error}</div> : null}
        </section>
      </>
    );
  return (
    <>
      <Link className="back-link" href="/campaigns">
        <ArrowLeft size={15} />
        All campaigns
      </Link>
      <PageHeader
        eyebrow={channel.toUpperCase() + " CAMPAIGN"}
        title={initial ? "Edit your campaign" : "Make your next connection"}
        description="A message with meaning, built one step at a time."
        actions={
          <Button
            variant="secondary"
            onClick={() => save(false)}
            loading={busy}
          >
            <Save size={16} />
            Save draft
          </Button>
        }
      />
      <div className="campaign-steps">
        {stages.map((label, index) => (
          <button
            key={label}
            className={step === index ? "active" : step > index ? "done" : ""}
            onClick={() => setStep(index)}
          >
            <span>{step > index ? <Check size={13} /> : index + 1}</span>
            <div>
              <strong>{label}</strong>
              <small>
                {
                  [
                    "The essentials",
                    "Your audience",
                    "Your message",
                    "The right moment",
                    "Ready to go",
                  ][index]
                }
              </small>
            </div>
            {index < 4 ? <ChevronRight size={15} /> : null}
          </button>
        ))}
      </div>
      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}
      <div className="campaign-editor-layout">
        <section className="panel form-panel">
          {step === 0 ? (
            <>
              <SectionHeading
                title="Let's start with the essentials"
                description="Give your campaign a name and a purpose."
              />
              <div className="selected-channel">
                <ChannelIcon channel={channel} boxed size={24} />
                <div>
                  <strong>{channel}</strong>
                  <span>One-time campaign</span>
                </div>
                <Badge status={connected ? "Connected" : "Not connected"} />
              </div>
              <Field label="Campaign name">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. A little weekend inspiration"
                  maxLength={120}
                />
              </Field>
              <Field
                label="Conversion goal"
                hint="Track the customer action you want this campaign to inspire."
              >
                <select value={goal} onChange={(e) => setGoal(e.target.value)}>
                  {EVENT_NAMES.map((event) => (
                    <option key={event}>{event}</option>
                  ))}
                </select>
              </Field>
              {!connected ? (
                <div className="inline-warning">
                  <Info size={17} />
                  <span>
                    Set up this channel before publishing.{" "}
                    <Link href="/settings/channels">Configure channel</Link>
                  </span>
                </div>
              ) : null}
            </>
          ) : null}
          {step === 1 ? (
            <>
              <SectionHeading
                title="Who would you like to reach?"
                description="Start with a saved audience or create a new one."
              />
              <Field label="Target segment">
                <select
                  value={segmentId}
                  onChange={(e) => setSegmentId(e.target.value)}
                >
                  <option value="">Choose your audience</option>
                  {segments.data?.data.map((segment) => (
                    <option value={segment.id} key={segment.id}>
                      {segment.name} ({number(segment.userCount)} users)
                    </option>
                  ))}
                </select>
              </Field>
              <Button variant="ghost" onClick={() => setNewAudience(true)}>
                <Plus size={15} />
                Create a new audience
              </Button>
              {selectedSegment ? (
                <div className="audience-choice">
                  <span className="summary-icon purple">
                    <Users size={23} />
                  </span>
                  <h3>{selectedSegment.name}</h3>
                  <p>{selectedSegment.description}</p>
                  <div>
                    <span>
                      <strong>{number(selectedSegment.userCount)}</strong>Total
                      users
                    </span>
                    <span>
                      <strong>
                        {number(selectedSegment.reachability?.[channel] || 0)}
                      </strong>
                      Reachable on {channel}
                    </span>
                  </div>
                  <Link
                    className="text-link"
                    href={"/segments/" + selectedSegment.id}
                    target="_blank"
                  >
                    Explore this audience
                    <ArrowRight size={13} />
                  </Link>
                </div>
              ) : (
                <div className="aside-note">
                  <Users size={19} />
                  <p>
                    A good conversation starts with knowing who&apos;s
                    listening.
                  </p>
                </div>
              )}
            </>
          ) : null}
          {step === 2 ? (
            <>
              <SectionHeading
                title="What would you like to say?"
                description="Make your message feel like it was meant for them."
              />
              <Field label="Start from a template">
                <select
                  value={templateId}
                  onChange={(e) => {
                    setTemplateId(e.target.value);
                    const template = templates.data?.data.find(
                      (t) => t.id === e.target.value,
                    );
                    if (template) setContent(template.content);
                  }}
                >
                  <option value="">Write your own message</option>
                  {templates.data?.data.map((template) => (
                    <option value={template.id} key={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="toggle-setting">
                <span>
                  <FlaskConical size={17} />
                  <strong>Try two versions</strong>
                  <small>Learn which message connects best.</small>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={abEnabled}
                  onChange={(e) => {
                    setAB(e.target.checked);
                    setVariant("A");
                    if (!variantB.body)
                      setVariantB({
                        ...content,
                        title: content.title + " — just for you",
                      });
                  }}
                />
              </label>
              {abEnabled ? (
                <>
                  <div className="variant-tabs">
                    {["A", "B"].map((value) => (
                      <button
                        key={value}
                        className={variant === value ? "active" : ""}
                        onClick={() => setVariant(value)}
                      >
                        Variant {value}
                        <span>{value === "A" ? split : 100 - split}%</span>
                      </button>
                    ))}
                  </div>
                  <Field
                    label="Audience split"
                    hint={
                      "Variant A: " +
                      split +
                      "% · Variant B: " +
                      (100 - split) +
                      "%"
                    }
                  >
                    <input
                      aria-label="Variant A audience percentage"
                      type="range"
                      min={1}
                      max={99}
                      value={split}
                      onChange={(e) => setSplit(Number(e.target.value))}
                    />
                  </Field>
                </>
              ) : null}
              <MessageEditor
                channel={channel}
                content={variant === "B" && abEnabled ? variantB : content}
                onChange={
                  variant === "B" && abEnabled ? setVariantB : setContent
                }
              />
            </>
          ) : null}
          {step === 3 ? (
            <>
              <SectionHeading
                title="Find the right moment"
                description="Choose when your audience will hear from you."
              />
              <label
                className={
                  "schedule-option " + (scheduleMode === "now" ? "active" : "")
                }
              >
                <input
                  type="radio"
                  name="schedule"
                  checked={scheduleMode === "now"}
                  onChange={() => setScheduleMode("now")}
                />
                <span className="summary-icon blue">
                  <Send size={18} />
                </span>
                <span>
                  <strong>Send immediately</strong>
                  <small>Ready when you are.</small>
                </span>
              </label>
              <label
                className={
                  "schedule-option " +
                  (scheduleMode === "later" ? "active" : "")
                }
              >
                <input
                  type="radio"
                  name="schedule"
                  checked={scheduleMode === "later"}
                  onChange={() => setScheduleMode("later")}
                />
                <span className="summary-icon purple">
                  <Clock3 size={18} />
                </span>
                <span>
                  <strong>Schedule for later</strong>
                  <small>Make space for the perfect moment.</small>
                </span>
              </label>
              {scheduleMode === "later" ? (
                <Field
                  label="Date and time"
                  hint="Time is interpreted in your browser's local timezone."
                >
                  <input
                    type="datetime-local"
                    value={schedule}
                    onChange={(e) => setSchedule(e.target.value)}
                  />
                </Field>
              ) : null}
              <div className="aside-note">
                <Info size={18} />
                <p>
                  Delivery is simulated in this workspace. Scheduled campaigns
                  are saved with their selected time and can be started manually
                  for a demo.
                </p>
              </div>
            </>
          ) : null}
          {step === 4 ? (
            <>
              <SectionHeading
                title="A final look before you connect"
                description="Great experiences are in the details."
              />
              <dl className="review-list">
                {[
                  ["Campaign", name || "Add a campaign name"],
                  ["Channel", channel],
                  [
                    "Audience",
                    selectedSegment?.name || "Select a target audience",
                  ],
                  [
                    "Reachable customers",
                    number(selectedSegment?.reachability?.[channel] || 0),
                  ],
                  ["Conversion goal", goal],
                  [
                    "Delivery",
                    scheduleMode === "later"
                      ? schedule || "Choose a time"
                      : "Immediately",
                  ],
                  [
                    "A/B test",
                    abEnabled
                      ? "Variant A " +
                        split +
                        "% · Variant B " +
                        (100 - split) +
                        "%"
                      : "Not enabled",
                  ],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="publish-note">
                <CheckCircle2 size={23} />
                <div>
                  <strong>Ready to make a connection?</strong>
                  <p>
                    Publishing saves your campaign in demo mode. Run a
                    simulation from the campaign overview to see the results.
                  </p>
                </div>
              </div>
            </>
          ) : null}
          <div className="wizard-footer">
            <Button
              variant="secondary"
              disabled={step === 0}
              onClick={() => setStep(step - 1)}
            >
              <ArrowLeft size={15} />
              Back
            </Button>
            {step < 4 ? (
              <Button onClick={() => setStep(step + 1)}>
                Continue
                <ArrowRight size={15} />
              </Button>
            ) : (
              <Button onClick={() => save(true)} loading={busy}>
                <Rocket size={16} />
                Publish campaign
              </Button>
            )}
          </div>
        </section>
        <aside className="campaign-preview">
          <div className="preview-person">
            <Field label="Preview as">
              <select
                value={person?.id || ""}
                onChange={(e) => setPreviewUser(e.target.value)}
              >
                {profiles.data?.data.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} · {person.city}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <MessagePreview
            channel={channel}
            content={variant === "B" && abEnabled ? variantB : content}
            person={person}
          />
          <div className="campaign-side-summary">
            <ChannelIcon channel={channel} size={17} />
            <span>{channel} campaign</span>
            <span>
              {selectedSegment
                ? number(selectedSegment.reachability?.[channel] || 0) +
                  " reachable"
                : "Choose an audience"}
            </span>
          </div>
        </aside>
      </div>
      {newAudience ? (
        <NewAudienceDialog
          onClose={() => setNewAudience(false)}
          onSaved={(id) => {
            setSegmentId(id);
            segments.reload();
          }}
        />
      ) : null}
    </>
  );
}
export function CampaignDetail({ id }: { id: string }) {
  const { projectId, toast } = useWorkspace(),
    [tab, setTab] = useState("Overview"),
    [busy, setBusy] = useState(false),
    [selectedRun, setSelectedRun] = useState<string | null>(null);
  const request = useRequest<{ data: Campaign }>(
      endpoint("campaigns/" + id, projectId),
    ),
    runs = useRequest<{ data: RunRecord[] }>(
      endpoint("campaigns/" + id + "/runs", projectId),
    );
  const people = useRequest<ListResponse<Person>>(
    request.data?.data.segmentId
      ? endpoint("people", projectId, {
          segmentId: request.data.data.segmentId,
          pageSize: 10,
        })
      : null,
  );
  const action = async (name: string, body?: unknown) => {
    setBusy(true);
    try {
      await api(endpoint("campaigns/" + id + "/" + name, projectId), {
        method: "POST",
        body,
      });
      toast(
        name === "simulate"
          ? "Simulation complete. Results and user events have been saved."
          : "Campaign updated.",
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
  const campaign = request.data.data,
    stats = campaign.stats,
    run =
      runs.data?.data.find((run) => run.id === selectedRun) ||
      runs.data?.data[0];
  return (
    <>
      <Link className="back-link" href="/campaigns">
        <ArrowLeft size={15} />
        All campaigns
      </Link>
      <PageHeader
        eyebrow={campaign.channel.toUpperCase() + " CAMPAIGN"}
        title={campaign.name}
        description="Every connection, a little more meaningful."
        actions={
          <>
            <Link className="btn secondary" href={"/campaigns/" + id + "/edit"}>
              <Pencil size={15} />
              Edit
            </Link>
            {["Running", "Scheduled"].includes(campaign.status) ? (
              <Button
                variant="secondary"
                onClick={() => action("status", { status: "Paused" })}
                loading={busy}
              >
                <Pause size={15} />
                Pause
              </Button>
            ) : campaign.status === "Paused" ? (
              <Button
                variant="secondary"
                onClick={() => action("status", { status: "Running" })}
                loading={busy}
              >
                <Play size={15} />
                Resume
              </Button>
            ) : (
              <Button onClick={() => action("publish")} loading={busy}>
                <Rocket size={15} />
                Publish
              </Button>
            )}
            {campaign.status === "Running" ? (
              <Button onClick={() => action("simulate")} loading={busy}>
                <Play size={15} />
                Run simulation
              </Button>
            ) : null}
          </>
        }
      />
      <div className="detail-meta">
        <Badge status={campaign.status} />
        <span>
          <ChannelIcon channel={campaign.channel} size={14} />
          {campaign.channel}
        </span>
        <span>Created {shortDate(campaign.createdAt)}</span>
        <span>{campaign.createdBy}</span>
      </div>
      <div className="tabs standalone-tabs">
        {["Overview", "Message", "Audience", "Runs"].map((item) => (
          <button
            key={item}
            className={tab === item ? "active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
            {item === "Runs" ? (
              <span>{runs.data?.data.length || 0}</span>
            ) : null}
          </button>
        ))}
      </div>
      {tab === "Overview" ? (
        <>
          <div className="metric-grid five">
            {[
              { label: "Messages sent", value: number(stats.sent) },
              { label: "Delivered", value: number(stats.delivered) },
              {
                label: "Clicked",
                value: number(stats.clicked),
                note:
                  clickRate(campaign.channel, stats).toFixed(1) +
                  "% click rate",
              },
              {
                label: "Conversions",
                value: number(stats.converted),
                note:
                  (stats.delivered
                    ? (stats.converted / stats.delivered) * 100
                    : 0
                  ).toFixed(1) + "% conversion rate",
              },
              { label: "Revenue", value: money(stats.revenue) },
            ].map((item) => (
              <div className="metric-card" key={item.label}>
                <span className="metric-heading">{item.label}</span>
                <strong className="metric-value">{item.value}</strong>
                <small className="muted">
                  {item.note || "Across this campaign"}
                </small>
              </div>
            ))}
          </div>
          <div className="two-column">
            <section className="panel form-panel">
              <SectionHeading title="The campaign at a glance" />
              <dl className="property-list">
                {[
                  ["Channel", campaign.channel],
                  ["Conversion goal", campaign.goal],
                  [
                    "Delivery",
                    campaign.schedule
                      ? new Date(campaign.schedule).toLocaleString()
                      : "Immediately",
                  ],
                  [
                    "A/B testing",
                    campaign.abEnabled
                      ? "Enabled · " +
                        campaign.split +
                        "/" +
                        (100 - campaign.split)
                      : "Not enabled",
                  ],
                  ["Simulation runs", String(campaign.runs)],
                ].map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <Link
                className="text-link"
                href={"/segments/" + campaign.segmentId}
              >
                View target audience
                <ArrowRight size={14} />
              </Link>
            </section>
            <section className="panel form-panel">
              <SectionHeading
                title="Latest simulation"
                description={
                  run
                    ? new Date(run.createdAt).toLocaleString()
                    : "Ready to see what happens next?"
                }
              />
              {run ? (
                <div className="variant-results">
                  {run.result.variants.map((variant) => (
                    <div key={variant.name}>
                      <span className="variant-letter">{variant.name}</span>
                      <div>
                        <strong>Variant {variant.name}</strong>
                        <span>
                          {number(variant.sent)} sent ·{" "}
                          {number(variant.clicked)} clicked
                        </span>
                        <div className="variant-progress">
                          <i
                            style={{
                              width:
                                (variant.sent
                                  ? (variant.clicked / variant.sent) * 100
                                  : 0) + "%",
                            }}
                          />
                        </div>
                      </div>
                      <strong>
                        {variant.sent
                          ? ((variant.clicked / variant.sent) * 100).toFixed(1)
                          : 0}
                        %
                      </strong>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty
                  title="Your next chapter starts here"
                  description="Run a simulation to generate delivery results and user events."
                />
              )}
            </section>
          </div>
          <div className="bottom-tip">
            <Info size={16} />
            Delivery and response data are simulated. Each run is stored with
            its original configuration.
          </div>
        </>
      ) : null}
      {tab === "Message" ? (
        <div className="message-detail-grid">
          <MessagePreview
            channel={campaign.channel}
            content={campaign.content}
          />
          <section className="panel form-panel">
            <SectionHeading title="Your message" />
            <dl className="property-list">
              <div>
                <dt>Title</dt>
                <dd>{campaign.content.title || "—"}</dd>
              </div>
              <div>
                <dt>Subject</dt>
                <dd>{campaign.content.subject || "—"}</dd>
              </div>
              <div>
                <dt>Message</dt>
                <dd className="preserve-lines">{campaign.content.body}</dd>
              </div>
              <div>
                <dt>Call to action</dt>
                <dd>{campaign.content.cta}</dd>
              </div>
              <div>
                <dt>Destination</dt>
                <dd>{campaign.content.url}</dd>
              </div>
            </dl>
          </section>
        </div>
      ) : null}
      {tab === "Audience" ? (
        <section className="panel">
          <SectionHeading
            title="A few people you're connecting with"
            action={
              <Link
                className="text-link"
                href={"/segments/" + campaign.segmentId}
              >
                View segment
                <ArrowRight size={14} />
              </Link>
            }
          />
          {people.data ? (
            <PersonSample people={people.data.data} />
          ) : people.error ? (
            <ErrorState message={people.error} />
          ) : (
            <Loading />
          )}
        </section>
      ) : null}
      {tab === "Runs" ? (
        <section className="panel">
          <SectionHeading
            title="Simulation history"
            description="Every run keeps a snapshot of the message and audience configuration."
          />
          {runs.loading ? (
            <Loading />
          ) : runs.data?.data.length ? (
            <>
              <div className="run-picker">
                {runs.data.data.map((item, index) => (
                  <button
                    className={run?.id === item.id ? "active" : ""}
                    key={item.id}
                    onClick={() => setSelectedRun(item.id)}
                  >
                    <span>Run {runs.data!.data.length - index}</span>
                    <strong>{new Date(item.createdAt).toLocaleString()}</strong>
                    <small>
                      {number(item.result.stats.sent)} sent ·{" "}
                      {item.result.stats.converted} converted
                    </small>
                  </button>
                ))}
              </div>
              <DataTable
                rows={(run?.records.slice(0, 30) || []).map(
                  (record, index) => ({ ...record, id: String(index) }),
                )}
                columns={[
                  {
                    key: "user",
                    label: "Customer profile",
                    render: (record) => (
                      <Link
                        className="table-name"
                        href={"/people/" + record.personId}
                      >
                        {record.personId}
                        <ArrowRight size={13} />
                      </Link>
                    ),
                  },
                  {
                    key: "variant",
                    label: "Variant",
                    render: (record) => (
                      <span className="type-tag">Variant {record.variant}</span>
                    ),
                  },
                  {
                    key: "outcome",
                    label: "Outcome",
                    render: (record) => <Badge status={record.outcome} />,
                  },
                ]}
              />
            </>
          ) : (
            <Empty
              title="No simulation runs yet"
              description="Publish this campaign, then run a simulation to begin."
            />
          )}
        </section>
      ) : null}
    </>
  );
}
