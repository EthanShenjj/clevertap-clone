import {
  computeFunnel,
  evaluateRules,
  stableHash,
  personalize,
  validateJourney,
} from "@/lib/domain";
import type {
  AnalyticsResult,
  Campaign,
  CampaignStats,
  Channel,
  Entity,
  EventRecord,
  Journey,
  MessageTemplate,
  Person,
  Project,
  Resource,
  RuleGroup,
  RunRecord,
  Segment,
} from "@/lib/types";
import { CHANNELS, EMPTY_STATS } from "@/lib/types";
import { randomUUID } from "node:crypto";
import { ApiError } from "./api-error";
export { ApiError } from "./api-error";
import {
  normalizeSmsProvider,
  simulateSmsDelivery,
  validateSmsSettings,
  validateSmsTarget,
} from "./sms";
import { z } from "zod";
import {
  allEntities,
  base,
  defaultContent,
  getDb,
  getEvents,
  getPeople,
  getProject,
  readEntity,
  writeEntity,
} from "./database";

export function requireProject(id: string): Project {
  const project = getProject(id);
  if (!project)
    throw new ApiError(404, "PROJECT_NOT_FOUND", "Project not found.");
  return project;
}
export function requireEntity<T extends Entity>(
  resource: Resource,
  id: string,
  projectId: string,
): T {
  const entity = readEntity<T>(resource, id, projectId);
  if (!entity)
    throw new ApiError(
      404,
      "NOT_FOUND",
      "This " +
        resource.slice(0, -1) +
        " could not be found in the selected project.",
    );
  return entity;
}
const ruleSchema = z.object({
  id: z.string(),
  kind: z.enum(["property", "event"]),
  field: z.string().min(1),
  operator: z.enum([
    "equals",
    "not_equals",
    "contains",
    "greater_than",
    "less_than",
    "did",
    "did_not",
  ]),
  value: z.string().max(300),
  days: z.number().int().min(1).max(365),
});
const querySchema = z.object({
  combinator: z.enum(["and", "or"]),
  rules: z.array(ruleSchema).max(30),
  funnel: z
    .object({
      steps: z.array(z.string()).min(2).max(8),
      windowDays: z.number().min(1).max(365),
      from: z.string(),
      to: z.string(),
      step: z.number().int().min(0).max(7),
      dropoff: z.boolean(),
    })
    .optional(),
});
const contentSchema = z.object({
  title: z.string().max(300),
  body: z.string().max(20000),
  subject: z.string().max(500),
  preheader: z.string().max(500),
  cta: z.string().max(100),
  url: z
    .string()
    .refine((v) => !v || /^https?:\/\//i.test(v), "Use an http or https URL."),
  image: z
    .string()
    .refine(
      (v) => !v || /^https?:\/\//i.test(v) || v.startsWith("/"),
      "Use an image URL.",
    ),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  position: z.string(),
  blocks: z
    .array(
      z.object({
        id: z.string(),
        type: z.enum(["text", "image", "button"]),
        value: z.string().max(10000),
      }),
    )
    .max(50),
});
const nodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  position: z.object({ x: z.number(), y: z.number() }),
  data: z.object({
    label: z.string(),
    kind: z.enum(["entry", "message", "delay", "condition", "exit"]),
    channel: z.enum(CHANNELS).optional(),
    segmentId: z.string().optional(),
    event: z.string().optional(),
    hours: z.number().min(0).max(8760).optional(),
    content: contentSchema.optional(),
    count: z.number().optional(),
    smsTarget: z.string().max(100).optional(),
  }),
});
const edgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  label: z.string().optional(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  data: z.object({ hours: z.number().min(0).max(8760) }).optional(),
});
const shared = {
  name: z
    .string()
    .trim()
    .min(2, "Enter a name with at least 2 characters.")
    .max(120),
  description: z.string().max(1000).optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
};
const schemas = {
  segments: z.object({
    ...shared,
    type: z.string().optional(),
    query: querySchema.optional(),
  }),
  templates: z.object({
    ...shared,
    channel: z.enum(CHANNELS),
    content: contentSchema.optional(),
    category: z.string().max(100).optional(),
  }),
  channels: z.object({
    ...shared,
    channel: z.enum(CHANNELS),
    provider: z.string().trim().min(2),
    config: z
      .object({
        sender: z.string().max(200),
        domain: z.string().max(200),
        appId: z.string().max(200),
      })
      .optional(),
  }),
  campaigns: z.object({
    ...shared,
    channel: z.enum(CHANNELS),
    segmentId: z.string().optional(),
    templateId: z.string().optional(),
    content: contentSchema.optional(),
    variantB: contentSchema.optional(),
    abEnabled: z.boolean().optional(),
    split: z.number().min(1).max(99).optional(),
    schedule: z.string().optional(),
    goal: z.string().max(100).optional(),
    smsTarget: z.string().max(100).optional(),
  }),
  journeys: z.object({
    ...shared,
    nodes: z.array(nodeSchema).max(100).optional(),
    edges: z.array(edgeSchema).max(200).optional(),
    goal: z.string().optional(),
    timeoutHours: z.number().min(1).max(8760).optional(),
  }),
  boards: z.object({
    ...shared,
    tiles: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
          event: z.string(),
          metric: z.enum(["users", "events", "revenue"]),
          size: z.enum(["normal", "wide"]),
        }),
      )
      .max(20)
      .optional(),
  }),
};
export function parseQuery(input: unknown): RuleGroup {
  return querySchema.parse(input);
}
export function dataset(projectId: string) {
  const people = getPeople(projectId),
    events = getEvents(projectId);
  const byPerson = new Map<string, EventRecord[]>();
  for (const event of events) {
    const list = byPerson.get(event.personId) ?? [];
    list.push(event);
    byPerson.set(event.personId, list);
  }
  return { people, events, byPerson };
}
export function evaluate(
  projectId: string,
  query: RuleGroup,
  data = dataset(projectId),
) {
  const project = requireProject(projectId);
  let users = data.people.filter((person) =>
    evaluateRules(
      person,
      data.byPerson.get(person.id) ?? [],
      query,
      project.demoDate,
    ),
  );
  if (query.funnel) {
    const f = query.funnel,
      results = computeFunnel(
        data.people,
        data.events,
        f.steps,
        f.windowDays,
        f.from,
        f.to,
      );
    if (f.step >= results.length)
      throw new ApiError(
        400,
        "INVALID_FUNNEL",
        "The selected funnel step is not available.",
      );
    const ids = new Set(results[f.step].ids),
      next = new Set(results[f.step + 1]?.ids ?? []);
    users = users.filter(
      (person) => ids.has(person.id) && (!f.dropoff || !next.has(person.id)),
    );
  }
  const reachability = Object.fromEntries(
    CHANNELS.map((channel) => [
      channel,
      users.filter((person) => person.reachability[channel]).length,
    ]),
  );
  return {
    count: users.length,
    users: users.slice(0, 20),
    reachability,
    ids: users.map((p) => p.id),
  };
}
export function hydrateSegments(items: Segment[], projectId: string) {
  const data = dataset(projectId);
  return items.map((item) => {
    const result = evaluate(projectId, item.query, data);
    return {
      ...item,
      userCount: result.count,
      reachability: result.reachability,
    };
  });
}
function validateReferences(
  resource: Resource,
  entity: Entity,
  projectId: string,
) {
  if (resource === "campaigns") {
    const item = entity as Campaign;
    if (item.channel === "SMS" && item.smsTarget)
      validateSmsTarget(projectId, item.smsTarget);
    if (item.segmentId) requireEntity("segments", item.segmentId, projectId);
    if (item.templateId) {
      const template = requireEntity<MessageTemplate>(
        "templates",
        item.templateId,
        projectId,
      );
      if (template.channel !== item.channel)
        throw new ApiError(
          400,
          "CHANNEL_MISMATCH",
          "Choose a template for the selected channel.",
        );
    }
  }
  if (resource === "journeys")
    for (const node of (entity as Journey).nodes) {
      if (node.data.channel === "SMS" && node.data.smsTarget)
        validateSmsTarget(projectId, node.data.smsTarget);
      if (node.data.segmentId)
        requireEntity("segments", node.data.segmentId, projectId);
    }
  if (resource === "segments") {
    const query = (entity as Segment).query;
    const propertyFields = [
      "name",
      "email",
      "country",
      "city",
      "platform",
      "plan",
      "value",
    ];
    const eventFields = [
      "App Launched",
      "Product Viewed",
      "Added to Cart",
      "Charged",
      "Signed Up",
      "Message Sent",
      "Message Viewed",
      "Message Clicked",
    ];
    for (const rule of query.rules) {
      if (
        !(rule.kind === "property" ? propertyFields : eventFields).includes(
          rule.field,
        )
      )
        throw new ApiError(
          400,
          "INVALID_FIELD",
          "Choose a field from the schema.",
        );
      if (rule.kind === "event" && !["did", "did_not"].includes(rule.operator))
        throw new ApiError(
          400,
          "INVALID_OPERATOR",
          "Choose did or did not for an event condition.",
        );
      if (
        rule.kind === "property" &&
        ["did", "did_not"].includes(rule.operator)
      )
        throw new ApiError(
          400,
          "INVALID_OPERATOR",
          "Choose a property comparison.",
        );
      if (
        ["greater_than", "less_than"].includes(rule.operator) &&
        !Number.isFinite(Number(rule.value))
      )
        throw new ApiError(
          400,
          "INVALID_VALUE",
          "Enter a numeric comparison value.",
        );
    }
  }
}
export function save(
  resource: Resource,
  projectId: string,
  body: unknown,
  id?: string,
) {
  const input = (id ? schemas[resource].partial() : schemas[resource]).parse(
    body,
  ) as Record<string, unknown>;
  const previous = id ? requireEntity(resource, id, projectId) : undefined;
  if (
    resource === "channels" &&
    (input.channel === "SMS" ||
      (previous && (previous as Channel).channel === "SMS"))
  )
    throw new ApiError(
      422,
      "SMS_CONFIGURATION_REQUIRED",
      "Manage SMS providers through the dedicated SMS configuration page.",
    );
  const now = new Date().toISOString(),
    entityId = id || resource.slice(0, 3) + "-" + randomUUID().slice(0, 12);
  const defaults: Record<Resource, object> = {
    segments: {
      type: "Past behavior",
      query: { combinator: "and", rules: [] },
      userCount: 0,
    },
    templates: {
      channel: "Email",
      content: defaultContent("Email"),
      category: "Promotional",
    },
    channels: {
      channel: "Email",
      provider: "Custom",
      config: { sender: "", domain: "", appId: "" },
    },
    campaigns: {
      channel: "Push",
      segmentId: "",
      templateId: "",
      content: defaultContent("Push"),
      variantB: defaultContent("Push", 1),
      abEnabled: false,
      split: 50,
      schedule: "",
      goal: "Charged",
      stats: EMPTY_STATS,
      runs: 0,
    },
    journeys: {
      nodes: [],
      edges: [],
      goal: "Charged",
      version: 1,
      timeoutHours: 168,
      stats: { entered: 0, converted: 0, completed: 0 },
    },
    boards: { tiles: [] },
  };
  const item = {
    ...base(
      entityId,
      projectId,
      String(input.name || previous?.name || "Untitled"),
      ["segments", "templates", "boards"].includes(resource)
        ? "Active"
        : resource === "channels"
          ? "Not connected"
          : "Draft",
    ),
    ...defaults[resource],
    ...previous,
    ...input,
    id: entityId,
    projectId,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
  } as Entity;
  if (resource === "journeys" && previous?.status === "Running") {
    (item as Journey).version = (previous as Journey).version + 1;
    item.status = "Draft";
  }
  if (
    resource === "campaigns" &&
    ["Running", "Scheduled"].includes(previous?.status || "")
  )
    throw new ApiError(
      409,
      "CAMPAIGN_ACTIVE",
      "Pause this campaign before editing its configuration.",
    );
  if (
    resource === "channels" &&
    previous &&
    (JSON.stringify((item as Channel).config) !==
      JSON.stringify((previous as Channel).config) ||
      (item as Channel).provider !== (previous as Channel).provider)
  )
    item.status = "Not connected";
  if (
    resource === "templates" &&
    previous &&
    (item as MessageTemplate).channel !==
      (previous as MessageTemplate).channel &&
    allEntities<Campaign>("campaigns", projectId).some(
      (campaign) => campaign.templateId === item.id,
    )
  ) {
    throw new ApiError(
      409,
      "RESOURCE_IN_USE",
      "Duplicate this template to change its channel while campaigns reference it.",
    );
  }
  validateReferences(resource, item, projectId);
  writeEntity(resource, item);
  return resource === "segments"
    ? hydrateSegments([item as Segment], projectId)[0]
    : item;
}
export function remove(resource: Resource, id: string, projectId: string) {
  const item = requireEntity(resource, id, projectId);
  if (resource === "channels" && (item as Channel).channel === "SMS")
    throw new ApiError(
      409,
      "SMS_CONFIGURATION_REQUIRED",
      "Manage SMS provider references through the SMS configuration page.",
    );
  if (["Running", "Scheduled"].includes(item.status))
    throw new ApiError(
      409,
      "ACTIVE_RESOURCE",
      "Pause this " + resource.slice(0, -1) + " before deleting it.",
    );
  if (resource === "segments") {
    const usedCampaign = allEntities<Campaign>("campaigns", projectId).find(
      (c) => c.segmentId === id,
    );
    const usedJourney = allEntities<Journey>("journeys", projectId).find((j) =>
      j.nodes.some((n) => n.data.segmentId === id),
    );
    if (usedCampaign || usedJourney)
      throw new ApiError(
        409,
        "RESOURCE_IN_USE",
        "This segment is used by " +
          (usedCampaign?.name || usedJourney?.name) +
          ". Update that reference first.",
      );
  }
  if (
    resource === "templates" &&
    allEntities<Campaign>("campaigns", projectId).some(
      (c) => c.templateId === id,
    )
  )
    throw new ApiError(
      409,
      "RESOURCE_IN_USE",
      "This template is used by a campaign. Remove that reference first.",
    );
  if (
    resource === "channels" &&
    allEntities<Campaign>("campaigns", projectId).some(
      (c) => c.channel === (item as Channel).channel && c.status === "Running",
    )
  )
    throw new ApiError(
      409,
      "RESOURCE_IN_USE",
      "Pause active campaigns using this channel first.",
    );
  getDb()
    .prepare("DELETE FROM " + resource + " WHERE id=? AND project_id=?")
    .run(id, projectId);
}
export function changeStatus(
  resource: Resource,
  id: string,
  projectId: string,
  target: string,
) {
  const item = requireEntity(resource, id, projectId);
  const transitions: Record<string, string[]> = {
    Running: ["Paused"],
    Scheduled: ["Paused"],
    Paused: ["Running", "Draft"],
    Draft: [],
    Completed: [],
  };
  if (!(transitions[item.status] || []).includes(target))
    throw new ApiError(
      409,
      "INVALID_TRANSITION",
      "Cannot change " + item.status + " to " + target + ".",
    );
  if (resource !== "campaigns" && resource !== "journeys")
    throw new ApiError(
      400,
      "UNSUPPORTED_ACTION",
      "This resource has no running state.",
    );
  if (target === "Running") {
    if (resource === "campaigns")
      validateCampaign(item as Campaign, projectId, false);
    else validateJourneyForPublish(item as Journey, projectId);
  }
  item.status = target;
  item.updatedAt = new Date().toISOString();
  writeEntity(resource, item);
  return item;
}
function validateCampaign(
  item: Campaign,
  projectId: string,
  checkSchedule = true,
) {
  const errors: Record<string, string> = {};
  if (!item.segmentId) errors.segmentId = "Select a target segment.";
  if (item.channel === "SMS") validateSmsTarget(projectId, item.smsTarget);
  if (!item.content.body.trim()) errors.body = "Write your message.";
  if (item.channel === "Email" && !item.content.subject.trim())
    errors.subject = "Add an email subject.";
  if (item.channel === "Push" && !item.content.title.trim())
    errors.title = "Add a notification title.";
  if (item.abEnabled && !item.variantB.body.trim())
    errors.variantB = "Write a message for variant B.";
  if (
    checkSchedule &&
    item.schedule &&
    (!Number.isFinite(Date.parse(item.schedule)) ||
      Date.parse(item.schedule) <= Date.now())
  )
    errors.schedule = "Choose a future time or send immediately.";
  if (
    !allEntities<Channel>("channels", projectId).some(
      (c) => c.channel === item.channel && c.status === "Connected",
    )
  )
    errors.channel = "Connect this channel in Settings before publishing.";
  if (item.segmentId) {
    const segment = requireEntity<Segment>(
      "segments",
      item.segmentId,
      projectId,
    );
    if (!evaluate(projectId, segment.query).reachability[item.channel])
      errors.segmentId =
        "No reachable users in this segment for " + item.channel + ".";
  }
  if (Object.keys(errors).length)
    throw new ApiError(
      422,
      "VALIDATION_FAILED",
      Object.values(errors)[0],
      errors,
    );
}
function validateJourneyForPublish(journey: Journey, projectId: string) {
  const errors = validateJourney(journey.nodes, journey.edges);
  for (const node of journey.nodes) {
    if (node.data.kind === "message" && node.data.channel === "SMS")
      validateSmsTarget(projectId, node.data.smsTarget);
    if (
      node.data.kind === "message" &&
      !allEntities<Channel>("channels", projectId).some(
        (c) => c.channel === node.data.channel && c.status === "Connected",
      )
    )
      errors.push(
        node.data.label + ": connect the " + node.data.channel + " channel.",
      );
    if (node.data.segmentId)
      requireEntity("segments", node.data.segmentId, projectId);
  }
  if (errors.length)
    throw new ApiError(422, "INVALID_JOURNEY", errors.join(" "));
}
export function publish(
  resource: "campaigns" | "journeys",
  id: string,
  projectId: string,
) {
  const item = requireEntity(resource, id, projectId);
  if (!["Draft", "Paused"].includes(item.status))
    throw new ApiError(
      409,
      "ALREADY_PUBLISHED",
      "Only draft or paused items can be published.",
    );
  if (resource === "campaigns") validateCampaign(item as Campaign, projectId);
  else validateJourneyForPublish(item as Journey, projectId);
  item.status =
    resource === "campaigns" && (item as Campaign).schedule
      ? "Scheduled"
      : "Running";
  item.updatedAt = new Date().toISOString();
  writeEntity(resource, item);
  return item;
}
export function testChannel(id: string, projectId: string) {
  let item = requireEntity<Channel>("channels", id, projectId);
  if (item.channel === "SMS") {
    item = normalizeSmsProvider(item);
    if (item.status === "Archived")
      throw new ApiError(
        409,
        "PROVIDER_ARCHIVED",
        "Archived SMS providers cannot be restored.",
      );
    validateSmsSettings(item);
  }
  if (
    item.channel === "Email" &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.config.sender)
  )
    throw new ApiError(
      422,
      "INVALID_SENDER",
      "Enter a valid sender email address.",
      { sender: "A valid email is required." },
    );
  if (["Push", "In-App"].includes(item.channel) && !item.config.appId.trim())
    throw new ApiError(422, "INVALID_APP", "Enter an application ID.");
  if (
    ["Web Pop-up", "Web Push"].includes(item.channel) &&
    !/^[\w.-]+\.[a-z]{2,}$/i.test(item.config.domain)
  )
    throw new ApiError(422, "INVALID_DOMAIN", "Enter a valid website domain.");
  if (!item.provider.trim())
    throw new ApiError(422, "INVALID_PROVIDER", "Choose a provider.");
  item.status = "Connected";
  item.checkedAt = new Date().toISOString();
  item.updatedAt = item.checkedAt;
  writeEntity("channels", item);
  return {
    channel: item,
    message:
      "Configuration validated for demo delivery. No external provider was contacted.",
  };
}
export function listRuns(projectId: string, resourceId: string): RunRecord[] {
  return getDb()
    .prepare(
      "SELECT data FROM runs WHERE project_id=? AND resource_id=? ORDER BY created_at DESC",
    )
    .all(projectId, resourceId)
    .map((row) => JSON.parse(String(row.data)) as RunRecord);
}
function recordEvent(
  projectId: string,
  person: Person,
  name: string,
  timestamp: string,
  runId: string,
  properties: Record<string, string | number>,
) {
  const event: EventRecord = {
    id: randomUUID(),
    projectId,
    personId: person.id,
    name,
    timestamp,
    runId,
    properties,
  };
  getDb()
    .prepare("INSERT INTO events VALUES (?,?,?,?,?,?,?)")
    .run(
      event.id,
      projectId,
      person.id,
      name,
      timestamp,
      runId,
      JSON.stringify(event),
    );
}
export function simulate(
  resource: "campaigns" | "journeys",
  id: string,
  projectId: string,
): RunRecord {
  const item = requireEntity(resource, id, projectId);
  if (item.status !== "Running")
    throw new ApiError(
      409,
      "NOT_RUNNING",
      "Publish or resume this item before running a simulation.",
    );
  const data = dataset(projectId);
  if (resource === "campaigns" && (item as Campaign).channel === "SMS")
    validateSmsTarget(projectId, (item as Campaign).smsTarget);
  if (resource === "journeys")
    for (const node of (item as Journey).nodes)
      if (node.data.channel === "SMS")
        validateSmsTarget(projectId, node.data.smsTarget);
  const query =
    resource === "campaigns"
      ? requireEntity<Segment>(
          "segments",
          (item as Campaign).segmentId,
          projectId,
        ).query
      : requireEntity<Segment>(
          "segments",
          (item as Journey).nodes.find((n) => n.data.kind === "entry")!.data
            .segmentId!,
          projectId,
        ).query;
  const ids = new Set(evaluate(projectId, query, data).ids);
  let users = data.people.filter((person) => ids.has(person.id));
  if (resource === "campaigns")
    users = users.filter(
      (person) => person.reachability[(item as Campaign).channel],
    );
  const now = new Date().toISOString(),
    runId = randomUUID();
  const stats: CampaignStats = { ...EMPTY_STATS },
    variants = [
      { name: "A", sent: 0, clicked: 0, converted: 0 },
      { name: "B", sent: 0, clicked: 0, converted: 0 },
    ];
  const records: RunRecord["records"] = [];
  let completedUsers = 0,
    timedOutUsers = 0;
  const conversionGoal = (item as Campaign | Journey).goal || "Charged";
  const demoAnchor = Date.parse(requireProject(projectId).demoDate);
  const nodeCounts = new Map<
    string,
    { id: string; label: string; entered: number; exited: number }
  >();
  const db = getDb();
  db.exec("BEGIN");
  try {
    for (const person of users) {
      let clicked = false,
        converted = false,
        viewed = false,
        sent = false;
      const variantIndex =
        resource === "campaigns" &&
        (item as Campaign).abEnabled &&
        stableHash(person.id + id) % 100 >= (item as Campaign).split
          ? 1
          : 0;
      const score = stableHash(person.id + id + "response") % 100;
      if (resource === "campaigns") {
        sent = true;
        viewed = score < 48;
        clicked = score < (variantIndex ? 20 : 16);
        converted = score < (variantIndex ? 9 : 6);
        if ((item as Campaign).channel === "SMS") {
          const campaign = item as Campaign;
          const message = simulateSmsDelivery(
            projectId,
            campaign.smsTarget || "",
            person.phone.replace(/\s/g, ""),
            personalize(
              variantIndex ? campaign.variantB : campaign.content,
              person,
            ).body,
            runId + ":" + person.id,
            clicked,
          );
          sent = !!message.providerMessageId;
          if (!sent) {
            viewed = false;
            clicked = false;
            converted = false;
          }
        }
      } else {
        const journey = item as Journey;
        let current = journey.nodes.find((n) => n.data.kind === "entry"),
          elapsed = 0,
          visits = 0;
        while (
          current &&
          visits++ < journey.nodes.length + 1 &&
          elapsed <= journey.timeoutHours
        ) {
          const count = nodeCounts.get(current.id) ?? {
            id: current.id,
            label: current.data.label,
            entered: 0,
            exited: 0,
          };
          count.entered++;
          const outgoing = journey.edges.filter(
            (edge) => edge.source === current!.id,
          );
          if (current.data.kind === "delay") {
            elapsed += current.data.hours || 0;
            if (elapsed > journey.timeoutHours) {
              nodeCounts.set(current.id, count);
              records.push({
                personId: person.id,
                variant: "A",
                outcome: "Timed out",
                nodeId: current.id,
              });
              timedOutUsers++;
              break;
            }
          }
          if (
            current.data.kind === "message" &&
            person.reachability[current.data.channel || "Push"]
          ) {
            const messageScore = stableHash(person.id + id + current.id) % 100;
            if (current.data.channel === "SMS") {
              const message = simulateSmsDelivery(
                projectId,
                current.data.smsTarget || "",
                person.phone.replace(/\s/g, ""),
                personalize(
                  current.data.content || defaultContent("SMS"),
                  person,
                ).body,
                runId + ":" + person.id + ":" + current.id,
                messageScore < 20,
              );
              if (!message.providerMessageId) {
                nodeCounts.set(current.id, count);
                records.push({
                  personId: person.id,
                  variant: "A",
                  outcome: "SMS dispatch rejected",
                  nodeId: current.id,
                });
                break;
              }
            }
            sent = true;
            viewed ||= messageScore < 48;
            clicked ||= messageScore < 20;
            converted ||= messageScore < 9;
          }
          let edge = outgoing[0];
          if (current.data.kind === "condition") {
            const hasEvent =
              (data.byPerson.get(person.id) || []).some(
                (event) =>
                  event.name === current!.data.event &&
                  Date.parse(event.timestamp) >=
                    demoAnchor - (current!.data.hours || 168) * 3600000,
              ) || converted;
            edge = outgoing.find(
              (e) => e.label?.toLowerCase() === (hasEvent ? "yes" : "no"),
            )!;
          }
          count.exited++;
          nodeCounts.set(current.id, count);
          records.push({
            personId: person.id,
            variant: "A",
            outcome: current.data.kind,
            nodeId: current.id,
          });
          if (converted || current.data.kind === "exit" || !edge) {
            completedUsers++;
            break;
          }
          elapsed += edge?.data?.hours || 0;
          if (elapsed > journey.timeoutHours) {
            timedOutUsers++;
            records.push({
              personId: person.id,
              variant: "A",
              outcome: "Timed out",
              nodeId: current.id,
            });
            break;
          }
          current = edge
            ? journey.nodes.find((node) => node.id === edge.target)
            : undefined;
        }
      }
      if (sent) {
        stats.sent++;
        stats.delivered++;
        variants[variantIndex].sent++;
        recordEvent(projectId, person, "Message Sent", now, runId, {
          resourceId: id,
          variant: variants[variantIndex].name,
        });
      }
      if (viewed) {
        stats.viewed++;
        recordEvent(projectId, person, "Message Viewed", now, runId, {
          resourceId: id,
        });
      }
      if (clicked) {
        stats.clicked++;
        variants[variantIndex].clicked++;
        recordEvent(projectId, person, "Message Clicked", now, runId, {
          resourceId: id,
        });
      }
      if (converted) {
        stats.converted++;
        stats.revenue += conversionGoal === "Charged" ? 59 : 0;
        variants[variantIndex].converted++;
        recordEvent(projectId, person, conversionGoal, now, runId, {
          resourceId: id,
          amount: conversionGoal === "Charged" ? 59 : 0,
          currency: "USD",
        });
      }
      if (resource === "campaigns")
        records.push({
          personId: person.id,
          variant: variants[variantIndex].name,
          outcome: converted
            ? "Converted"
            : clicked
              ? "Clicked"
              : viewed
                ? "Viewed"
                : "Delivered",
        });
    }
    const run: RunRecord = {
      id: runId,
      projectId,
      resourceId: id,
      type: resource,
      createdAt: now,
      snapshot: JSON.parse(JSON.stringify(item)),
      result: {
        stats,
        variants: variants.filter((v) => v.sent > 0),
        nodes: [...nodeCounts.values()],
        execution:
          resource === "journeys"
            ? {
                entered: users.length,
                completed: completedUsers,
                timedOut: timedOutUsers,
              }
            : undefined,
      },
      records,
    };
    db.prepare("INSERT INTO runs VALUES (?,?,?,?,?)").run(
      runId,
      projectId,
      id,
      now,
      JSON.stringify(run),
    );
    if (resource === "campaigns") {
      const campaign = item as Campaign;
      campaign.runs++;
      for (const key of Object.keys(stats) as (keyof CampaignStats)[])
        campaign.stats[key] += stats[key];
    } else {
      const journey = item as Journey;
      journey.stats.entered += users.length;
      journey.stats.converted += stats.converted;
      journey.stats.completed += completedUsers;
    }
    item.updatedAt = now;
    writeEntity(resource, item, db);
    db.exec("COMMIT");
    return run;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
export function startOfDay(date: string, timezone: string): string {
  const utc = Date.parse(date + "T00:00:00Z");
  if (!Number.isFinite(utc) || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new ApiError(400, "INVALID_DATE", "Use dates in YYYY-MM-DD format.");
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  let time = utc;
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(time).map((p) => [p.type, p.value]),
    );
    const localAsUtc = Date.parse(
      parts.year +
        "-" +
        parts.month +
        "-" +
        parts.day +
        "T" +
        parts.hour +
        ":" +
        parts.minute +
        ":" +
        parts.second +
        "Z",
    );
    time += utc - localAsUtc;
  }
  return new Date(time).toISOString();
}
export function dateRange(
  project: Project,
  from = "2026-10-21",
  to = "2026-11-19",
) {
  const endDate = new Date(to + "T00:00:00Z");
  endDate.setUTCDate(endDate.getUTCDate() + 1);
  const start = startOfDay(from, project.timezone),
    end = startOfDay(endDate.toISOString().slice(0, 10), project.timezone);
  if (start >= end || Date.parse(end) - Date.parse(start) > 366 * 86400000)
    throw new ApiError(
      400,
      "INVALID_RANGE",
      "Select a date range between 1 and 366 days.",
    );
  return { start, end, from, to };
}
export function analytics(
  projectId: string,
  from?: string,
  to?: string,
  segmentId?: string,
): AnalyticsResult {
  const project = requireProject(projectId),
    range = dateRange(project, from, to),
    data = dataset(projectId);
  const ids = segmentId
    ? new Set(
        evaluate(
          projectId,
          requireEntity<Segment>("segments", segmentId, projectId).query,
          data,
        ).ids,
      )
    : undefined;
  const people = ids ? data.people.filter((p) => ids.has(p.id)) : data.people;
  const events = data.events.filter(
    (e) =>
      e.timestamp >= range.start &&
      e.timestamp < range.end &&
      (!ids || ids.has(e.personId)),
  );
  const days = new Map<
    string,
    { date: string; users: Set<string>; events: number; revenue: number }
  >();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: project.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  for (
    let time = Date.parse(range.from + "T12:00:00Z");
    time <= Date.parse(range.to + "T12:00:00Z");
    time += 86400000
  ) {
    const date = new Date(time).toISOString().slice(0, 10);
    days.set(date, { date, users: new Set(), events: 0, revenue: 0 });
  }
  const eventCounts = new Map<
    string,
    { name: string; count: number; ids: Set<string> }
  >();
  for (const event of events) {
    const day = days.get(formatter.format(new Date(event.timestamp)));
    if (day) {
      day.users.add(event.personId);
      day.events++;
      if (event.name === "Charged")
        day.revenue += Number(event.properties.amount || 0);
    }
    const count = eventCounts.get(event.name) ?? {
      name: event.name,
      count: 0,
      ids: new Set<string>(),
    };
    count.count++;
    count.ids.add(event.personId);
    eventCounts.set(event.name, count);
  }
  const activeIds = new Set(events.map((e) => e.personId));
  return {
    totals: {
      users: people.length,
      active: activeIds.size,
      events: events.length,
      revenue: events
        .filter((e) => e.name === "Charged")
        .reduce((sum, e) => sum + Number(e.properties.amount || 0), 0),
      purchases: events.filter((e) => e.name === "Charged").length,
      campaigns: allEntities("campaigns", projectId).filter(
        (c) => c.status === "Running",
      ).length,
      reachable: people.filter(
        (p) => p.reachability.Email || p.reachability.Push,
      ).length,
    },
    series: [...days.values()].map((day) => ({
      ...day,
      users: day.users.size,
    })),
    platforms: ["Android", "iOS", "Web"].map((name, index) => ({
      name,
      value: people.filter((p) => p.platform === name).length,
      color: ["#3568ee", "#8b7bea", "#43c1ac"][index],
    })),
    events: [...eventCounts.values()]
      .map((e) => ({ name: e.name, count: e.count, users: e.ids.size }))
      .sort((a, b) => b.count - a.count),
    countries: [...new Set(people.map((p) => p.country))]
      .map((name) => ({
        name,
        users: people.filter((p) => p.country === name).length,
      }))
      .sort((a, b) => b.users - a.users),
  };
}
