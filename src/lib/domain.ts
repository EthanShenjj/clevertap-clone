import type {
  CampaignStats,
  EventRecord,
  JourneyEdge,
  JourneyNode,
  MessageContent,
  Person,
  Rule,
  RuleGroup,
} from "./types.ts";

export function clickRate(channel: string, stats: CampaignStats): number {
  const denominator = ["In-App", "Web Pop-up"].includes(channel)
    ? stats.viewed
    : stats.sent;
  return denominator ? (stats.clicked / denominator) * 100 : 0;
}

export function stableHash(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
export function evaluateRules(
  person: Person,
  events: EventRecord[],
  query: RuleGroup,
  anchor: string,
): boolean {
  if (!query.rules.length) return true;
  const check = (rule: Rule) => {
    if (rule.kind === "event") {
      const end = new Date(anchor).getTime(),
        start = end - rule.days * 86400000;
      const count = events.filter(
        (e) =>
          e.name === rule.field &&
          Date.parse(e.timestamp) >= start &&
          Date.parse(e.timestamp) < end,
      ).length;
      return rule.operator === "did_not"
        ? count === 0
        : count >= Math.max(1, Number(rule.value) || 1);
    }
    const actual = String(person[rule.field as keyof Person] ?? "");
    switch (rule.operator) {
      case "not_equals":
        return actual.toLowerCase() !== rule.value.toLowerCase();
      case "contains":
        return actual.toLowerCase().includes(rule.value.toLowerCase());
      case "greater_than":
        return Number(actual) > Number(rule.value);
      case "less_than":
        return Number(actual) < Number(rule.value);
      default:
        return actual.toLowerCase() === rule.value.toLowerCase();
    }
  };
  return query.combinator === "and"
    ? query.rules.every(check)
    : query.rules.some(check);
}
export function computeFunnel(
  people: Person[],
  allEvents: EventRecord[],
  steps: string[],
  windowDays: number,
  from: string,
  to: string,
) {
  const counts = steps.map(() => 0),
    userIds = steps.map(() => [] as string[]);
  const byPerson = new Map<string, EventRecord[]>();
  for (const event of allEvents) {
    if (event.timestamp < from || event.timestamp >= to) continue;
    const list = byPerson.get(event.personId) ?? [];
    list.push(event);
    byPerson.set(event.personId, list);
  }
  for (const person of people) {
    const events = (byPerson.get(person.id) ?? []).sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );
    // Try every possible first event; a late valid sequence must not be lost to an early expired one.
    let best = 0;
    for (const first of events.filter((e) => e.name === steps[0])) {
      let reached = 1,
        previous = first.timestamp;
      const deadline = Date.parse(first.timestamp) + windowDays * 86400000;
      for (let index = 1; index < steps.length; index++) {
        const next = events.find(
          (e) =>
            e.name === steps[index] &&
            e.timestamp > previous &&
            Date.parse(e.timestamp) <= deadline,
        );
        if (!next) break;
        reached++;
        previous = next.timestamp;
      }
      best = Math.max(best, reached);
    }
    for (let index = 0; index < best; index++) {
      counts[index]++;
      userIds[index].push(person.id);
    }
  }
  return steps.map((name, index) => ({
    name,
    users: counts[index],
    conversion: counts[0] ? (counts[index] / counts[0]) * 100 : 0,
    dropoff: index ? counts[index - 1] - counts[index] : 0,
    ids: userIds[index],
  }));
}
export function validateJourney(
  nodes: JourneyNode[],
  edges: JourneyEdge[],
): string[] {
  const errors: string[] = [];
  const entries = nodes.filter((n) => n.data.kind === "entry");
  if (entries.length !== 1) errors.push("Add exactly one entry segment.");
  const ids = new Set(nodes.map((n) => n.id));
  if (ids.size !== nodes.length) errors.push("Node IDs must be unique.");
  for (const edge of edges)
    if (!ids.has(edge.source) || !ids.has(edge.target))
      errors.push("A connection points to a missing node.");
  for (const node of nodes) {
    if (!node.data.label.trim()) errors.push("Every node needs a name.");
    if (node.data.kind === "message" && !node.data.content?.body.trim())
      errors.push(node.data.label + ": add message content.");
    if (node.data.kind === "entry" && !node.data.segmentId)
      errors.push(node.data.label + ": select an audience.");
    if (node.data.kind === "condition") {
      const labels = edges
        .filter((e) => e.source === node.id)
        .map((e) => e.label?.toLowerCase());
      if (!labels.includes("yes") || !labels.includes("no"))
        errors.push(node.data.label + ": connect both Yes and No paths.");
    }
    if (node.data.kind !== "exit" && !edges.some((e) => e.source === node.id))
      errors.push(node.data.label + ": connect an outgoing path.");
  }
  const visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    visited.add(id);
    for (const edge of edges.filter((e) => e.source === id))
      if (visit(edge.target)) return true;
    visiting.delete(id);
    return false;
  };
  if (entries[0]) {
    if (visit(entries[0].id))
      errors.push("Loops are not supported in this demo.");
    if (visited.size !== nodes.length)
      errors.push("Connect all nodes to the entry segment.");
  }
  return [...new Set(errors)];
}
export function personalize(
  content: MessageContent,
  person?: Person,
): MessageContent {
  const replace = (value: string) =>
    value.replace(
      /\{\{\s*(name|first_name|email|city|plan)\s*\}\}/g,
      (_, key: string) => {
        if (!person) return key === "first_name" ? "Alex" : "customer";
        return key === "first_name"
          ? person.name.split(" ")[0]
          : String(person[key as keyof Person] ?? "customer");
      },
    );
  return {
    ...content,
    title: replace(content.title),
    subject: replace(content.subject),
    body: replace(content.body),
    blocks: content.blocks.map((b) => ({ ...b, value: replace(b.value) })),
  };
}
