import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
const directory = await mkdtemp(path.join(os.tmpdir(), "clevertap-sms-")),
  port = Number(process.env.SMS_VERIFY_PORT || 3102),
  base = "http://127.0.0.1:" + port;
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
      "--import",
      path.resolve("tests/sms-provider-mock.mjs"),
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(port),
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        DATABASE_PATH: path.join(directory, "sms.sqlite"),
        SMS_LIVE_ENABLED: "true",
        SMS_ADMIN_TOKEN: "mock-owner-access-token",
        SMS_TEST_RECIPIENTS: "+12025550123",
        SMS_PUBLIC_URL: base,
        SMS_ALLOWED_HOSTS: "api.twilio.com",
        SMS_CREDENTIALS_JSON: JSON.stringify({
          twilio: { authToken: "mock-auth-token" },
          nexmo: {
            apiKey: "mock-key",
            apiSecret: "mock-secret",
            signatureSecret: "mock-signature-secret",
            signatureMethod: "sha256",
          },
          generic: {
            clientId: "mock-client",
            clientSecret: "mock-client-secret",
            callbackSecret: "mock-callback-secret",
          },
        }),
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  for (const stream of [server.stdout, server.stderr])
    stream.on("data", (chunk) => (output = (output + chunk).slice(-12000)));
  for (let i = 0; i < 100; i++) {
    if (server.exitCode !== null) throw new Error(output);
    try {
      if ((await fetch(base + "/api/health")).ok) return;
    } catch {}
    await delay(150);
  }
  throw new Error("SMS server did not start: " + output);
}
async function stop() {
  if (!server || server.exitCode !== null) return;
  const child = server;
  child.kill("SIGTERM");
  await new Promise((resolve) => child.once("exit", resolve));
}
async function request(
  route,
  {
    method = "GET",
    body,
    headers = {},
    status = 200,
    projectId = "shopwise",
    raw,
  } = {},
) {
  const url = new URL(base + "/api/" + route);
  if (!url.searchParams.has("projectId"))
    url.searchParams.set("projectId", projectId);
  const response = await fetch(url, {
    method,
    headers: {
      ...(method !== "GET"
        ? { "Content-Type": "application/json", Origin: base }
        : {}),
      ...headers,
    },
    body:
      raw ??
      (body !== undefined
        ? JSON.stringify(body)
        : method === "POST"
          ? "{}"
          : undefined),
  });
  const text = await response.text();
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    result = { text };
  }
  check(
    response.status === status,
    route +
      " expected " +
      status +
      ", got " +
      response.status +
      ": " +
      text.slice(0, 400),
  );
  return result;
}
const settings = (behavior = "accept", credentialRef = "twilio") => ({
  integration: "direct",
  accountSid: "AC" + "0".repeat(32),
  fromNumber: "+12025550000",
  serviceSid: "",
  senderId: "SHOPWISE",
  templateId: "",
  requireTemplateId: false,
  isDefault: false,
  credentialRef,
  demoBehavior: behavior,
  http: {
    method: "POST",
    endpoint: "",
    authentication: "none",
    tokenEndpoint: "",
    format: "json",
    headers: [],
    payload: '{"to":"$$To","body":"$$Body","messageId":"$$MessageID"}',
    batch: false,
    batchKey: "messages",
    batchSize: 100,
  },
});
let requestId = 0;
const testBody = (target, extra = {}) => ({
  target,
  to: "+12025550123",
  body: "Hello from the SMS test",
  mode: "demo",
  idempotencyKey: "sms-test-" + ++requestId,
  ...extra,
});
const auth = { Authorization: "Bearer mock-owner-access-token" };
try {
  await start();
  const initial = (await request("sms")).data;
  check(initial.providers.length === 1, "legacy SMS provider remains visible");
  const first = (
    await request("sms/providers", {
      method: "POST",
      status: 201,
      body: {
        name: "Primary SMS",
        provider: "Twilio",
        sms: settings("reject"),
      },
    })
  ).data;
  const second = (
    await request("sms/providers", {
      method: "POST",
      status: 201,
      body: {
        name: "Fallback SMS",
        provider: "Nexmo",
        sms: settings("accept", "nexmo"),
      },
    })
  ).data;
  await request("sms/providers/" + first.id + "/validate", { method: "POST" });
  await request("sms/providers/" + second.id + "/validate", { method: "POST" });
  await request("sms/providers/" + first.id, {
    method: "PATCH",
    projectId: "streamly",
    status: 404,
    body: { name: "Wrong project", provider: "Twilio", sms: settings() },
  });
  await request("sms/providers", {
    method: "POST",
    status: 422,
    body: {
      name: "Invalid config",
      provider: "Twilio",
      sms: { ...settings(), authToken: "must-not-save" },
    },
  });
  await request("channels/" + first.id, {
    method: "PATCH",
    status: 422,
    body: { config: { sender: "bypass", domain: "", appId: "" } },
  });
  const group = (
    await request("sms/groups", {
      method: "POST",
      status: 201,
      body: {
        name: "Priority route",
        providerIds: [first.id, second.id],
        isDefault: true,
      },
    })
  ).data;
  await request("sms/groups", {
    method: "POST",
    status: 422,
    body: {
      name: "Duplicate members",
      providerIds: [first.id, first.id],
      isDefault: false,
    },
  });
  const body = testBody("group:" + group.id),
    message = (await request("sms/test", { method: "POST", status: 201, body }))
      .data;
  check(
    message.attempts.length === 2 &&
      message.attempts[0].outcome === "Rejected" &&
      message.providerId === second.id,
    "definite failure falls back in priority order",
  );
  check(message.status === "Sent", "dispatch acceptance is not delivery");
  const retry = (
    await request("sms/test", { method: "POST", status: 201, body })
  ).data;
  check(retry.id === message.id, "test request is idempotent");
  await request("sms/test", {
    method: "POST",
    status: 409,
    body: { ...body, body: "changed" },
  });
  for (const event of [
    "delivered",
    "delivered",
    "sent",
    "clicked",
    "replied",
  ]) {
    await request("sms/messages/" + message.id + "/receipt", {
      method: "POST",
      body: { event },
    });
  }
  const stats = (await request("sms/stats?providerId=" + second.id)).data;
  check(
    stats.sent === 1 &&
      stats.delivered === 1 &&
      stats.clicked === 1 &&
      stats.replied === 1,
    "receipts update unique counters",
  );
  const failedStats = (await request("sms/stats?providerId=" + first.id)).data;
  check(
    failedStats.sent === 0 &&
      failedStats.delivered === 0 &&
      failedStats.errors === 1,
    "fallback receipts are attributed to the provider that sent the SMS",
  );
  await request("sms/test", {
    method: "POST",
    status: 403,
    body: testBody(first.id, { mode: "live" }),
  });
  await request("sms/test", {
    method: "POST",
    status: 403,
    headers: auth,
    body: testBody(first.id, { mode: "live", to: "+12025550999" }),
  });
  const live = (
    await request("sms/test", {
      method: "POST",
      status: 201,
      headers: auth,
      body: testBody(first.id, { mode: "live" }),
    })
  ).data;
  const concurrentBody = testBody(first.id, { mode: "live" });
  const concurrent = await Promise.all([
    request("sms/test", {
      method: "POST",
      status: 201,
      headers: auth,
      body: concurrentBody,
    }),
    request("sms/test", {
      method: "POST",
      status: 201,
      headers: auth,
      body: concurrentBody,
    }),
  ]);
  check(
    concurrent[0].data.id === concurrent[1].data.id,
    "concurrent test requests reserve one message before provider dispatch",
  );
  check(
    live.providerMessageId.startsWith("SM"),
    "Twilio request uses its native authenticated API (mock transport)",
  );
  const callback = "/api/sms/callbacks/" + first.id + "?projectId=shopwise",
    form = new URLSearchParams({
      MessageSid: live.providerMessageId,
      MessageStatus: "delivered",
    });
  const signature = createHmac("sha1", "mock-auth-token")
    .update(
      base +
        callback +
        [...form.keys()]
          .sort()
          .map((k) => k + form.get(k))
          .join(""),
    )
    .digest("base64");
  await request("sms/callbacks/" + first.id, {
    method: "POST",
    status: 403,
    raw: form.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": "invalid",
    },
  });
  await request("sms/callbacks/" + first.id, {
    method: "POST",
    raw: form.toString(),
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature,
      Origin: "https://api.twilio.com",
    },
  });
  await request("sms/messages/" + live.id + "/receipt", {
    method: "POST",
    status: 409,
    body: { event: "failed" },
  });
  const liveLog = (await request("sms/messages?mode=live")).data;
  check(
    liveLog[0].body !== live.body && !liveLog[0].to.startsWith("+"),
    "public logs do not expose live recipient and message content",
  );
  await request("sms/messages?mode=live&search=Hello", { status: 403 });
  check(
    (await request("sms/stats?mode=live")).data.delivered === 1,
    "signed Twilio callback updates delivery",
  );
  const early = (
    await request("sms/test", {
      method: "POST",
      status: 201,
      headers: auth,
      body: testBody(first.id, { mode: "live", body: "mock-early-receipt" }),
    })
  ).data;
  check(
    early.status === "Delivered",
    "a callback arriving before the send response is correlated and not overwritten",
  );
  const unknown = (
    await request("sms/test", {
      method: "POST",
      status: 201,
      headers: auth,
      body: testBody("group:" + group.id, {
        mode: "live",
        body: "mock-unknown",
      }),
    })
  ).data;
  check(
    unknown.status === "Unknown" && unknown.attempts.length === 1,
    "ambiguous transport results do not fall back",
  );
  const fallback = (
    await request("sms/test", {
      method: "POST",
      status: 201,
      headers: auth,
      body: testBody("group:" + group.id, {
        mode: "live",
        body: "mock-reject",
      }),
    })
  ).data;
  check(
    fallback.attempts.length === 2 &&
      fallback.providerMessageId.startsWith("nexmo-"),
    "live dispatch rejection switches to Nexmo (mock transport)",
  );
  const nexmoData = {
    messageId: fallback.providerMessageId,
    status: "delivered",
    timestamp: String(Math.floor(Date.now() / 1000)),
    "err-code": "0",
  };
  const nexmoSig = createHmac("sha256", "mock-signature-secret")
    .update(
      Object.keys(nexmoData)
        .sort()
        .map((k) => "&" + k + "=" + nexmoData[k])
        .join(""),
    )
    .digest("hex");
  await request("sms/callbacks/" + second.id, {
    method: "POST",
    body: { ...nexmoData, sig: nexmoSig },
  });
  const getReceipt = new URLSearchParams({ ...nexmoData, sig: nexmoSig });
  await request("sms/callbacks/" + second.id + "?" + getReceipt.toString());
  const genericSettings = settings("accept", "generic");
  genericSettings.integration = "connect";
  genericSettings.http.endpoint = "https://api.twilio.com/mock-generic";
  genericSettings.http.authentication = "oauth2";
  genericSettings.http.tokenEndpoint = "https://api.twilio.com/mock-oauth";
  const generic = (
    await request("sms/providers", {
      method: "POST",
      status: 201,
      body: {
        name: "Generic OAuth provider",
        provider: "Other (Generic)",
        sms: genericSettings,
      },
    })
  ).data;
  await request("sms/providers/" + generic.id + "/validate", {
    method: "POST",
  });
  const genericMsg = (
    await request("sms/test", {
      method: "POST",
      status: 201,
      headers: auth,
      body: testBody(generic.id, {
        mode: "live",
        body: 'Quotes " and\nUnicode 中文',
      }),
    })
  ).data;
  check(
    genericMsg.status === "Sent",
    "Generic OAuth and JSON payload dispatch succeed (mock transport)",
  );
  const raw = JSON.stringify({ messageId: genericMsg.id, event: "delivered" }),
    timestamp = String(Math.floor(Date.now() / 1000)),
    hmac = createHmac("sha256", "mock-callback-secret")
      .update(timestamp + "." + raw)
      .digest("hex");
  await request("sms/callbacks/" + generic.id, {
    method: "POST",
    raw,
    headers: { "X-SMS-Timestamp": timestamp, "X-SMS-Signature": hmac },
  });
  await request("sms/callbacks/" + generic.id, {
    method: "POST",
    status: 403,
    raw: raw.replace("delivered", "failed"),
    headers: { "X-SMS-Timestamp": timestamp, "X-SMS-Signature": hmac },
  });
  const content = (await request("templates")).data[0].content,
    segment = (await request("segments")).data[0];
  const campaign = (
    await request("campaigns", {
      method: "POST",
      status: 201,
      body: {
        name: "SMS routed campaign",
        channel: "SMS",
        smsTarget: "group:" + group.id,
        segmentId: segment.id,
        content,
      },
    })
  ).data;
  await request("campaigns/" + campaign.id + "/publish", { method: "POST" });
  const run = (
    await request("campaigns/" + campaign.id + "/simulate", {
      method: "POST",
      status: 201,
    })
  ).data;
  check(
    run.result.stats.sent > 0,
    "SMS campaigns execute the selected provider route and write delivery logs",
  );
  const node = (id, kind, extra = {}) => ({
    id,
    type: "journey",
    position: { x: 0, y: 0 },
    data: { kind, label: id, ...extra },
  });
  const journey = (
    await request("journeys", {
      method: "POST",
      status: 201,
      body: {
        name: "SMS routed journey",
        nodes: [
          node("entry", "entry", { segmentId: segment.id }),
          node("sms", "message", {
            channel: "SMS",
            smsTarget: second.id,
            content,
          }),
          node("exit", "exit"),
        ],
        edges: [
          { id: "a", source: "entry", target: "sms" },
          { id: "b", source: "sms", target: "exit", label: "Sent" },
        ],
      },
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
    journeyRun.result.stats.sent > 0,
    "SMS journey nodes execute their selected provider",
  );
  const defaultRequest = testBody("");
  const defaultMessage = (
    await request("sms/test", {
      method: "POST",
      status: 201,
      body: defaultRequest,
    })
  ).data;
  check(
    (
      await request("sms/test", {
        method: "POST",
        status: 201,
        body: defaultRequest,
      })
    ).data.id === defaultMessage.id,
    "default-route requests are idempotent",
  );
  await request("sms/providers/" + first.id, { method: "DELETE", status: 409 });
  const impact = (await request("sms/providers/" + first.id + "/impact")).data;
  check(
    impact.affected.campaigns.some((c) => c.id === campaign.id),
    "archive previews affected campaigns",
  );
  await request("sms/providers/" + first.id + "/archive", {
    method: "POST",
    body: { confirm: true },
  });
  check(
    (await request("campaigns/" + campaign.id)).data.status === "Stopped",
    "archiving stops affected active campaigns",
  );
  await request("sms/providers/" + first.id + "/validate", {
    method: "POST",
    status: 409,
  });
  check(
    (await request("sms/providers/" + first.id)).data.status === "Archived",
    "archived provider and statistics remain available",
  );
  const before = (await request("sms/messages?pageSize=1")).meta.total;
  await stop();
  await start();
  check(
    (await request("sms/messages?pageSize=1")).meta.total === before,
    "SMS logs persist across a full server restart",
  );
  const other = (await request("sms", { projectId: "streamly" })).data;
  check(
    !other.groups.length && !other.providers.some((p) => p.id === first.id),
    "SMS data is isolated by project",
  );
  await request("projects/shopwise/reset", {
    method: "POST",
    body: { confirm: "shopwise" },
  });
  check(
    (await request("sms/messages")).meta.total === 0,
    "project reset includes SMS logs",
  );
  console.log(
    "SMS verification passed: " +
      checks +
      " checks. Provider HTTP calls were mocked; no real SMS was sent.",
  );
} catch (error) {
  console.error(output);
  throw error;
} finally {
  await stop();
  await rm(directory, { recursive: true, force: true });
}
