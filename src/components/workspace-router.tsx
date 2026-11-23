"use client";
import { ResourceList } from "@/features/resource-list";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Empty, Loading } from "./ui";
const loading = () => <Loading />;
const Overview = dynamic(
  () => import("@/features/overview").then((m) => m.Overview),
  { loading },
);
const Boards = dynamic(
  () => import("@/features/boards").then((m) => m.Boards),
  { loading },
);
const BoardDetail = dynamic(
  () => import("@/features/boards").then((m) => m.BoardDetail),
  { loading },
);
const Trends = dynamic(
  () => import("@/features/analytics").then((m) => m.Trends),
  { loading },
);
const Funnels = dynamic(
  () => import("@/features/analytics").then((m) => m.Funnels),
  { loading },
);
const SegmentEditor = dynamic(
  () => import("@/features/segments").then((m) => m.SegmentEditorPage),
  { loading },
);
const SegmentDetail = dynamic(
  () => import("@/features/segments").then((m) => m.SegmentDetail),
  { loading },
);
const People = dynamic(
  () => import("@/features/people").then((m) => m.People),
  { loading },
);
const PersonDetail = dynamic(
  () => import("@/features/people").then((m) => m.PersonDetail),
  { loading },
);
const CampaignEditor = dynamic(
  () => import("@/features/campaigns").then((m) => m.CampaignEditorPage),
  { loading },
);
const CampaignDetail = dynamic(
  () => import("@/features/campaigns").then((m) => m.CampaignDetail),
  { loading },
);
const Templates = dynamic(
  () => import("@/features/templates").then((m) => m.Templates),
  { loading },
);
const TemplateDetail = dynamic(
  () => import("@/features/templates").then((m) => m.TemplateDetail),
  { loading },
);
const JourneyEditor = dynamic(
  () => import("@/features/journeys").then((m) => m.JourneyEditorPage),
  { loading, ssr: false },
);
const JourneyDetail = dynamic(
  () => import("@/features/journeys").then((m) => m.JourneyDetail),
  { loading, ssr: false },
);
const Schema = dynamic(
  () => import("@/features/schema").then((m) => m.Schema),
  { loading },
);
const Channels = dynamic(
  () => import("@/features/settings").then((m) => m.Channels),
  { loading },
);
const ProjectSettings = dynamic(
  () => import("@/features/settings").then((m) => m.ProjectSettings),
  { loading },
);
const SmsSettings = dynamic(
  () => import("@/features/sms").then((m) => m.SmsSettingsPage),
  { loading },
);
export function WorkspaceRouter() {
  const path = usePathname().split("/").filter(Boolean).map(decodeURIComponent),
    [section, id, mode] = path;
  if (section === "overview") return <Overview />;
  if (section === "boards") return id ? <BoardDetail id={id} /> : <Boards />;
  if (section === "analytics") {
    if (id === "funnels") return <Funnels />;
    if (id === "events" && mode) return <Trends key={mode} eventName={mode} />;
    return <Trends />;
  }
  if (section === "segments")
    return id === "new" || mode === "edit" ? (
      <SegmentEditor id={id === "new" ? undefined : id} />
    ) : id ? (
      <SegmentDetail id={id} />
    ) : (
      <ResourceList resource="segments" />
    );
  if (section === "people") return id ? <PersonDetail id={id} /> : <People />;
  if (section === "campaigns")
    return id === "new" || mode === "edit" ? (
      <CampaignEditor id={id === "new" ? undefined : id} />
    ) : id ? (
      <CampaignDetail id={id} />
    ) : (
      <ResourceList resource="campaigns" />
    );
  if (section === "templates")
    return id ? <TemplateDetail id={id} /> : <Templates />;
  if (section === "journeys")
    return id === "new" || mode === "edit" ? (
      <JourneyEditor id={id === "new" ? undefined : id} />
    ) : id ? (
      <JourneyDetail id={id} />
    ) : (
      <ResourceList resource="journeys" />
    );
  if (section === "data" && id === "schema") return <Schema />;
  if (section === "settings" && id === "channels" && mode === "sms")
    return <SmsSettings />;
  if (section === "settings")
    return id === "channels" ? <Channels /> : <ProjectSettings />;
  return (
    <Empty
      title="This page has moved"
      action={
        <Link className="btn primary" href="/overview">
          Back to overview
        </Link>
      }
    />
  );
}
