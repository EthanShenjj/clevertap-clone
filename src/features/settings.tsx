"use client";
import {
  Badge,
  Button,
  ChannelIcon,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { api, endpoint, shortDate, useRequest } from "@/lib/client";
import type { Channel, ListResponse, Project } from "@/lib/types";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Plug,
  Save,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function Channels() {
  const router = useRouter();
  const { projectId } = useWorkspace(),
    request = useRequest<ListResponse<Channel>>(
      endpoint("channels", projectId, {
        pageSize: 50,
        sort: "createdAt",
        direction: "asc",
      }),
    );
  const [selected, setSelected] = useState<Channel | null>(null);
  const channelCards = request.data?.data
    .filter(
      (channel, index, items) =>
        channel.channel !== "SMS" ||
        items.findIndex((item) => item.channel === "SMS") === index,
    )
    .map((channel) =>
      channel.channel === "SMS" &&
      request.data?.data.some(
        (item) => item.channel === "SMS" && item.status === "Connected",
      )
        ? { ...channel, status: "Connected" }
        : channel,
    );
  return (
    <>
      <PageHeader
        eyebrow="MEET THEM WHERE THEY ARE"
        title="Channels"
        description="One connected experience. Every channel your customers love."
        actions={
          <a
            className="btn secondary"
            href="https://docs.clevertap.com/docs/intro-to-campaigns"
            target="_blank"
            rel="noreferrer"
          >
            Channel documentation
            <ArrowUpRight size={15} />
          </a>
        }
      />
      <div className="channel-intro">
        <span className="channel-intro-icon">
          <Plug size={24} />
        </span>
        <div>
          <h3>Your conversations start here</h3>
          <p>
            Configure your channels, then bring them together in campaigns and
            journeys.
          </p>
        </div>
        <span className="connection-count">
          <i />
          {
            new Set(
              request.data?.data
                .filter((channel) => channel.status === "Connected")
                .map((channel) => channel.channel),
            ).size
          }{" "}
          channels connected
        </span>
      </div>
      {request.error ? (
        <ErrorState message={request.error} retry={request.reload} />
      ) : !request.data ? (
        <Loading />
      ) : (
        <div className="channels-grid">
          {channelCards?.map((channel) => (
            <section className="panel channel-card" key={channel.id}>
              <div className="channel-card-top">
                <ChannelIcon channel={channel.channel} boxed size={25} />
                <Badge status={channel.status} />
              </div>
              <h2>{channel.channel === "SMS" ? "SMS" : channel.name}</h2>
              <p>
                {channel.channel === "SMS"
                  ? "Manage SMS providers, priority routes and delivery receipts."
                  : channel.description}
              </p>
              <div className="provider-row">
                <span>Service provider</span>
                <strong>
                  {channel.channel === "SMS"
                    ? (request.data?.data.filter((c) => c.channel === "SMS")
                        .length || 0) + " providers"
                    : channel.provider}
                </strong>
              </div>
              <div className="channel-card-footer">
                <span>
                  {channel.checkedAt
                    ? "Checked " + shortDate(channel.checkedAt)
                    : channel.status === "Connected"
                      ? "Ready for demo delivery"
                      : "Connect to get started"}
                </span>
                <Button
                  variant="secondary"
                  onClick={() =>
                    channel.channel === "SMS"
                      ? router.push("/settings/channels/sms")
                      : setSelected(channel)
                  }
                >
                  {channel.status === "Connected" ? (
                    <Settings2 size={14} />
                  ) : (
                    <PlusIcon />
                  )}{" "}
                  {channel.status === "Connected" ? "Configure" : "Connect"}
                  <ChevronRight size={14} />
                </Button>
              </div>
            </section>
          ))}
        </div>
      )}
      <div className="integration-note">
        <ShieldCheck size={19} />
        <div>
          <strong>
            Your channel configurations are saved in this workspace.
          </strong>
          <p>
            Configuration checks validate local settings. Actual provider
            delivery is simulated in demo mode.
          </p>
        </div>
      </div>
      {selected ? (
        <ChannelDialog
          key={selected.id}
          initial={selected}
          onClose={() => setSelected(null)}
          onSaved={request.reload}
        />
      ) : null}
    </>
  );
}
function PlusIcon() {
  return <Plug size={14} />;
}
function ChannelDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: Channel;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { projectId, toast } = useWorkspace(),
    [name, setName] = useState(initial.name),
    [provider, setProvider] = useState(initial.provider),
    [config, setConfig] = useState(initial.config),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [checked, setChecked] = useState(false);
  const save = async (test: boolean) => {
    setBusy(true);
    setError("");
    try {
      await api(endpoint("channels/" + initial.id, projectId), {
        method: "PATCH",
        body: { name, provider, config },
      });
      if (test) {
        await api(endpoint("channels/" + initial.id + "/test", projectId), {
          method: "POST",
        });
        setChecked(true);
        toast("Channel configuration validated for demo delivery.");
      } else {
        toast("Channel settings saved.");
        onClose();
      }
      onSaved();
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title={"Configure " + initial.channel}
      description="Keep your channel settings in one place."
      drawer
      onClose={onClose}
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => save(false)}
            loading={busy}
          >
            Save settings
          </Button>
          <Button onClick={() => save(true)} loading={busy}>
            <CheckCircle2 size={16} />
            Validate configuration
          </Button>
        </>
      }
    >
      <div className="channel-dialog-icon">
        <ChannelIcon channel={initial.channel} boxed size={27} />
        <div>
          <h3>{initial.channel}</h3>
          <span>Channel configuration</span>
        </div>
      </div>
      <Field label="Display name">
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Service provider">
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setChecked(false);
          }}
        >
          {[
            ...new Set([
              initial.provider,
              "Amazon SES",
              "SendGrid",
              "Firebase Cloud Messaging",
              "CleverTap SDK",
              "Web SDK",
              "Twilio",
              "Meta Business",
              "Custom",
            ]),
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </Field>
      <Field
        label={
          initial.channel === "Email" ? "Sender email address" : "Sender name"
        }
      >
        <input
          value={config.sender}
          onChange={(e) => {
            setConfig({ ...config, sender: e.target.value });
            setChecked(false);
          }}
          placeholder={
            initial.channel === "Email" ? "hello@yourbrand.com" : "Your brand"
          }
        />
      </Field>
      <Field label="Website domain">
        <input
          value={config.domain}
          onChange={(e) => {
            setConfig({ ...config, domain: e.target.value });
            setChecked(false);
          }}
          placeholder="yourbrand.com"
        />
      </Field>
      <Field label="Application ID">
        <input
          value={config.appId}
          onChange={(e) => {
            setConfig({ ...config, appId: e.target.value });
            setChecked(false);
          }}
          placeholder="app_yourbrand"
        />
      </Field>
      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}
      {checked ? (
        <div className="inline-success">
          <Check size={18} />
          <div>
            <strong>Configuration looks good</strong>
            <p>Ready for demo campaigns. No external provider was contacted.</p>
          </div>
        </div>
      ) : null}
      <div className="aside-note">
        <ShieldCheck size={18} />
        <p>
          Use demo configuration values here. This workspace simulates message
          delivery and does not require provider credentials.
        </p>
      </div>
    </Modal>
  );
}
export function ProjectSettings() {
  const { project, projectId } = useWorkspace();
  if (!project) return <Loading />;
  return <ProjectForm key={projectId} initial={project} />;
}
function ProjectForm({ initial }: { initial: Project }) {
  const { toast, refreshProjects } = useWorkspace(),
    [name, setName] = useState(initial.name),
    [timezone, setTimezone] = useState(initial.timezone),
    [website, setWebsite] = useState(initial.website),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [resetOpen, setResetOpen] = useState(false),
    [confirmation, setConfirmation] = useState("");
  const health = useRequest<{
    data: { status: string; storage: string; counts: Record<string, number> };
  }>("/api/health");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api("/api/projects/" + initial.id, {
        method: "PATCH",
        body: { name, timezone, website },
      });
      refreshProjects();
      toast("Project settings saved.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ data: Project }>(
        "/api/projects/" + initial.id + "/reset",
        { method: "POST", body: { confirm: confirmation } },
      );
      setName(result.data.name);
      setTimezone(result.data.timezone);
      setWebsite(result.data.website);
      refreshProjects();
      health.reload();
      setResetOpen(false);
      setConfirmation("");
      toast("Demo data restored for this project.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="YOUR WORKSPACE, YOUR WAY"
        title="Project settings"
        description="The foundations of a great customer experience."
      />
      <div className="settings-layout">
        <aside className="settings-navigation">
          <a className="active" href="#general">
            <Settings2 size={17} />
            General
          </a>
          <a href="#workspace-data">
            <SlidersHorizontal size={17} />
            Workspace data
          </a>
          <a href="#workspace-mode">
            <ShieldCheck size={17} />
            Demo mode
          </a>
        </aside>
        <div>
          <section className="panel form-panel" id="general">
            <SectionHeading
              title="General information"
              description="The details that make this workspace yours."
            />
            <div className="project-identity">
              <span className="project-avatar large">{name[0] || "S"}</span>
              <div>
                <strong>{name}</strong>
                <span>Project ID: {initial.id}</span>
              </div>
            </div>
            <Field label="Project name">
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Website">
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            </Field>
            <Field
              label="Project timezone"
              hint="Used for grouping analytics into natural calendar days."
            >
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
              >
                {[
                  "Asia/Shanghai",
                  "Asia/Kolkata",
                  "Asia/Singapore",
                  "America/New_York",
                  "Europe/London",
                  "UTC",
                ].map((zone) => (
                  <option key={zone}>{zone}</option>
                ))}
              </select>
            </Field>
            {error ? <div className="inline-error">{error}</div> : null}
            <div className="form-actions">
              <Button onClick={save} loading={busy}>
                <Save size={16} />
                Save changes
              </Button>
            </div>
          </section>
          <section className="panel form-panel" id="workspace-data">
            <SectionHeading
              title="Workspace data"
              description="Your application is connected to a persistent SQLite database."
            />
            {health.data ? (
              <div className="data-health-grid">
                {Object.entries(health.data.data.counts).map(([key, count]) => (
                  <div key={key}>
                    <span>{key}</span>
                    <strong>
                      {new Intl.NumberFormat("en-US").format(count)}
                    </strong>
                  </div>
                ))}
              </div>
            ) : (
              <Loading />
            )}
            <div className="system-status">
              <span className="live-dot" />
              API and database operational
            </div>
          </section>
          <section className="panel form-panel" id="workspace-mode">
            <SectionHeading title="A workspace built for exploration" />
            <p className="muted">
              Customer profiles, templates, channel settings, segments and
              campaigns are saved through the backend API. Message delivery and
              journey execution are demo simulations, with persisted run records
              and user events.
            </p>
            <div className="detail-meta">
              <span className="tag">Demo data: Nov 19, 2026</span>
              <span className="tag">SQLite persistence</span>
              <span className="tag">Local workspace</span>
            </div>
            <div className="form-actions">
              <Button
                variant="secondary"
                onClick={() => {
                  setError("");
                  setResetOpen(true);
                }}
              >
                Reset demo data
              </Button>
            </div>
          </section>
        </div>
      </div>
      {resetOpen ? (
        <Modal
          title="Reset this project's demo data?"
          description="Restore the original profiles, events and configurations. This removes your changes in the selected project."
          onClose={() => setResetOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setResetOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                loading={busy}
                disabled={confirmation !== initial.id}
                onClick={reset}
              >
                Reset demo data
              </Button>
            </>
          }
        >
          <Field label="Type the project ID to confirm" hint={initial.id}>
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
            />
          </Field>
          {error ? <div className="inline-error">{error}</div> : null}
        </Modal>
      ) : null}
    </>
  );
}
