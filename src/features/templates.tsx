"use client";
import { MessageEditor, MessagePreview } from "@/components/message-editor";
import { useTableState } from "@/components/table-state";
import {
  Button,
  ChannelIcon,
  Empty,
  ErrorState,
  Field,
  Loading,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { api, endpoint, useRequest } from "@/lib/client";
import {
  CHANNELS,
  EMPTY_CONTENT,
  type ChannelType,
  type ListResponse,
  type MessageTemplate,
} from "@/lib/types";
import { ArrowLeft, ArrowUpRight, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteDialog } from "./resource-list";

export function Templates() {
  const { projectId, toast } = useWorkspace(),
    router = useRouter(),
    state = useTableState();
  const [create, setCreate] = useState(false),
    [name, setName] = useState(""),
    [channel, setChannel] = useState<ChannelType>("Email"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRequest<ListResponse<MessageTemplate>>(
    endpoint("templates", projectId, { ...state.query, pageSize: 8 }),
  );
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ data: MessageTemplate }>(
        endpoint("templates", projectId),
        { method: "POST", body: { name, channel, category: "Promotional" } },
      );
      toast("Template created.");
      router.push("/templates/" + result.data.id);
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageHeader
        eyebrow="CONTENT THAT CONNECTS"
        title="Templates"
        description="A thoughtful starting point for every conversation."
        actions={
          <Button onClick={() => setCreate(true)}>
            <Plus size={17} />
            Create template
          </Button>
        }
      />
      <div className="template-channel-tabs">
        {["All", ...CHANNELS.slice(0, 4)].map((item) => (
          <button
            key={item}
            className={state.channel === item ? "active" : ""}
            onClick={() => state.update({ channel: item })}
          >
            {item !== "All" ? <ChannelIcon channel={item} size={16} /> : null}
            {item === "All" ? "All templates" : item}
          </button>
        ))}
      </div>
      <div className="gallery-toolbar">
        <SearchInput
          value={state.search}
          onChange={(search) => state.update({ search })}
          placeholder="Find a template..."
        />
        <span className="muted small">
          {request.data?.meta.total ?? 0} templates to make your own
        </span>
      </div>
      {request.error ? (
        <ErrorState message={request.error} retry={request.reload} />
      ) : request.loading ? (
        <Loading />
      ) : request.data?.data.length ? (
        <>
          <div className="template-grid">
            {request.data.data.map((template) => (
              <Link
                className="template-card"
                href={"/templates/" + template.id}
                key={template.id}
              >
                <div className="template-thumbnail">
                  <MessagePreview
                    channel={template.channel}
                    content={template.content}
                    small
                  />
                  <span className="template-hover">
                    Make it yours
                    <ArrowUpRight size={16} />
                  </span>
                </div>
                <div className="template-card-info">
                  <div>
                    <h3>{template.name}</h3>
                    <span>{template.category}</span>
                  </div>
                  <ChannelIcon channel={template.channel} boxed />
                </div>
              </Link>
            ))}
          </div>
          <Pagination
            meta={request.data.meta}
            onPage={(page) => state.update({ page })}
          />
        </>
      ) : (
        <Empty
          title="A blank canvas awaits"
          description="Create a template for the moments that matter."
          action={
            <Button onClick={() => setCreate(true)}>
              <Plus size={16} />
              Create template
            </Button>
          }
        />
      )}
      {create ? (
        <Modal
          title="Create a template"
          description="Give your next great message a place to start."
          onClose={() => setCreate(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setCreate(false)}>
                Cancel
              </Button>
              <Button onClick={save} loading={busy}>
                Create template
              </Button>
            </>
          }
        >
          <Field label="Template name">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. A warm welcome"
            />
          </Field>
          <Field label="Channel">
            <select
              value={channel}
              onChange={(e) => setChannel(e.target.value as ChannelType)}
            >
              {CHANNELS.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          {error ? <div className="inline-error">{error}</div> : null}
        </Modal>
      ) : null}
    </>
  );
}
export function TemplateDetail({ id }: { id: string }) {
  const { projectId } = useWorkspace(),
    request = useRequest<{ data: MessageTemplate }>(
      endpoint("templates/" + id, projectId),
    );
  if (request.error)
    return <ErrorState message={request.error} retry={request.reload} />;
  if (!request.data) return <Loading />;
  return <TemplateEditor key={id + projectId} initial={request.data.data} />;
}
function TemplateEditor({ initial }: { initial: MessageTemplate }) {
  const { projectId, toast } = useWorkspace(),
    router = useRouter(),
    [name, setName] = useState(initial.name),
    [category, setCategory] = useState(initial.category),
    [content, setContent] = useState({ ...EMPTY_CONTENT, ...initial.content }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleting, setDeleting] = useState(false);
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await api(endpoint("templates/" + initial.id, projectId), {
        method: "PATCH",
        body: { name, category, content },
      });
      toast("Template saved. Ready for your next campaign.");
    } catch (error) {
      setError((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Link className="back-link" href="/templates">
        <ArrowLeft size={15} />
        All templates
      </Link>
      <PageHeader
        eyebrow={initial.channel.toUpperCase() + " TEMPLATE"}
        title={name || "Untitled template"}
        description="A message worth making your own."
        actions={
          <>
            <Button variant="secondary" onClick={() => setDeleting(true)}>
              <Trash2 size={15} />
              Delete
            </Button>
            <Link
              className="btn secondary"
              href={
                "/campaigns/new?templateId=" +
                initial.id +
                "&channel=" +
                encodeURIComponent(initial.channel)
              }
            >
              <Plus size={15} />
              Use in campaign
            </Link>
            <Button onClick={save} loading={busy}>
              <Save size={16} />
              Save changes
            </Button>
          </>
        }
      />
      {error ? <div className="inline-error">{error}</div> : null}
      <div className="content-editor-grid">
        <section className="panel form-panel">
          <div className="form-grid">
            <Field label="Template name">
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Category">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {[
                  "Welcome",
                  "Promotional",
                  "Transactional",
                  "Re-engagement",
                ].map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="form-divider" />
          <MessageEditor
            channel={initial.channel}
            content={content}
            onChange={setContent}
          />
        </section>
        <aside className="sticky-preview">
          <MessagePreview channel={initial.channel} content={content} />
        </aside>
      </div>
      {deleting ? (
        <DeleteDialog
          resource="templates"
          item={initial}
          onClose={() => setDeleting(false)}
          onDeleted={() => router.push("/templates")}
        />
      ) : null}
    </>
  );
}
