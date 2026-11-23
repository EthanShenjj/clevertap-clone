// Loaded only by verify-sms.mjs into its isolated test server. No SMS network requests leave it.
import { createHmac, randomUUID } from "node:crypto";
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? input : input.url,
  );
  if (!["api.twilio.com", "rest.nexmo.com"].includes(url.hostname))
    return originalFetch(input, init);
  const headers = new Headers(init.headers),
    form = new URLSearchParams(String(init.body || ""));
  if (
    url.hostname === "api.twilio.com" &&
    url.pathname.includes("/Messages.json")
  ) {
    if (
      headers.get("authorization") !==
        "Basic " +
          Buffer.from("AC" + "0".repeat(32) + ":mock-auth-token").toString(
            "base64",
          ) ||
      !form.get("StatusCallback") ||
      !form.get("To")
    )
      return Response.json({ code: 20003 }, { status: 401 });
    if (form.get("Body") === "mock-reject")
      return Response.json({ code: 21610 }, { status: 400 });
    if (form.get("Body") === "mock-unknown")
      return Response.json({ code: 500 }, { status: 503 });
    const sid = "SM" + randomUUID().replaceAll("-", "");
    if (form.get("Body") === "mock-early-receipt") {
      const receipt = new URLSearchParams({
          MessageSid: sid,
          MessageStatus: "delivered",
        }),
        callback = form.get("StatusCallback");
      const signature = createHmac("sha1", "mock-auth-token")
        .update(
          callback +
            [...receipt.keys()]
              .sort()
              .map((k) => k + receipt.get(k))
              .join(""),
        )
        .digest("base64");
      const ack = await originalFetch(callback, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "X-Twilio-Signature": signature,
        },
        body: receipt,
      });
      if (!ack.ok) throw new Error("Early receipt was rejected");
    }
    return Response.json({ sid, status: "queued" }, { status: 201 });
  }
  if (url.hostname === "rest.nexmo.com") {
    if (
      form.get("api_key") !== "mock-key" ||
      form.get("api_secret") !== "mock-secret" ||
      !form.get("to")
    )
      return Response.json({ messages: [{ status: "4" }] });
    return Response.json({
      messages: [{ status: "0", "message-id": "nexmo-" + randomUUID() }],
    });
  }
  if (url.pathname === "/mock-oauth")
    return Response.json({ access_token: "mock-access-token" });
  if (url.pathname === "/mock-generic") {
    if (headers.get("authorization") !== "Bearer mock-access-token")
      return Response.json({ error: "authentication" }, { status: 401 });
    const payload = JSON.parse(String(init.body));
    if (!payload.to || !payload.messageId)
      return Response.json({ error: "payload" }, { status: 400 });
    return Response.json({ accepted: true });
  }
  throw new Error("Unexpected mock SMS endpoint");
};
