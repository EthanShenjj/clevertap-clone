import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = new URL(process.argv[2] || "https://clevertap-clone.netlify.app");
const suffix = randomUUID().slice(0, 8);
const owned = [];
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
async function request(route, options = {}) {
  const url = new URL("/api/" + route, base);
  if (!url.searchParams.has("projectId"))
    url.searchParams.set("projectId", "shopwise");
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      Origin: base.origin,
      "Content-Type": "application/json",
      ...options.headers,
    },
    body: options.method ? JSON.stringify(options.body || {}) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    options.status || 200,
    route + ": " + JSON.stringify(result),
  );
  assert.equal(response.headers.get("x-workspace-storage"), "netlify-postgres");
  checks += 2;
  return result;
}
async function create(resource, body) {
  const result = await request(resource, { method: "POST", body, status: 201 });
  owned.push([resource, result.data.id]);
  return result.data;
}
try {
  const health = await request("health");
  check(
    health.data.storage === "netlify-postgres",
    "Durable cloud storage active",
  );
  check(
    health.data.counts.people === 1160,
    "Both project datasets initialized",
  );
  for (const resource of [
    "segments",
    "templates",
    "channels",
    "campaigns",
    "journeys",
    "boards",
  ]) {
    const result = await request(resource + "?pageSize=2");
    check(
      result.data.length === 2 && result.meta.total >= 3,
      resource + " pagination works",
    );
  }
  await request("segments/shopwise-seg-0?projectId=streamly", { status: 404 });
  await request("segments/evaluate", {
    method: "POST",
    body: { query: { combinator: "and", rules: [] } },
    headers: { Origin: "https://untrusted.example" },
    status: 403,
  });
  const [first, second] = await Promise.all([
    create("templates", {
      name: "Deployment check A " + suffix,
      channel: "Email",
    }),
    create("templates", {
      name: "Deployment check B " + suffix,
      channel: "Email",
    }),
  ]);
  const concurrent = await request("templates?search=" + suffix);
  check(
    concurrent.meta.total === 2,
    "Concurrent writes both survive request isolation",
  );
  const content = {
    ...first.content,
    subject: "Hi {{first_name}}",
    body: "Saved in the cloud: " + suffix,
  };
  await request("templates/" + first.id, {
    method: "PATCH",
    body: { content },
  });
  await request("templates/" + second.id);
  check(
    (await request("templates/" + first.id)).data.content.body === content.body,
    "Edited template survives a fresh SQLite projection",
  );
  const channel = await create("channels", {
    name: "Deployment channel " + suffix,
    channel: "Email",
    provider: "Amazon SES",
    config: {
      sender: "demo@shopwise.example.com",
      domain: "shopwise.example.com",
      appId: "demo",
    },
  });
  await request("channels/" + channel.id + "/test", { method: "POST" });
  check(
    (await request("channels/" + channel.id)).data.status === "Connected",
    "Channel validation persisted",
  );
  const query = {
    combinator: "and",
    rules: [
      {
        id: "premium",
        kind: "property",
        field: "plan",
        operator: "equals",
        value: "Premium",
        days: 30,
      },
    ],
  };
  check(
    (await request("segments/evaluate", { method: "POST", body: { query } }))
      .data.count === 250,
    "Audience query is computed by backend",
  );
  const funnel = await request("analytics/query", {
    method: "POST",
    body: {
      type: "funnel",
      steps: ["App Launched", "Product Viewed", "Charged"],
      windowDays: 7,
    },
  });
  check(
    funnel.data.length === 3 && funnel.data[2].users <= funnel.data[0].users,
    "Funnel query works in cloud runtime",
  );
  await request("analytics");
  await request("people?pageSize=2");
  await request("schema");
} finally {
  for (const [resource, id] of owned.reverse()) {
    await request(resource + "/" + id, { method: "DELETE" });
    await request(resource + "/" + id, { status: 404 });
  }
}
console.log(
  JSON.stringify(
    {
      result: "passed",
      url: base.origin,
      checks,
      concurrency: "verified",
      storage: "netlify-postgres",
      cleanup: "only this run's temporary resources",
    },
    null,
    2,
  ),
);
