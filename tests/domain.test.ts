import assert from "node:assert/strict";
import test from "node:test";
import {
  clickRate,
  computeFunnel,
  evaluateRules,
  personalize,
  stableHash,
  validateJourney,
} from "../src/lib/domain.ts";
import type {
  EventRecord,
  JourneyEdge,
  JourneyNode,
  MessageContent,
  Person,
  RuleGroup,
} from "../src/lib/types.ts";
const person: Person = {
  id: "p1",
  projectId: "demo",
  name: "Emma Chen",
  email: "emma@example.com",
  phone: "",
  city: "London",
  country: "United Kingdom",
  platform: "iOS",
  plan: "Premium",
  value: 450,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastSeen: "2026-11-19T00:00:00.000Z",
  reachability: { Email: true },
};
const event = (
  name: string,
  timestamp: string,
  id = timestamp,
): EventRecord => ({
  id,
  projectId: "demo",
  personId: "p1",
  name,
  timestamp,
  properties: {},
});
const anchor = "2026-11-20T00:00:00.000Z";
test("click rate uses views for in-product messages and sends for email", () => {
  const stats = {
    sent: 100,
    delivered: 100,
    viewed: 40,
    clicked: 10,
    converted: 2,
    revenue: 0,
  };
  assert.equal(clickRate("In-App", stats), 25);
  assert.equal(clickRate("Email", stats), 10);
});
test("AND / OR conditions preserve their different meanings", () => {
  const query: RuleGroup = {
    combinator: "and",
    rules: [
      {
        id: "1",
        kind: "property",
        field: "plan",
        operator: "equals",
        value: "Premium",
        days: 30,
      },
      {
        id: "2",
        kind: "property",
        field: "country",
        operator: "equals",
        value: "India",
        days: 30,
      },
    ],
  };
  assert.equal(evaluateRules(person, [], query, anchor), false);
  assert.equal(
    evaluateRules(person, [], { ...query, combinator: "or" }, anchor),
    true,
  );
});
test("event windows include the start and exclude the end", () => {
  const query: RuleGroup = {
    combinator: "and",
    rules: [
      {
        id: "1",
        kind: "event",
        field: "Charged",
        operator: "did",
        value: "1",
        days: 1,
      },
    ],
  };
  assert.equal(
    evaluateRules(
      person,
      [event("Charged", "2026-11-19T00:00:00.000Z")],
      query,
      anchor,
    ),
    true,
  );
  assert.equal(
    evaluateRules(person, [event("Charged", anchor)], query, anchor),
    false,
  );
  assert.equal(
    evaluateRules(
      person,
      [event("Charged", "2026-11-18T23:59:59.999Z")],
      query,
      anchor,
    ),
    false,
  );
});
test("a user with no events can qualify for a did-not condition", () => {
  assert.equal(
    evaluateRules(
      person,
      [],
      {
        combinator: "and",
        rules: [
          {
            id: "1",
            kind: "event",
            field: "Charged",
            operator: "did_not",
            value: "1",
            days: 7,
          },
        ],
      },
      anchor,
    ),
    true,
  );
});
test("funnels find a later valid first event after an expired first sequence", () => {
  const events = [
    event("View", "2026-11-01T00:00:00.000Z"),
    event("View", "2026-11-17T00:00:00.000Z"),
    event("Cart", "2026-11-18T00:00:00.000Z"),
    event("Buy", "2026-11-19T00:00:00.000Z"),
  ];
  const result = computeFunnel(
    [person],
    events,
    ["View", "Cart", "Buy"],
    3,
    "2026-11-01",
    "2026-11-20",
  );
  assert.deepEqual(
    result.map((step) => step.users),
    [1, 1, 1],
  );
  assert.equal(result[2].conversion, 100);
});
test("strict ordering and per-user deduplication are respected", () => {
  const events = [
    event("View", "2026-11-18T00:00:00.000Z"),
    event("Cart", "2026-11-18T00:00:00.000Z", "same-time"),
    event("View", "2026-11-18T01:00:00.000Z"),
    event("Cart", "2026-11-18T02:00:00.000Z"),
    event("Cart", "2026-11-18T03:00:00.000Z"),
  ];
  const result = computeFunnel(
    [person],
    events,
    ["View", "Cart", "Buy"],
    7,
    "2026-11-01",
    "2026-11-20",
  );
  assert.deepEqual(
    result.map((step) => step.users),
    [1, 1, 0],
  );
  assert.equal(result[2].dropoff, 1);
});
test("stable audience assignment is deterministic", () => {
  assert.equal(stableHash("p1-campaign1"), stableHash("p1-campaign1"));
  assert.notEqual(stableHash("p1-campaign1"), stableHash("p2-campaign1"));
});
test("personalization resolves profile values and content blocks", () => {
  const content: MessageContent = {
    title: "Hi {{first_name}}",
    subject: "{{plan}} benefits",
    body: "Hello {{name}} in {{city}}",
    preheader: "",
    cta: "",
    url: "",
    image: "",
    background: "#ffffff",
    position: "Center",
    blocks: [{ id: "1", type: "text", value: "To {{email}}" }],
  };
  const result = personalize(content, person);
  assert.equal(result.title, "Hi Emma");
  assert.equal(result.body, "Hello Emma Chen in London");
  assert.equal(result.blocks[0].value, "To emma@example.com");
  assert.equal(content.title, "Hi {{first_name}}");
});
const nodes: JourneyNode[] = [
  {
    id: "entry",
    type: "journey",
    position: { x: 0, y: 0 },
    data: { kind: "entry", label: "Entry", segmentId: "all" },
  },
  {
    id: "condition",
    type: "journey",
    position: { x: 0, y: 100 },
    data: { kind: "condition", label: "Bought?", event: "Charged" },
  },
  {
    id: "exit",
    type: "journey",
    position: { x: 0, y: 200 },
    data: { kind: "exit", label: "Exit" },
  },
];
const edges: JourneyEdge[] = [
  { id: "1", source: "entry", target: "condition" },
  { id: "2", source: "condition", target: "exit", label: "Yes" },
  { id: "3", source: "condition", target: "exit", label: "No" },
];
test("a connected acyclic journey with both condition paths is valid", () =>
  assert.deepEqual(validateJourney(nodes, edges), []));
test("missing branches, orphaned nodes, and loops are reported", () => {
  assert.ok(
    validateJourney(nodes, edges.slice(0, 2)).some((error) =>
      error.includes("Yes and No"),
    ),
  );
  assert.ok(
    validateJourney([...nodes, { ...nodes[2], id: "orphan" }], edges).some(
      (error) => error.includes("all nodes"),
    ),
  );
  assert.ok(
    validateJourney(nodes, [
      ...edges,
      { id: "4", source: "condition", target: "entry" },
    ]).some((error) => error.includes("Loops")),
  );
});
