import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const directory = await mkdtemp(path.join(os.tmpdir(), "clevertap-api-"));
const port = Number(process.env.VERIFY_PORT || 3101);
const base = "http://127.0.0.1:" + port;
let server,
  output = "",
  checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
async function start() {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_PATH: path.join(directory, "test.sqlite"),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout.on(
    "data",
    (chunk) => (output = (output + chunk).slice(-16000)),
  );
  server.stderr.on(
    "data",
    (chunk) => (output = (output + chunk).slice(-16000)),
  );
  for (let attempt = 0; attempt < 100; attempt++) {
    if (server.exitCode !== null)
      throw new Error("Server exited early: " + output);
    try {
      const response = await fetch(base + "/api/health", {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) return;
    } catch {}
    await delay(150);
  }
  throw new Error("Server startup timed out: " + output);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const child = server;
  const timeout = setTimeout(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  }, 5000);
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
  clearTimeout(timeout);
}
async function request(route, options = {}) {
  const url = new URL(base + "/api/" + route);
  if (!url.searchParams.has("projectId"))
    url.searchParams.set("projectId", "shopwise");
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      ...(options.method
        ? { "Content-Type": "application/json", Origin: base }
        : {}),
      ...options.headers,
    },
    body:
      options.body === undefined
        ? options.method
          ? "{}"
          : undefined
        : JSON.stringify(options.body),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    options.status || 200,
    route + ": " + JSON.stringify(result),
  );
  checks++;
  return result;
}
try {
  await start();
  const health = await request("health");
  check(health.data.counts.people === 1160, "Both projects seeded");
  check(health.data.counts.events > 30000, "Event dataset is persisted");
  for (const resource of [
    "segments",
    "campaigns",
    "templates",
    "channels",
    "journeys",
    "boards",
  ]) {
    const result = await request(resource + "?pageSize=2&page=1");
    check(
      result.data.length === 2 && result.meta.total > 2,
      resource + " server pagination",
    );
    const next = await request(resource + "?pageSize=2&page=2");
    check(result.data[0].id !== next.data[0].id, resource + " distinct pages");
  }
  const search = await request("segments?search=Premium");
  check(
    search.meta.total === 1 && search.data[0].userCount === 250,
    "Server search + computed segment size",
  );
  await request("segments?page=0", { status: 400 });
  await request("segments?sort=sql_injection", { status: 400 });
  await request("segments/shopwise-seg-2?projectId=streamly", { status: 404 });
  await request("segments?projectId=missing", { status: 404 });
  await request("segments", {
    method: "POST",
    body: { name: "" },
    status: 422,
  });
  await request("segments/evaluate", {
    method: "POST",
    body: { query: { combinator: "and", rules: [] } },
    headers: { Origin: "https://untrusted.example" },
    status: 403,
  });
  const query = {
    combinator: "and",
    rules: [
      {
        id: "r1",
        kind: "property",
        field: "plan",
        operator: "equals",
        value: "Premium",
        days: 30,
      },
    ],
  };
  const evaluation = await request("segments/evaluate", {
    method: "POST",
    body: { query },
  });
  check(
    evaluation.data.count === 250 && evaluation.data.reachability.Email === 200,
    "Audience query and reachability agree",
  );
  const segment = (
    await request("segments", {
      method: "POST",
      body: { name: "API verification audience", query },
      status: 201,
    })
  ).data;
  await request("segments/" + segment.id, {
    method: "PATCH",
    body: { name: "Persisted API audience" },
  });
  check(
    (await request("segments/" + segment.id)).data.name ===
      "Persisted API audience",
    "Segment update persisted",
  );
  const template = (
    await request("templates", {
      method: "POST",
      body: {
        name: "API verification template",
        channel: "Email",
        category: "Welcome",
      },
      status: 201,
    })
  ).data;
  await request("templates/" + template.id, {
    method: "PATCH",
    body: {
      content: {
        ...template.content,
        subject: "Hi {{first_name}}",
        body: "Your exclusive invitation.",
      },
    },
  });
  const storedTemplate = (await request("templates/" + template.id)).data;
  check(
    storedTemplate.content.body === "Your exclusive invitation.",
    "Template content stored",
  );
  const channel = (await request("channels/shopwise-ch-1")).data;
  await request("channels/" + channel.id, {
    method: "PATCH",
    body: { config: { ...channel.config, sender: "not-an-email" } },
  });
  await request("channels/" + channel.id + "/test", {
    method: "POST",
    status: 422,
  });
  await request("channels/" + channel.id, {
    method: "PATCH",
    body: { config: channel.config },
  });
  check(
    (await request("channels/" + channel.id + "/test", { method: "POST" })).data
      .channel.status === "Connected",
    "Channel validation updates persisted status",
  );
  const campaign = (
    await request("campaigns", {
      method: "POST",
      body: {
        name: "API verification campaign",
        channel: "Email",
        segmentId: segment.id,
        templateId: template.id,
        content: storedTemplate.content,
        variantB: {
          ...storedTemplate.content,
          body: "A different invitation.",
        },
        abEnabled: true,
        split: 50,
      },
      status: 201,
    })
  ).data;
  await request("campaigns/" + campaign.id + "/simulate", {
    method: "POST",
    status: 409,
  });
  await request("segments/" + segment.id, { method: "DELETE", status: 409 });
  await request("templates/" + template.id, { method: "DELETE", status: 409 });
  await request("campaigns/" + campaign.id + "/publish", { method: "POST" });
  await request("campaigns/" + campaign.id, { method: "DELETE", status: 409 });
  const run = (
    await request("campaigns/" + campaign.id + "/simulate", {
      method: "POST",
      status: 201,
    })
  ).data;
  check(
    run.result.stats.sent === 200 && run.records.length === 200,
    "Campaign simulation uses reachable audience",
  );
  check(run.result.variants.length === 2, "A/B split executed");
  const events = await request("people/" + run.records[0].personId + "/events");
  check(
    events.data.some((event) => event.runId === run.id),
    "Simulation emits persisted profile events",
  );
  await request("campaigns/" + campaign.id + "/status", {
    method: "POST",
    body: { status: "Paused" },
  });
  await request("campaigns/" + campaign.id, {
    method: "PATCH",
    body: {
      content: { ...storedTemplate.content, body: "Updated after the run." },
    },
  });
  const history = await request("campaigns/" + campaign.id + "/runs");
  check(
    history.data[0].snapshot.content.body === "Your exclusive invitation.",
    "Past runs keep immutable snapshots",
  );
  const duplicate = (
    await request("campaigns/" + campaign.id + "/duplicate", {
      method: "POST",
      status: 201,
    })
  ).data;
  check(
    duplicate.status === "Draft" &&
      duplicate.stats.sent === 0 &&
      duplicate.id !== campaign.id,
    "Duplicate starts with fresh state",
  );
  const invalidJourney = (
    await request("journeys", {
      method: "POST",
      body: { name: "Incomplete journey" },
      status: 201,
    })
  ).data;
  await request("journeys/" + invalidJourney.id + "/publish", {
    method: "POST",
    status: 422,
  });
  const existing = (await request("journeys/shopwise-jrn-0")).data;
  const journey = (
    await request("journeys", {
      method: "POST",
      body: {
        name: "API verification journey",
        nodes: existing.nodes,
        edges: existing.edges,
        goal: "Charged",
        timeoutHours: 168,
      },
      status: 201,
    })
  ).data;
  await request("journeys/" + journey.id + "/publish", { method: "POST" });
  const journeyRun = (
    await request("journeys/" + journey.id + "/simulate", {
      method: "POST",
      status: 201,
    })
  ).data;
  check(
    journeyRun.result.nodes.find((node) => node.id === "entry").entered ===
      1000,
    "Journey audience enters graph",
  );
  const nextVersion = (
    await request("journeys/" + journey.id, {
      method: "PATCH",
      body: { name: "Version two" },
    })
  ).data;
  check(
    nextVersion.version === 2 && nextVersion.status === "Draft",
    "Live journey edits create new draft version",
  );
  check(
    (await request("journeys/" + journey.id + "/runs")).data[0].snapshot
      .version === 1,
    "Original journey version remains in run history",
  );
  const board = (
    await request("boards", {
      method: "POST",
      body: {
        name: "API verification board",
        tiles: [
          {
            id: "t1",
            title: "Purchases",
            event: "Charged",
            metric: "events",
            size: "wide",
          },
        ],
      },
      status: 201,
    })
  ).data;
  check(
    (await request("boards/" + board.id)).data.tiles[0].size === "wide",
    "Board tile layout stored",
  );
  const funnel = await request("analytics/query", {
    method: "POST",
    body: {
      type: "funnel",
      steps: ["App Launched", "Product Viewed", "Added to Cart", "Charged"],
      windowDays: 7,
    },
  });
  check(
    funnel.data.length === 4 &&
      funnel.data.every(
        (step, index) =>
          index === 0 || step.users <= funnel.data[index - 1].users,
      ),
    "Funnel results decrease monotonically",
  );
  const overview = await request("analytics");
  check(
    overview.data.totals.users === 1000 && overview.data.series.length === 30,
    "Overview query uses selected project and dates",
  );
  const exportResponse = await fetch(
    base + "/api/exports/templates?projectId=shopwise&search=verification",
  );
  check(
    exportResponse.ok &&
      (await exportResponse.text()).includes("API verification template"),
    "CSV export honors search",
  );
  const persistId = segment.id;
  await stop();
  await start();
  check(
    (await request("segments/" + persistId)).data.name ===
      "Persisted API audience",
    "Data survives a complete server restart",
  );
  const disposable = (
    await request("segments?projectId=streamly", {
      method: "POST",
      body: { name: "Reset verification audience", query },
      status: 201,
    })
  ).data;
  await request("projects/streamly/reset", {
    method: "POST",
    body: { confirm: "wrong-project" },
    status: 422,
  });
  await request("projects/streamly/reset", {
    method: "POST",
    body: { confirm: "streamly" },
  });
  await request("segments/" + disposable.id + "?projectId=streamly", {
    status: 404,
  });
  check(
    (await request("segments?projectId=streamly")).meta.total === 10 &&
      (await request("segments/" + persistId)).data.id === persistId,
    "Reset restores only the selected project and preserves the other project",
  );
  for (const [resource, id] of [
    ["campaigns", campaign.id],
    ["campaigns", duplicate.id],
    ["journeys", journey.id],
    ["journeys", invalidJourney.id],
    ["templates", template.id],
    ["segments", segment.id],
    ["boards", board.id],
  ])
    await request(resource + "/" + id, { method: "DELETE" });
  await request("segments/" + segment.id, { status: 404 });
  for (const route of [
    "/overview",
    "/segments",
    "/segments/new",
    "/people",
    "/people/shopwise-user-0001",
    "/templates",
    "/templates/shopwise-tpl-0",
    "/settings/channels",
    "/settings/project",
    "/campaigns",
    "/campaigns/new",
    "/journeys",
    "/journeys/shopwise-jrn-0/edit",
    "/analytics/trends",
    "/analytics/funnels",
    "/boards",
    "/boards/shopwise-board-0",
    "/data/schema",
  ]) {
    const response = await fetch(base + route);
    check(response.status === 200, route + " is routable");
  }
  console.log(
    JSON.stringify(
      {
        result: "passed",
        checks,
        persistence: "verified after server restart",
        database: "isolated temporary database",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error);
  console.error(output);
  process.exitCode = 1;
} finally {
  await stop();
  await rm(directory, { recursive: true, force: true });
}
