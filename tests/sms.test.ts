import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applySmsReceipt,
  renderSmsPayload,
  smsLength,
} from "../src/lib/sms-protocol.ts";
import type { SmsMessage } from "../src/lib/sms.ts";
const message = (): SmsMessage => ({
  id: "m1",
  projectId: "p1",
  target: "provider1",
  providerId: "provider1",
  groupId: "",
  to: "+12025550123",
  body: "Hi",
  mode: "demo",
  status: "Sent",
  providerMessageId: "pmsg1",
  errorCode: "",
  createdAt: "2026-11-23T01:00:00Z",
  updatedAt: "2026-11-23T01:00:00Z",
  clicked: false,
  replied: false,
  idempotencyKey: "request1",
  attempts: [],
  receipts: [],
});
test("SMS payload replacements preserve quotes, Unicode and nested batch objects", () => {
  const body = 'Hello "Ethan"\n欢迎回来';
  assert.deepEqual(
    renderSmsPayload(
      {
        messages: [{ to: "$$To", body: "$$Body", id: "$$MessageID" }],
        count: 1,
      },
      { To: "+12025550123", Body: body, MessageID: "m1" },
    ),
    { messages: [{ to: "+12025550123", body, id: "m1" }], count: 1 },
  );
  assert.throws(() => renderSmsPayload("$$Missing", {}), /Missing/);
});
test("SMS receipt retries are idempotent and terminal states do not regress", () => {
  const delivered = applySmsReceipt(message(), "delivered", "provider");
  assert.equal(delivered.status, "Delivered");
  assert.deepEqual(
    applySmsReceipt(delivered, "delivered", "provider"),
    delivered,
  );
  const late = applySmsReceipt(delivered, "sent", "provider");
  assert.equal(late.status, "Delivered");
  assert.equal(applySmsReceipt(late, "failed", "provider").status, "Delivered");
  assert.equal(message().status, "Sent");
});
test("Failed messages stay failed while engagement counters are unique", () => {
  const failed = applySmsReceipt(message(), "failed", "provider");
  assert.equal(failed.status, "Failed");
  assert.equal(
    applySmsReceipt(failed, "delivered", "provider").status,
    "Failed",
  );
  let clicked = applySmsReceipt(message(), "clicked", "provider");
  clicked = applySmsReceipt(clicked, "clicked", "provider");
  assert.equal(clicked.clicked, true);
  assert.equal(clicked.receipts.length, 1);
  assert.equal(applySmsReceipt(clicked, "replied", "provider").replied, true);
});
test("SMS length uses GSM extensions and UTF-16 concatenation limits", () => {
  assert.deepEqual(smsLength("A".repeat(160)), {
    encoding: "GSM-7",
    units: 160,
    parts: 1,
  });
  assert.equal(smsLength("A".repeat(161)).parts, 2);
  assert.equal(smsLength("^".repeat(81)).parts, 2);
  assert.deepEqual(smsLength("中".repeat(71)), {
    encoding: "Unicode",
    units: 71,
    parts: 2,
  });
  assert.equal(smsLength("😀".repeat(36)).units, 72);
});
