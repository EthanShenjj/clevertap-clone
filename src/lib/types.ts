export const CHANNELS = [
  "Push",
  "Email",
  "In-App",
  "Web Pop-up",
  "SMS",
  "WhatsApp",
  "Web Push",
  "RCS",
] as const;
export type ChannelType = (typeof CHANNELS)[number];
export type Resource =
  "segments" | "campaigns" | "templates" | "channels" | "journeys" | "boards";
export const RESOURCES: Resource[] = [
  "segments",
  "campaigns",
  "templates",
  "channels",
  "journeys",
  "boards",
];
export interface Project {
  id: string;
  name: string;
  timezone: string;
  website: string;
  currency: string;
  demoDate: string;
}
export interface BaseEntity {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  createdBy: string;
}
export interface Rule {
  id: string;
  kind: "property" | "event";
  field: string;
  operator:
    | "equals"
    | "not_equals"
    | "contains"
    | "greater_than"
    | "less_than"
    | "did"
    | "did_not";
  value: string;
  days: number;
}
export interface RuleGroup {
  combinator: "and" | "or";
  rules: Rule[];
  funnel?: {
    steps: string[];
    windowDays: number;
    from: string;
    to: string;
    step: number;
    dropoff: boolean;
  };
}
export interface Person {
  id: string;
  projectId: string;
  name: string;
  email: string;
  phone: string;
  country: string;
  city: string;
  platform: string;
  plan: string;
  value: number;
  createdAt: string;
  lastSeen: string;
  reachability: Record<string, boolean>;
}
export interface EventRecord {
  id: string;
  projectId: string;
  personId: string;
  name: string;
  timestamp: string;
  properties: Record<string, string | number>;
  runId?: string;
}
export interface Segment extends BaseEntity {
  type: string;
  query: RuleGroup;
  userCount: number;
  reachability?: Record<string, number>;
}
export interface ContentBlock {
  id: string;
  type: "text" | "image" | "button";
  value: string;
}
export interface MessageContent {
  title: string;
  body: string;
  subject: string;
  preheader: string;
  cta: string;
  url: string;
  image: string;
  background: string;
  position: string;
  blocks: ContentBlock[];
}
export interface MessageTemplate extends BaseEntity {
  channel: ChannelType;
  content: MessageContent;
  category: string;
}
export interface Channel extends BaseEntity {
  channel: ChannelType;
  provider: string;
  config: { sender: string; domain: string; appId: string };
  checkedAt?: string;
}
export interface CampaignStats {
  sent: number;
  delivered: number;
  viewed: number;
  clicked: number;
  converted: number;
  revenue: number;
}
export interface Campaign extends BaseEntity {
  channel: ChannelType;
  segmentId: string;
  templateId: string;
  content: MessageContent;
  variantB: MessageContent;
  abEnabled: boolean;
  split: number;
  schedule: string;
  goal: string;
  stats: CampaignStats;
  runs: number;
}
export interface JourneyNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    kind: string;
    channel?: ChannelType;
    segmentId?: string;
    event?: string;
    hours?: number;
    content?: MessageContent;
    count?: number;
  };
}
export interface JourneyEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  data?: { hours: number };
}
export interface Journey extends BaseEntity {
  nodes: JourneyNode[];
  edges: JourneyEdge[];
  goal: string;
  version: number;
  stats: { entered: number; converted: number; completed: number };
  timeoutHours: number;
}
export interface BoardTile {
  id: string;
  title: string;
  event: string;
  metric: string;
  size: string;
}
export interface Board extends BaseEntity {
  tiles: BoardTile[];
}
export type Entity =
  Segment | MessageTemplate | Channel | Campaign | Journey | Board;
export interface ListResponse<T> {
  data: T[];
  meta: { total: number; page: number; pageSize: number; pages: number };
}
export interface SegmentResult {
  count: number;
  users: Person[];
  reachability: Record<string, number>;
  ids: string[];
}
export interface RunRecord {
  id: string;
  projectId: string;
  resourceId: string;
  type: string;
  createdAt: string;
  snapshot: unknown;
  result: {
    stats: CampaignStats;
    execution?: { entered: number; completed: number; timedOut: number };
    variants: {
      name: string;
      sent: number;
      clicked: number;
      converted: number;
    }[];
    nodes?: { id: string; label: string; entered: number; exited: number }[];
  };
  records: {
    personId: string;
    variant: string;
    outcome: string;
    nodeId?: string;
  }[];
}
export interface AnalyticsResult {
  totals: {
    users: number;
    active: number;
    events: number;
    revenue: number;
    purchases: number;
    campaigns: number;
    reachable: number;
  };
  series: { date: string; users: number; events: number; revenue: number }[];
  platforms: { name: string; value: number; color: string }[];
  events: { name: string; count: number; users: number }[];
  countries: { name: string; users: number }[];
}
export const EMPTY_CONTENT: MessageContent = {
  title: "",
  body: "",
  subject: "",
  preheader: "",
  cta: "Shop now",
  url: "https://example.com",
  image: "",
  background: "#eef2ff",
  position: "Center",
  blocks: [],
};
export const EMPTY_STATS: CampaignStats = {
  sent: 0,
  delivered: 0,
  viewed: 0,
  clicked: 0,
  converted: 0,
  revenue: 0,
};
