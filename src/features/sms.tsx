"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  ArrowUpRight,
  Check,
  Copy,
  Download,
  Layers,
  MoreHorizontal,
  Plus,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Empty,
  ErrorState,
  Field,
  IconButton,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  SectionHeading,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import {
  api,
  downloadCsv,
  endpoint,
  number,
  RequestError,
  shortDate,
  useRequest,
} from "@/lib/client";
import type { Channel, ListResponse } from "@/lib/types";
import {
  defaultSmsSettings,
  SMS_PROVIDERS,
  SMS_RECEIPT_EVENTS,
  type SmsGroup,
  type SmsMessage,
  type SmsSettings,
  type SmsStats,
  type SmsWorkspace,
} from "@/lib/sms";
import { smsLength } from "@/lib/sms-protocol";
import { SmsTargetField } from "@/components/sms-target-field";

type DialogState =
  | { type: "provider"; provider?: Channel }
  | { type: "group"; group?: SmsGroup }
  | { type: "test"; target: string }
  | { type: "archive" | "delete-provider"; provider: Channel }
  | { type: "delete-group"; group: SmsGroup }
  | null;
const tabs = [
  { id: "direct", label: "SMS Direct" },
  { id: "connect", label: "SMS Connect" },
  { id: "groups", label: "Provider Groups" },
  { id: "logs", label: "Delivery logs" },
];
export function SmsSettingsPage() {
  const { projectId, toast } = useWorkspace(),
    router = useRouter(),
    params = useSearchParams();
  const tab = tabs.some((t) => t.id === params.get("tab"))
    ? params.get("tab")!
    : "direct";
  const request = useRequest<{ data: SmsWorkspace }>(
    endpoint("sms", projectId),
  );
  const summary = useRequest<{ data: SmsStats }>(
    endpoint("sms/stats", projectId, { mode: "demo" }),
  );
  const [search, setSearch] = useState(""),
    [showArchived, setShowArchived] = useState(false),
    [dialog, setDialog] = useState<DialogState>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const workspace = request.data?.data;
  const refresh = () => {
    request.reload();
    summary.reload();
    setRevision((v) => v + 1);
  };
  const changeTab = (value: string) => {
    setSearch("");
    setError("");
    router.replace("/settings/channels/sms?tab=" + value);
  };
  const act = async (path: string, body?: unknown) => {
    setBusy(true);
    setError("");
    try {
      await api(endpoint(path, projectId), { method: "POST", body });
      refresh();
      toast("SMS settings updated.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  if (request.error)
    return <ErrorState message={request.error} retry={request.reload} />;
  if (!workspace) return <Loading />;
  const providers = workspace.providers.filter(
    (p) =>
      p.sms?.integration === tab &&
      (showArchived || p.status !== "Archived") &&
      (p.name + " " + p.provider).toLowerCase().includes(search.toLowerCase()),
  );
  const groups = workspace.groups.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <Link href="/settings/channels" className="back-link">
        <ArrowLeft size={15} />
        All channels
      </Link>
      <div className="sms-page-heading">
        <PageHeader
          eyebrow="CHANNEL CONFIGURATION"
          title="SMS"
          description="The right message. A reliable connection."
          actions={
            <>
              <a
                href="https://docs.clevertap.com/docs/setup-sms"
                target="_blank"
                rel="noreferrer"
                className="btn secondary"
              >
                Documentation
                <ArrowUpRight size={15} />
              </a>
              <Button
                onClick={() => setDialog({ type: "test", target: "" })}
                variant="secondary"
              >
                <Send size={15} />
                Send test SMS
              </Button>
              <Button
                onClick={() =>
                  setDialog(
                    tab === "groups" ? { type: "group" } : { type: "provider" },
                  )
                }
              >
                <Plus size={16} />
                {tab === "groups" ? "Provider Group" : "Add Provider"}
              </Button>
            </>
          }
        />
      </div>
      <div className="sms-mode-note">
        <ShieldCheck size={19} />
        <div>
          <strong>Public demo workspace</strong>
          <span>
            Explore provider setup, failover and delivery receipts with
            simulated messages. Live test sending requires owner authorization.
          </span>
        </div>
        <span className="sms-mode-pill">Demo mode</span>
      </div>
      <div className="sms-summary-grid">
        <section className="panel sms-summary">
          <span>Ready providers</span>
          <strong>
            {workspace.providers.filter((p) => p.status === "Connected").length}
            <small>
              {" "}
              /{" "}
              {
                workspace.providers.filter((p) => p.status !== "Archived")
                  .length
              }
            </small>
          </strong>
          <p>Validated for demo delivery</p>
        </section>
        <section className="panel sms-summary">
          <span>Provider groups</span>
          <strong>{workspace.groups.length}</strong>
          <p>Priority-based fallback routes</p>
        </section>
        <section className="panel sms-summary">
          <span>Demo messages sent</span>
          <strong>{number(summary.data?.data.sent || 0)}</strong>
          <p>
            {number(summary.data?.data.delivered || 0)} delivery receipts
            received
          </p>
        </section>
      </div>
      <section className="panel sms-workspace">
        <div
          className="tabs sms-tabs"
          role="tablist"
          aria-label="SMS configuration pages"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={tab === t.id ? "active" : ""}
              onClick={() => changeTab(t.id)}
            >
              {t.label}
              {t.id === "groups" ? (
                <span>{workspace.groups.length}</span>
              ) : null}
            </button>
          ))}
        </div>
        {error ? (
          <div className="inline-error" role="alert">
            {error}
          </div>
        ) : null}
        {tab === "logs" ? (
          <SmsDeliveryLogs
            key={projectId + ":" + revision}
            workspace={workspace}
          />
        ) : (
          <>
            <div className="sms-table-toolbar">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder={
                  tab === "groups"
                    ? "Search provider groups"
                    : "Search providers"
                }
              />
              {tab !== "groups" ? (
                <label className="sms-check">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(e) => setShowArchived(e.target.checked)}
                  />
                  Show archived
                </label>
              ) : (
                <span className="muted small">
                  Up to 10 providers per group
                </span>
              )}
            </div>
            <div className="sms-table-caption">
              {tab === "groups"
                ? `${groups.length} provider groups · providers are tried in priority order`
                : `${providers.length} providers · ${tab === "direct" ? "Pre-integrated SMS services" : "Custom HTTP integrations"}`}
            </div>
            {(tab === "groups" ? groups.length : providers.length) ? (
              <div className="sms-table-scroll">
                <table className="sms-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>
                        {tab === "groups"
                          ? "Provider priority"
                          : "Service provider"}
                      </th>
                      <th>{tab === "groups" ? "Availability" : "Status"}</th>
                      <th>Updated on</th>
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {tab === "groups"
                      ? groups.map((group) => {
                          const members = group.providerIds.map((id) =>
                            workspace.providers.find((p) => p.id === id),
                          );
                          return (
                            <tr key={group.id}>
                              <td>
                                <button
                                  className="sms-name"
                                  onClick={() =>
                                    setDialog({ type: "group", group })
                                  }
                                >
                                  <span className="sms-provider-symbol">
                                    <Layers size={17} />
                                  </span>
                                  <span>
                                    {group.name}
                                    {group.isDefault ? (
                                      <small>Default route</small>
                                    ) : null}
                                  </span>
                                </button>
                              </td>
                              <td>
                                <div className="sms-priority-chain">
                                  {members.map((p, i) => (
                                    <span key={group.providerIds[i]}>
                                      <b>{i + 1}</b>
                                      {p?.name || "Removed provider"}
                                      {i < members.length - 1 ? (
                                        <ArrowUpRight size={12} />
                                      ) : null}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td>
                                <Badge
                                  status={
                                    members.every(
                                      (p) => p?.status === "Connected",
                                    )
                                      ? "Connected"
                                      : "Not connected"
                                  }
                                >
                                  {members.every(
                                    (p) => p?.status === "Connected",
                                  )
                                    ? "Ready"
                                    : "Needs attention"}
                                </Badge>
                              </td>
                              <td>{shortDate(group.updatedAt)}</td>
                              <td>
                                <div className="sms-row-actions">
                                  <Button
                                    variant="ghost"
                                    onClick={() =>
                                      setDialog({
                                        type: "test",
                                        target: "group:" + group.id,
                                      })
                                    }
                                  >
                                    Test
                                  </Button>
                                  <RowMenu label={group.name}>
                                    <button
                                      onClick={() =>
                                        setDialog({ type: "group", group })
                                      }
                                    >
                                      Edit settings
                                    </button>
                                    <button
                                      disabled={busy || group.isDefault}
                                      onClick={() =>
                                        act(
                                          "sms/groups/" + group.id + "/default",
                                        )
                                      }
                                    >
                                      Mark as default
                                    </button>
                                    <button onClick={() => changeTab("logs")}>
                                      View delivery logs
                                    </button>
                                    <button
                                      className="sms-danger-text"
                                      onClick={() =>
                                        setDialog({
                                          type: "delete-group",
                                          group,
                                        })
                                      }
                                    >
                                      Delete group
                                    </button>
                                  </RowMenu>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      : providers.map((provider) => (
                          <tr key={provider.id}>
                            <td>
                              <button
                                className="sms-name"
                                onClick={() =>
                                  setDialog({ type: "provider", provider })
                                }
                              >
                                <span className="sms-provider-symbol">
                                  {provider.provider === "Twilio"
                                    ? "T"
                                    : provider.provider === "Nexmo"
                                      ? "N"
                                      : "{}"}
                                </span>
                                <span>
                                  {provider.name}
                                  {provider.sms?.isDefault ? (
                                    <small>Default provider</small>
                                  ) : null}
                                </span>
                              </button>
                            </td>
                            <td>{provider.provider}</td>
                            <td>
                              <Badge status={provider.status}>
                                {provider.status === "Connected"
                                  ? "Demo ready"
                                  : provider.status}
                              </Badge>
                            </td>
                            <td>{shortDate(provider.updatedAt)}</td>
                            <td>
                              <div className="sms-row-actions">
                                <Button
                                  variant="ghost"
                                  disabled={provider.status !== "Connected"}
                                  onClick={() =>
                                    setDialog({
                                      type: "test",
                                      target: provider.id,
                                    })
                                  }
                                >
                                  Test
                                </Button>
                                <RowMenu label={provider.name}>
                                  <button
                                    onClick={() =>
                                      setDialog({ type: "provider", provider })
                                    }
                                  >
                                    Edit settings
                                  </button>
                                  <button
                                    disabled={
                                      busy ||
                                      provider.status === "Archived" ||
                                      !!provider.sms?.isDefault
                                    }
                                    onClick={() =>
                                      act(
                                        "sms/providers/" +
                                          provider.id +
                                          "/default",
                                      )
                                    }
                                  >
                                    Mark as default
                                  </button>
                                  <button
                                    onClick={() => {
                                      router.replace(
                                        "/settings/channels/sms?tab=logs&providerId=" +
                                          provider.id,
                                      );
                                    }}
                                  >
                                    View stats & logs
                                  </button>
                                  <button
                                    disabled={provider.status === "Archived"}
                                    onClick={() =>
                                      setDialog({ type: "archive", provider })
                                    }
                                  >
                                    Archive provider
                                  </button>
                                  <button
                                    className="sms-danger-text"
                                    onClick={() =>
                                      setDialog({
                                        type: "delete-provider",
                                        provider,
                                      })
                                    }
                                  >
                                    Delete provider
                                  </button>
                                </RowMenu>
                              </div>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty
                title={
                  tab === "groups"
                    ? "Build a more resilient route"
                    : tab === "connect"
                      ? "Connect your SMS provider"
                      : "Add your first SMS provider"
                }
                description={
                  tab === "groups"
                    ? "Group providers in priority order to demonstrate automatic dispatch fallback."
                    : "Add a provider, validate its setup, then send a test message."
                }
                action={
                  <Button
                    onClick={() =>
                      setDialog(
                        tab === "groups"
                          ? { type: "group" }
                          : { type: "provider" },
                      )
                    }
                  >
                    <Plus size={15} />
                    {tab === "groups"
                      ? "Create provider group"
                      : "Add provider"}
                  </Button>
                }
              />
            )}
          </>
        )}
      </section>
      {dialog?.type === "provider" ? (
        <SmsProviderForm
          key={dialog.provider?.id || tab}
          initial={dialog.provider}
          integration={tab === "connect" ? "connect" : "direct"}
          credentials={workspace.credentials}
          onClose={() => setDialog(null)}
          onSaved={() => {
            refresh();
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.type === "group" ? (
        <SmsGroupForm
          key={dialog.group?.id || "new"}
          initial={dialog.group}
          providers={workspace.providers}
          onClose={() => setDialog(null)}
          onSaved={() => {
            refresh();
            setDialog(null);
          }}
        />
      ) : null}
      {dialog?.type === "test" ? (
        <SmsTestForm
          workspace={workspace}
          initialTarget={dialog.target}
          onClose={() => setDialog(null)}
          onSent={refresh}
        />
      ) : null}
      {dialog &&
      ["archive", "delete-provider", "delete-group"].includes(dialog.type) ? (
        <SmsRemoveDialog
          state={
            dialog as Exclude<
              DialogState,
              { type: "provider" | "group" | "test" } | null
            >
          }
          onClose={() => setDialog(null)}
          onSaved={() => {
            refresh();
            setDialog(null);
          }}
        />
      ) : null}
    </>
  );
}
function RowMenu({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false),
    [position, setPosition] = useState({ top: 0, right: 0 });
  const trigger = useRef<HTMLButtonElement>(null),
    menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (
        !trigger.current?.contains(event.target as Node) &&
        !menu.current?.contains(event.target as Node)
      )
        setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        trigger.current?.focus();
      }
    };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", escape);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", outside);
      document.removeEventListener("keydown", escape);
      window.removeEventListener("resize", close);
    };
  }, [open]);
  return (
    <div className="sms-row-menu">
      <button
        ref={trigger}
        className="icon-button"
        aria-label={"Actions for " + label}
        aria-expanded={open}
        onClick={() => {
          const bounds = trigger.current!.getBoundingClientRect();
          setPosition({
            top: Math.max(
              12,
              Math.min(bounds.bottom + 4, window.innerHeight - 238),
            ),
            right: Math.max(12, window.innerWidth - bounds.right),
          });
          setOpen(!open);
        }}
      >
        <MoreHorizontal size={19} />
      </button>
      {open
        ? createPortal(
            <div
              ref={menu}
              className="sms-action-popover"
              role="group"
              aria-label={"Actions for " + label}
              style={{ position: "fixed", ...position }}
              onClick={() => setOpen(false)}
            >
              {children}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function SmsProviderForm({
  initial,
  integration,
  credentials,
  onClose,
  onSaved,
}: {
  initial?: Channel;
  integration: "direct" | "connect";
  credentials: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { projectId, toast } = useWorkspace();
  const [name, setName] = useState(initial?.name || ""),
    [provider, setProvider] = useState(
      initial?.provider ||
        (integration === "connect" ? "Other (Generic)" : "Twilio"),
    ),
    [sms, setSms] = useState<SmsSettings>(() =>
      structuredClone(initial?.sms || defaultSmsSettings(integration)),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fields, setFields] = useState<Record<string, string>>({}),
    [copied, setCopied] = useState(false);
  const archived = initial?.status === "Archived";
  const set = <K extends keyof SmsSettings>(key: K, value: SmsSettings[K]) =>
    setSms((s) => ({ ...s, [key]: value }));
  const http = <K extends keyof SmsSettings["http"]>(
    key: K,
    value: SmsSettings["http"][K],
  ) => setSms((s) => ({ ...s, http: { ...s.http, [key]: value } }));
  const callback =
    typeof window !== "undefined" && initial
      ? window.location.origin +
        "/api/sms/callbacks/" +
        initial.id +
        "?projectId=" +
        encodeURIComponent(projectId)
      : "Generated after saving your provider";
  const save = async (validate: boolean) => {
    setBusy(true);
    setError("");
    setFields({});
    try {
      const response = await api<{ data: Channel }>(
        endpoint(
          "sms/providers" + (initial ? "/" + initial.id : ""),
          projectId,
        ),
        { method: initial ? "PATCH" : "POST", body: { name, provider, sms } },
      );
      if (validate)
        await api(
          endpoint(
            "sms/providers/" + response.data.id + "/validate",
            projectId,
          ),
          { method: "POST" },
        );
      toast(
        validate
          ? "Provider saved and validated for demo delivery."
          : "SMS provider saved.",
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
      if (e instanceof RequestError) setFields(e.fields || {});
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      drawer
      title={initial ? "SMS provider settings" : "Add SMS provider"}
      description="Configure a service provider for your SMS messages."
      onClose={onClose}
      footer={
        archived ? (
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        ) : (
          <>
            <Button
              variant="secondary"
              disabled={busy}
              onClick={() => save(false)}
            >
              Save settings
            </Button>
            <Button loading={busy} onClick={() => save(true)}>
              <Check size={15} />
              Save & validate
            </Button>
          </>
        )
      }
    >
      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}
      {archived ? (
        <div className="inline-warning">
          This provider is archived. Its historical delivery statistics remain
          available.
        </div>
      ) : null}
      <fieldset disabled={archived || busy} className="sms-fieldset">
        <SectionHeading
          title="Provider setup"
          description="Fields adapt to the service you choose."
        />
        <Field label="Provider">
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setSms({
                ...defaultSmsSettings(
                  e.target.value === "Other (Generic)" ? "connect" : "direct",
                ),
                isDefault: sms.isDefault,
              });
            }}
          >
            {SMS_PROVIDERS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Nickname" error={fields.name}>
          <input
            value={name}
            maxLength={120}
            placeholder="e.g. Twilio transactional"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        {provider === "Twilio" ? (
          <>
            <Field
              label="Account SID"
              error={fields.accountSid}
              hint="Your Twilio account identifier. Demo example: AC followed by 32 zeros."
            >
              <input
                value={sms.accountSid}
                placeholder={"AC" + "0".repeat(32)}
                onChange={(e) => set("accountSid", e.target.value)}
              />
            </Field>
            <Field
              label="From Number"
              error={fields.fromNumber}
              hint="Use an international phone number, or provide a Messaging Service SID below."
            >
              <input
                value={sms.fromNumber}
                placeholder="+12025550123"
                onChange={(e) => set("fromNumber", e.target.value)}
              />
            </Field>
            <Field
              label="Service SID (Copilot)"
              error={fields.serviceSid}
              hint="Optional. Uses your Twilio Messaging Service to select the sender."
            >
              <input
                value={sms.serviceSid}
                placeholder="MG…"
                onChange={(e) => set("serviceSid", e.target.value)}
              />
            </Field>
          </>
        ) : provider === "Nexmo" ? (
          <Field label="Sender ID / From" error={fields.senderId}>
            <input
              value={sms.senderId}
              placeholder="SHOPWISE"
              onChange={(e) => set("senderId", e.target.value)}
            />
          </Field>
        ) : null}
        <SectionHeading
          title="Credentials"
          description="Live credentials are managed by the deployment owner and never returned to this public workspace."
        />
        <Field
          label="Credential profile"
          hint="Leave this as Demo to explore the full setup without a provider account."
        >
          <select
            value={sms.credentialRef}
            onChange={(e) => set("credentialRef", e.target.value)}
          >
            <option value="">Demo · no live credentials</option>
            {credentials.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        {provider !== "Other (Generic)" ? (
          <Field
            label={provider === "Twilio" ? "Auth token" : "API key & secret"}
          >
            <input
              type="password"
              readOnly
              disabled
              value={sms.credentialRef ? "server-managed-secret" : ""}
              placeholder="Managed by your credential profile"
              autoComplete="off"
            />
          </Field>
        ) : null}
        {provider === "Other (Generic)" ? (
          <>
            <SectionHeading
              title="HTTP configuration"
              description="Map your provider's HTTP request to SMS fields."
            />
            <div className="form-grid">
              <Field label="Request Type">
                <select
                  value={sms.http.method}
                  onChange={(e) =>
                    http("method", e.target.value as "GET" | "POST")
                  }
                >
                  <option>POST</option>
                  <option>GET</option>
                </select>
              </Field>
              <Field label="Parameters format">
                <select
                  value={sms.http.format}
                  onChange={(e) =>
                    http("format", e.target.value as "json" | "form")
                  }
                >
                  <option value="json">JSON</option>
                  <option value="form">Key-value pairs (form)</option>
                </select>
              </Field>
            </div>
            <Field label="HTTP Endpoint" error={fields.endpoint}>
              <input
                value={sms.http.endpoint}
                placeholder="https://sms.example.com/send"
                onChange={(e) => http("endpoint", e.target.value)}
              />
            </Field>
            <Field label="Authentication">
              <select
                value={sms.http.authentication}
                onChange={(e) =>
                  http(
                    "authentication",
                    e.target.value as SmsSettings["http"]["authentication"],
                  )
                }
              >
                <option value="none">No Authentication</option>
                <option value="basic">Basic Authentication</option>
                <option value="oauth2">OAuth 2.0 · Client Credentials</option>
              </select>
            </Field>
            {sms.http.authentication === "oauth2" ? (
              <Field label="Token endpoint" error={fields.tokenEndpoint}>
                <input
                  value={sms.http.tokenEndpoint}
                  onChange={(e) => http("tokenEndpoint", e.target.value)}
                  placeholder="https://sms.example.com/oauth/token"
                />
              </Field>
            ) : null}
            {sms.http.authentication !== "none" ? (
              <p className="field-hint">
                {sms.http.authentication === "basic"
                  ? "Username and password"
                  : "Client ID and client secret"}{" "}
                are supplied by your credential profile.
              </p>
            ) : null}
            <div className="sms-subheading">
              <strong>Headers</strong>
              <Button
                variant="ghost"
                onClick={() =>
                  http("headers", [...sms.http.headers, { key: "", value: "" }])
                }
              >
                <Plus size={14} />
                Add pair
              </Button>
            </div>
            {sms.http.headers.map((header, i) => (
              <div className="sms-header-pair" key={i}>
                <Field label={"Header name " + (i + 1)}>
                  <input
                    value={header.key}
                    placeholder="Authorization"
                    onChange={(e) =>
                      http(
                        "headers",
                        sms.http.headers.map((h, j) =>
                          j === i ? { ...h, key: e.target.value } : h,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label={"Header value " + (i + 1)}>
                  <input
                    value={header.value}
                    placeholder="Bearer $$Secret_apiKey"
                    onChange={(e) =>
                      http(
                        "headers",
                        sms.http.headers.map((h, j) =>
                          j === i ? { ...h, value: e.target.value } : h,
                        ),
                      )
                    }
                  />
                </Field>
                <IconButton
                  label={"Remove header " + (i + 1)}
                  onClick={() =>
                    http(
                      "headers",
                      sms.http.headers.filter((_, j) => i !== j),
                    )
                  }
                >
                  <X size={15} />
                </IconButton>
              </div>
            ))}
            {fields.headers ? (
              <p className="field-error" role="alert">
                {fields.headers}
              </p>
            ) : null}
            <Field
              label="Parameters"
              error={fields.payload}
              hint="Use $$To and $$Body or $$TemplateID. Add $$MessageID for delivery callbacks."
            >
              <textarea
                className="sms-code-input"
                rows={9}
                value={sms.http.payload}
                onChange={(e) => http("payload", e.target.value)}
              />
            </Field>
            <label className="sms-check">
              <input
                type="checkbox"
                checked={sms.http.batch}
                onChange={(e) => http("batch", e.target.checked)}
              />
              Enable batching
            </label>
            {sms.http.batch ? (
              <div className="form-grid">
                <Field label="Batch key">
                  <input
                    value={sms.http.batchKey}
                    onChange={(e) => http("batchKey", e.target.value)}
                  />
                </Field>
                <Field
                  label="Records per batch"
                  hint="1–1,000 records. Test sends contain one record."
                >
                  <input
                    type="number"
                    min={1}
                    max={1000}
                    value={sms.http.batchSize}
                    onChange={(e) => http("batchSize", Number(e.target.value))}
                  />
                </Field>
              </div>
            ) : null}
          </>
        ) : null}
        <SectionHeading title="Delivery settings" />
        <Field
          label="Callback URL"
          hint={
            provider === "Twilio"
              ? "Status callbacks are supplied automatically with a live Twilio test request."
              : provider === "Nexmo"
                ? "Enable signed delivery callbacks in your Vonage account and configure its signature secret."
                : "Use signed JSON events to report delivery, clicks, replies or errors."
          }
        >
          <div className="sms-copy-field">
            <input readOnly value={callback} />
            <IconButton
              label="Copy callback URL"
              disabled={!initial}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(callback);
                  setCopied(true);
                } catch {
                  setError(
                    "Copy is unavailable. Select the callback URL to copy it.",
                  );
                }
              }}
            >
              {copied ? <Check size={15} /> : <Copy size={15} />}
            </IconButton>
          </div>
        </Field>
        <label className="sms-check">
          <input
            type="checkbox"
            checked={sms.requireTemplateId}
            onChange={(e) => set("requireTemplateId", e.target.checked)}
          />
          Require Template ID
        </label>
        {sms.requireTemplateId ? (
          <Field
            label="Template ID"
            error={fields.templateId}
            hint="Use the identifier approved for your provider and destination region."
          >
            <input
              value={sms.templateId}
              onChange={(e) => set("templateId", e.target.value)}
            />
          </Field>
        ) : null}
        <label className="sms-check">
          <input
            type="checkbox"
            checked={sms.isDefault}
            onChange={(e) => set("isDefault", e.target.checked)}
          />
          Mark this as default
        </label>
        <details className="sms-advanced">
          <summary>Demo behavior</summary>
          <Field
            label="Dispatch result"
            hint="Choose rejection on the first provider to test a group's fallback route."
          >
            <select
              value={sms.demoBehavior}
              onChange={(e) =>
                set("demoBehavior", e.target.value as "accept" | "reject")
              }
            >
              <option value="accept">Accept the message</option>
              <option value="reject">
                Reject before dispatch (test fallback)
              </option>
            </select>
          </Field>
        </details>
      </fieldset>
    </Modal>
  );
}

function SmsGroupForm({
  initial,
  providers,
  onClose,
  onSaved,
}: {
  initial?: SmsGroup;
  providers: Channel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { projectId, toast } = useWorkspace();
  const [name, setName] = useState(initial?.name || ""),
    [ids, setIds] = useState(initial?.providerIds || []),
    [isDefault, setDefault] = useState(initial?.isDefault || false),
    [add, setAdd] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const move = (index: number, offset: number) =>
    setIds((previous) => {
      const next = [...previous];
      [next[index], next[index + offset]] = [next[index + offset], next[index]];
      return next;
    });
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api(
        endpoint("sms/groups" + (initial ? "/" + initial.id : ""), projectId),
        {
          method: initial ? "PATCH" : "POST",
          body: { name, providerIds: ids, isDefault },
        },
      );
      toast("Provider group saved.");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      drawer
      title={initial ? "Edit provider group" : "Add provider group"}
      description="Choose providers in the order they should be tried."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} onClick={save}>
            Save Provider Group
          </Button>
        </>
      }
    >
      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}
      <Field label="Group name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Transactional SMS fallback"
          maxLength={120}
        />
      </Field>
      <SectionHeading
        title="Provider priority"
        description="Fallback runs after a definite dispatch rejection. An unknown response stops the route to avoid duplicate messages."
      />
      <ol className="sms-priority-list">
        {ids.map((id, i) => {
          const p = providers.find((p) => p.id === id);
          return (
            <li key={id}>
              <span className="sms-priority-number">{i + 1}</span>
              <div>
                <strong>{p?.name || "Removed provider"}</strong>
                <small>
                  {p?.provider} ·{" "}
                  {p?.status === "Connected" ? "Demo ready" : p?.status}
                </small>
              </div>
              <IconButton
                label={"Move " + p?.name + " up"}
                disabled={i === 0}
                onClick={() => move(i, -1)}
              >
                <ArrowUp size={15} />
              </IconButton>
              <IconButton
                label={"Move " + p?.name + " down"}
                disabled={i === ids.length - 1}
                onClick={() => move(i, 1)}
              >
                <ArrowDown size={15} />
              </IconButton>
              <IconButton
                label={"Remove " + p?.name}
                onClick={() => setIds(ids.filter((v) => v !== id))}
              >
                <X size={15} />
              </IconButton>
            </li>
          );
        })}
      </ol>
      <div className="sms-add-provider">
        <Field label="Add a provider">
          <select value={add} onChange={(e) => setAdd(e.target.value)}>
            <option value="">Choose a validated provider</option>
            {providers
              .filter((p) => p.status === "Connected" && !ids.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.provider}
                </option>
              ))}
          </select>
        </Field>
        <Button
          variant="secondary"
          disabled={!add || ids.length >= 10}
          onClick={() => {
            setIds([...ids, add]);
            setAdd("");
          }}
        >
          <Plus size={15} />
          Add
        </Button>
      </div>
      <label className="sms-check">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setDefault(e.target.checked)}
        />
        Mark this group as the default SMS route
      </label>
    </Modal>
  );
}

function SmsTestForm({
  workspace,
  initialTarget,
  onClose,
  onSent,
}: {
  workspace: SmsWorkspace;
  initialTarget: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { projectId } = useWorkspace();
  const [target, setTarget] = useState(initialTarget),
    [to, setTo] = useState("+12025550123"),
    [body, setBody] = useState("Hello! This is a test message from Shopwise."),
    [mode, setMode] = useState<"demo" | "live">("demo"),
    [token, setToken] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [result, setResult] = useState<SmsMessage | null>(null),
    [key, setKey] = useState(() => crypto.randomUUID());
  const length = smsLength(body);
  const send = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await api<{ data: SmsMessage }>(
        endpoint("sms/test", projectId),
        {
          method: "POST",
          body: { target, to, body, mode, idempotencyKey: key },
          headers:
            mode === "live" ? { Authorization: "Bearer " + token } : undefined,
        },
      );
      setResult(response.data);
      setToken("");
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const receipt = async (event: string) => {
    if (!result) return;
    setBusy(true);
    setError("");
    try {
      const response = await api<{ data: SmsMessage }>(
        endpoint("sms/messages/" + result.id + "/receipt", projectId),
        { method: "POST", body: { event } },
      );
      setResult(response.data);
      onSent();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      drawer
      title="Send test SMS"
      description="Check your configuration before building a campaign."
      onClose={onClose}
      footer={
        result ? (
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setResult(null);
                setKey(crypto.randomUUID());
              }}
            >
              New test message
            </Button>
            <Button onClick={onClose}>Done</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button loading={busy} onClick={send}>
              <Send size={15} />
              {mode === "demo" ? "Send demo SMS" : "Send live test SMS"}
            </Button>
          </>
        )
      }
    >
      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}
      {result ? (
        <>
          <div
            className={
              result.status === "Failed" || result.status === "Unknown"
                ? "inline-warning"
                : "inline-success"
            }
            role="status"
          >
            <div>
              <strong>
                {result.mode === "demo" ? "Demo message" : "Live test"}:{" "}
                {result.status}
              </strong>
              <p>
                {result.status === "Sent"
                  ? "Accepted by the provider. Delivery is confirmed only after a receipt."
                  : result.errorCode || "Receipt recorded."}
              </p>
            </div>
          </div>
          <div className="sms-message-preview">
            <span>To {result.to}</span>
            <p>{result.body}</p>
            <small>
              {length.encoding} · {length.parts} SMS{" "}
              {length.parts === 1 ? "part" : "parts"}
            </small>
          </div>
          <SectionHeading title="Dispatch attempts" />
          <ol className="sms-attempts">
            {result.attempts.map((a, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                <div>
                  <strong>
                    {workspace.providers.find((p) => p.id === a.providerId)
                      ?.name || a.providerId}
                  </strong>
                  <small>
                    {a.outcome}
                    {a.errorCode ? " · " + a.errorCode : ""}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          {result.mode === "demo" && result.providerMessageId ? (
            <>
              <SectionHeading
                title="Simulate a delivery receipt"
                description="These events update the same delivery log and statistics used by authenticated live callbacks."
              />
              <div className="sms-receipt-buttons">
                {SMS_RECEIPT_EVENTS.map((event) => (
                  <Button
                    key={event}
                    variant="secondary"
                    disabled={
                      busy ||
                      result.receipts.some((r) => r.event === event) ||
                      (["delivered", "failed"].includes(event) &&
                        ["Delivered", "Failed"].includes(result.status))
                    }
                    onClick={() => receipt(event)}
                  >
                    {event[0].toUpperCase() + event.slice(1)}
                  </Button>
                ))}
              </div>
            </>
          ) : null}
          {result.receipts.length ? (
            <ul className="sms-receipt-history">
              {result.receipts.map((r) => (
                <li key={r.event}>
                  <Check size={13} />
                  {r.event}
                  <small>{new Date(r.at).toLocaleTimeString()}</small>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : (
        <>
          <SmsTargetField
            workspace={workspace}
            value={target}
            onChange={(value) => {
              setTarget(value);
              setKey(crypto.randomUUID());
            }}
          />
          <Field label="Send mode">
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as "demo" | "live");
                setKey(crypto.randomUUID());
              }}
            >
              <option value="demo">Demo · simulated dispatch</option>
              <option value="live" disabled={!workspace.liveEnabled}>
                Live test
                {workspace.liveEnabled ? "" : " · not enabled by the owner"}
              </option>
            </select>
          </Field>
          {mode === "live" ? (
            <Field
              label="Sending access token"
              hint="Required for each authorized live test. The recipient must also be allowed by the owner."
            >
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
              />
            </Field>
          ) : null}
          <Field
            label="Mobile number"
            hint="Include the country code, for example +12025550123."
          >
            <input
              type="tel"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setKey(crypto.randomUUID());
              }}
            />
          </Field>
          <Field label="Message">
            <textarea
              rows={5}
              maxLength={1600}
              value={body}
              onChange={(e) => {
                setBody(e.target.value);
                setKey(crypto.randomUUID());
              }}
            />
          </Field>
          <p className="sms-length">
            {length.units} {length.encoding} units <span>·</span> {length.parts}{" "}
            SMS {length.parts === 1 ? "part" : "parts"}
          </p>
          <div className="aside-note">
            <ShieldCheck size={18} />
            <p>
              {mode === "demo"
                ? "Demo tests never contact a provider or send a text to this number. You can simulate delivery and engagement receipts after dispatch."
                : "This sends a real SMS through the selected provider. Provider charges may apply."}
            </p>
          </div>
        </>
      )}
    </Modal>
  );
}

function SmsDeliveryLogs({ workspace }: { workspace: SmsWorkspace }) {
  const { projectId } = useWorkspace(),
    params = useSearchParams();
  const [providerId, setProvider] = useState(params.get("providerId") || ""),
    [mode, setMode] = useState("demo"),
    [status, setStatus] = useState("All"),
    [search, setSearch] = useState(""),
    [page, setPage] = useState(1),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [selected, setSelected] = useState<SmsMessage | null>(null),
    [actionError, setActionError] = useState("");
  const query = { providerId, mode, status, search, page, from, to };
  const request = useRequest<ListResponse<SmsMessage>>(
    endpoint("sms/messages", projectId, query),
  );
  const statsRequest = useRequest<{ data: SmsStats }>(
    endpoint("sms/stats", projectId, query),
  );
  const stats = statsRequest.data?.data;
  const exportData = async () => {
    setActionError("");
    try {
      const response = await api<ListResponse<SmsMessage>>(
        endpoint("sms/messages", projectId, {
          ...query,
          pageSize: 100,
          page: 1,
        }),
      );
      downloadCsv(
        response.data.map((m) => ({
          id: m.id,
          to: m.to,
          provider:
            workspace.providers.find((p) => p.id === m.providerId)?.name ||
            m.providerId,
          mode: m.mode,
          status: m.status,
          errorCode: m.errorCode,
          sentAt: m.createdAt,
        })),
        "sms-delivery-logs",
      );
    } catch (e) {
      setActionError((e as Error).message);
    }
  };
  return (
    <div className="sms-logs">
      <div className="sms-log-filters">
        <Field label="Provider">
          <select
            value={providerId}
            onChange={(e) => {
              setProvider(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All providers</option>
            {workspace.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Message mode">
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value);
              setPage(1);
            }}
          >
            <option value="demo">Demo messages</option>
            <option value="live">Live messages</option>
          </select>
        </Field>
        <Field label="From date">
          <input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <Field label="To date">
          <input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              setPage(1);
            }}
          />
        </Field>
      </div>
      {statsRequest.error ? (
        <div className="inline-error" role="alert">
          {statsRequest.error}
        </div>
      ) : null}
      <div className="sms-stat-strip">
        {[
          { name: "Total sent", value: stats?.sent || 0 },
          { name: "Delivered", value: stats?.delivered || 0 },
          { name: "Clicked", value: stats?.clicked || 0 },
          { name: "Replied", value: stats?.replied || 0 },
          { name: "Errors", value: stats?.errors || 0 },
          {
            name: "Delivery rate",
            value: (stats?.deliveryRate || 0).toFixed(1) + "%",
          },
        ].map((s) => (
          <div key={s.name}>
            <span>{s.name}</span>
            <strong>
              {typeof s.value === "number" ? number(s.value) : s.value}
            </strong>
          </div>
        ))}
      </div>
      {stats?.daily.length ? (
        <div className="sms-delivery-chart">
          <div className="sms-subheading">
            <strong>Daily delivery activity</strong>
            <small>Sent / delivered / errors · UTC</small>
          </div>
          <div className="sms-chart-bars">
            {stats.daily.slice(-14).map((day) => (
              <div
                key={day.date}
                className="sms-chart-day"
                title={`${day.date}: ${day.sent} sent, ${day.delivered} delivered, ${day.errors} errors`}
              >
                <div>
                  <i
                    style={{
                      height: Math.max(
                        3,
                        (day.sent /
                          Math.max(...stats.daily.map((d) => d.sent), 1)) *
                          65,
                      ),
                    }}
                  />
                  <i
                    className="delivered"
                    style={{
                      height: Math.max(
                        3,
                        (day.delivered /
                          Math.max(...stats.daily.map((d) => d.sent), 1)) *
                          65,
                      ),
                    }}
                  />
                  <i
                    className="failed"
                    style={{
                      height: Math.max(
                        3,
                        (day.errors /
                          Math.max(...stats.daily.map((d) => d.sent), 1)) *
                          65,
                      ),
                    }}
                  />
                </div>
                <small>{day.date.slice(5)}</small>
                <span className="sr-only">
                  {day.sent} sent, {day.delivered} delivered, {day.errors}{" "}
                  errors
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      <div className="sms-table-toolbar">
        <SearchInput
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search number, message or ID"
        />
        <div className="sms-row-actions">
          <select
            aria-label="Delivery status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            {["All", "Sent", "Delivered", "Failed", "Unknown"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Button
            variant="secondary"
            onClick={exportData}
            disabled={!request.data?.data.length}
          >
            <Download size={15} />
            Export first 100
          </Button>
        </div>
      </div>
      {actionError ? (
        <div className="inline-error" role="alert">
          {actionError}
        </div>
      ) : null}
      {request.error ? (
        <ErrorState message={request.error} retry={request.reload} />
      ) : !request.data ? (
        <Loading />
      ) : request.data.data.length ? (
        <>
          <div className="sms-table-scroll">
            <table className="sms-table">
              <thead>
                <tr>
                  <th>Recipient / Message</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Engagement</th>
                  <th>Sent at</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {request.data.data.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.to}</strong>
                      <span className="sms-message-excerpt">{m.body}</span>
                    </td>
                    <td>
                      {workspace.providers.find((p) => p.id === m.providerId)
                        ?.name || "Deleted provider"}
                      <small className="sms-muted-block">
                        {m.attempts.length} dispatch{" "}
                        {m.attempts.length === 1 ? "attempt" : "attempts"}
                      </small>
                    </td>
                    <td>
                      <Badge status={m.status} />
                      {m.errorCode ? (
                        <small className="sms-error-code">{m.errorCode}</small>
                      ) : null}
                    </td>
                    <td>
                      {m.clicked ? "Clicked" : "—"}
                      {m.replied ? " · Replied" : ""}
                    </td>
                    <td>{new Date(m.createdAt).toLocaleString()}</td>
                    <td>
                      <Button variant="ghost" onClick={() => setSelected(m)}>
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination meta={request.data.meta} onPage={setPage} />
        </>
      ) : (
        <Empty
          title="No SMS messages yet"
          description="Send a test SMS to see dispatch attempts, delivery receipts and errors here."
        />
      )}
      {selected ? (
        <Modal
          drawer
          title="SMS message details"
          description={selected.id}
          onClose={() => setSelected(null)}
          footer={<Button onClick={() => setSelected(null)}>Done</Button>}
        >
          <Badge status={selected.status} />
          <div className="sms-message-preview">
            <span>
              {selected.mode.toUpperCase()} · {selected.to}
            </span>
            <p>{selected.body}</p>
          </div>
          <SectionHeading title="Dispatch attempts" />
          <ol className="sms-attempts">
            {selected.attempts.map((a, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                <div>
                  <strong>
                    {workspace.providers.find((p) => p.id === a.providerId)
                      ?.name || a.providerId}
                  </strong>
                  <small>
                    {a.outcome}
                    {a.errorCode ? " · " + a.errorCode : ""}
                  </small>
                </div>
              </li>
            ))}
          </ol>
          <SectionHeading title="Receipt timeline" />
          {selected.receipts.length ? (
            <ul className="sms-receipt-history">
              {selected.receipts.map((r) => (
                <li key={r.event}>
                  <Activity size={13} />
                  {r.event}
                  <small>
                    {r.source} · {new Date(r.at).toLocaleString()}
                  </small>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No delivery receipt received yet.</p>
          )}
        </Modal>
      ) : null}
    </div>
  );
}
type RemoveState =
  | { type: "archive" | "delete-provider"; provider: Channel }
  | { type: "delete-group"; group: SmsGroup };
function SmsRemoveDialog({
  state,
  onClose,
  onSaved,
}: {
  state: RemoveState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { projectId, toast } = useWorkspace();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ack, setAck] = useState(false);
  const impact = useRequest<{
    data: {
      affected: {
        campaigns: { id: string; name: string }[];
        journeys: { id: string; name: string }[];
      };
    };
  }>(
    state.type === "archive"
      ? endpoint("sms/providers/" + state.provider.id + "/impact", projectId)
      : null,
  );
  const execute = async () => {
    setBusy(true);
    setError("");
    try {
      const path =
        state.type === "delete-group"
          ? "sms/groups/" + state.group.id
          : "sms/providers/" +
            state.provider.id +
            (state.type === "archive" ? "/archive" : "");
      await api(endpoint(path, projectId), {
        method: state.type === "archive" ? "POST" : "DELETE",
        body: state.type === "archive" ? { confirm: true } : undefined,
      });
      toast(
        state.type === "archive"
          ? "Provider archived."
          : "SMS configuration deleted.",
      );
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const name =
    state.type === "delete-group" ? state.group.name : state.provider.name;
  return (
    <Modal
      title={(state.type === "archive" ? "Archive " : "Delete ") + name + "?"}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="danger"
            loading={busy}
            disabled={!ack || (state.type === "archive" && !impact.data)}
            onClick={execute}
          >
            {state.type === "archive" ? "Archive provider" : "Delete"}
          </Button>
        </>
      }
    >
      <p>
        {state.type === "archive"
          ? "Archiving is permanent. Active campaigns and journeys using this provider will stop. Historical delivery logs are retained."
          : state.type === "delete-group"
            ? "The provider group will be permanently removed. Providers and delivery logs are retained."
            : "The provider and its delivery logs will be permanently removed. Groups and engagements must release their references first."}
      </p>
      {state.type === "archive" ? (
        impact.error ? (
          <ErrorState message={impact.error} retry={impact.reload} />
        ) : !impact.data ? (
          <Loading />
        ) : (
          <div className="sms-impact">
            <strong>Affected engagements</strong>
            {[
              ...impact.data.data.affected.campaigns,
              ...impact.data.data.affected.journeys,
            ].length ? (
              <ul>
                {[
                  ...impact.data.data.affected.campaigns,
                  ...impact.data.data.affected.journeys,
                ].map((i) => (
                  <li key={i.id}>{i.name}</li>
                ))}
              </ul>
            ) : (
              <p>No active campaigns or journeys will be stopped.</p>
            )}
          </div>
        )
      ) : null}
      <label className="sms-check">
        <input
          type="checkbox"
          checked={ack}
          onChange={(e) => setAck(e.target.checked)}
        />
        I understand this action cannot be undone.
      </label>
      {error ? (
        <div className="inline-error" role="alert">
          {error}
        </div>
      ) : null}
    </Modal>
  );
}
