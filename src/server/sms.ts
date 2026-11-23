import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { z } from "zod";
import {
  defaultSmsSettings,
  SMS_PROVIDERS,
  type SmsGroup,
  type SmsMessage,
  type SmsStats,
  type SmsReceiptEvent,
} from "@/lib/sms";
import { applySmsReceipt, renderSmsPayload } from "@/lib/sms-protocol";
import type { Campaign, Channel, Journey } from "@/lib/types";
import { allEntities, base, getDb, writeEntity } from "./database";
import { ApiError } from "./api-error";

export const smsSettingsSchema = z
  .object({
    integration: z.enum(["direct", "connect"]),
    accountSid: z.string().max(100),
    fromNumber: z.string().max(30),
    serviceSid: z.string().max(100),
    senderId: z.string().max(100),
    templateId: z.string().max(100),
    requireTemplateId: z.boolean(),
    isDefault: z.boolean(),
    credentialRef: z
      .string()
      .max(100)
      .regex(/^[\w-]*$/),
    demoBehavior: z.enum(["accept", "reject"]),
    http: z
      .object({
        method: z.enum(["GET", "POST"]),
        endpoint: z.string().max(2000),
        authentication: z.enum(["none", "basic", "oauth2"]),
        tokenEndpoint: z.string().max(2000),
        format: z.enum(["json", "form"]),
        headers: z
          .array(
            z
              .object({ key: z.string().max(100), value: z.string().max(1000) })
              .strict(),
          )
          .max(20),
        payload: z.string().max(20000),
        batch: z.boolean(),
        batchKey: z.string().max(100),
        batchSize: z.number().int().min(1).max(1000),
      })
      .strict(),
  })
  .strict();
type Credentials = Record<string, string>;
function credentialProfiles(): Record<string, Credentials> {
  try {
    return z
      .record(z.string(), z.record(z.string(), z.string()))
      .parse(JSON.parse(process.env.SMS_CREDENTIALS_JSON || "{}"));
  } catch {
    throw new ApiError(
      503,
      "SMS_CONFIGURATION_ERROR",
      "SMS credential profiles are not configured correctly.",
    );
  }
}
function credentials(provider: Channel): Credentials {
  return credentialProfiles()[provider.sms?.credentialRef || ""] || {};
}
function isLiveEnabled() {
  return (
    process.env.SMS_LIVE_ENABLED === "true" && !!process.env.SMS_ADMIN_TOKEN
  );
}
function requireLiveAccess(request: Request) {
  if (
    !isLiveEnabled() ||
    !secureEqual(
      request.headers.get("authorization") || "",
      "Bearer " + process.env.SMS_ADMIN_TOKEN,
    )
  )
    throw new ApiError(
      403,
      "LIVE_SMS_DISABLED",
      "Live sending requires the deployment owner's sending access token.",
    );
}
function secureEqual(first: string, second: string) {
  const a = Buffer.from(first),
    b = Buffer.from(second);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function normalizeSmsProvider(item: Channel): Channel {
  const defaults = defaultSmsSettings(
    item.provider === "Other (Generic)" ? "connect" : "direct",
  );
  const legacy = !item.sms;
  return {
    ...item,
    provider: SMS_PROVIDERS.includes(
      item.provider as (typeof SMS_PROVIDERS)[number],
    )
      ? item.provider
      : "Other (Generic)",
    sms: {
      ...defaults,
      ...(legacy
        ? {
            fromNumber: "+15550000001",
            accountSid: "AC" + "0".repeat(32),
            isDefault: true,
          }
        : item.sms),
      http: { ...defaults.http, ...item.sms?.http },
    },
  };
}
export function smsProviders(projectId: string) {
  return allEntities<Channel>("channels", projectId)
    .filter((c) => c.channel === "SMS")
    .map(normalizeSmsProvider);
}
function providerById(projectId: string, id: string) {
  const provider = smsProviders(projectId).find((p) => p.id === id);
  if (!provider)
    throw new ApiError(
      404,
      "NOT_FOUND",
      "SMS provider not found in this project.",
    );
  return provider;
}
export function smsGroups(projectId: string): SmsGroup[] {
  return getDb()
    .prepare("SELECT data FROM sms_groups WHERE project_id=? ORDER BY id")
    .all(projectId)
    .map((r) => JSON.parse(String(r.data)));
}
function writeGroup(group: SmsGroup) {
  getDb()
    .prepare(
      "INSERT INTO sms_groups VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    )
    .run(group.id, group.projectId, JSON.stringify(group));
}
export function validateSmsSettings(provider: Channel) {
  const s = provider.sms!;
  const errors: Record<string, string> = {};
  if (provider.provider === "Twilio") {
    if (!/^AC[\da-f]{32}$/i.test(s.accountSid))
      errors.accountSid =
        "Enter an Account SID starting with AC followed by 32 hexadecimal characters.";
    if (!s.serviceSid && !/^\+[1-9]\d{6,14}$/.test(s.fromNumber))
      errors.fromNumber =
        "Enter an international From Number or a Messaging Service SID.";
    if (s.serviceSid && !/^MG[\da-f]{32}$/i.test(s.serviceSid))
      errors.serviceSid = "Enter a valid Messaging Service SID.";
  } else if (provider.provider === "Nexmo") {
    if (!s.senderId.trim())
      errors.senderId = "Enter a sender ID or phone number.";
  } else {
    for (const [key, value] of [
      ["endpoint", s.http.endpoint],
      ...(s.http.authentication === "oauth2"
        ? [["tokenEndpoint", s.http.tokenEndpoint]]
        : []),
    ]) {
      try {
        const url = new URL(value);
        if (
          url.protocol !== "https:" ||
          url.username ||
          url.password ||
          url.hash
        )
          throw new Error();
      } catch {
        errors[key] = "Use an HTTPS URL without credentials or a fragment.";
      }
    }
    try {
      const payload = JSON.parse(s.http.payload);
      if (!payload || Array.isArray(payload) || typeof payload !== "object")
        throw new Error();
      const serialized = JSON.stringify(payload);
      if (
        !serialized.includes("$$To") ||
        (!serialized.includes("$$Body") && !serialized.includes("$$TemplateID"))
      )
        errors.payload =
          "Include $$To and either $$Body or $$TemplateID in the payload.";
      if (
        s.http.format === "form" &&
        Object.values(payload).some((v) => typeof v === "object")
      )
        errors.payload = "Form parameters must contain flat key/value pairs.";
      if (
        s.http.batch &&
        (!Array.isArray(payload[s.http.batchKey]) ||
          payload[s.http.batchKey].length !== 1)
      )
        errors.payload =
          "The batch key must point to an array containing one message object.";
    } catch {
      errors.payload = "Enter a valid JSON object.";
    }
    if (s.http.batch && (s.http.format !== "json" || s.http.method !== "POST"))
      errors.payload = "Batching requires a POST request with JSON parameters.";
    for (const header of s.http.headers) {
      if (
        !/^[\w-]+$/.test(header.key) ||
        /^(host|content-length|connection|cookie)$/i.test(header.key)
      )
        errors.headers =
          "Use valid application headers; transport and cookie headers are not allowed.";
      if (
        /authorization|api[-_]?key|token|secret/i.test(header.key) &&
        !header.value.includes("$$Secret_")
      )
        errors.headers =
          "Use a $$Secret_name reference for credentials; do not save secret values in headers.";
      if (/[\r\n]/.test(header.value))
        errors.headers = "Header values must not contain newlines.";
    }
  }
  if (s.requireTemplateId && !s.templateId.trim())
    errors.templateId = "Enter the required template ID.";
  if (Object.keys(errors).length)
    throw new ApiError(
      422,
      "VALIDATION_FAILED",
      Object.values(errors)[0],
      errors,
    );
}
export function validateSmsTarget(projectId: string, target = "") {
  let providers: Channel[];
  if (target.startsWith("group:")) {
    const group = smsGroups(projectId).find((g) => g.id === target.slice(6));
    if (!group)
      throw new ApiError(
        422,
        "INVALID_SMS_TARGET",
        "Choose an SMS provider group in this project.",
      );
    providers = group.providerIds.map((id) => providerById(projectId, id));
  } else if (target) providers = [providerById(projectId, target)];
  else {
    const group = smsGroups(projectId).find((g) => g.isDefault);
    if (group)
      providers = group.providerIds.map((id) => providerById(projectId, id));
    else {
      const list = smsProviders(projectId);
      const selected =
        list.find((p) => p.sms?.isDefault && p.status === "Connected") ||
        list.find((p) => p.status === "Connected");
      providers = selected ? [selected] : [];
    }
  }
  if (!providers.length || providers.some((p) => p.status !== "Connected"))
    throw new ApiError(
      422,
      "SMS_NOT_READY",
      "Validate every selected SMS provider before using it.",
    );
  return providers;
}
function clearDefaults(projectId: string) {
  for (const p of smsProviders(projectId))
    if (p.sms!.isDefault) {
      p.sms!.isDefault = false;
      writeEntity("channels", p);
    }
  for (const g of smsGroups(projectId))
    if (g.isDefault) {
      g.isDefault = false;
      writeGroup(g);
    }
}
export function saveSmsProvider(
  projectId: string,
  input: unknown,
  id?: string,
) {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      provider: z.enum(SMS_PROVIDERS),
      sms: smsSettingsSchema,
    })
    .strict()
    .parse(input);
  const previous = id ? providerById(projectId, id) : undefined;
  if (previous?.status === "Archived")
    throw new ApiError(
      409,
      "PROVIDER_ARCHIVED",
      "Archived providers cannot be edited or restored.",
    );
  if (
    smsProviders(projectId).some(
      (p) => p.id !== id && p.name.toLowerCase() === parsed.name.toLowerCase(),
    )
  )
    throw new ApiError(
      409,
      "DUPLICATE_NAME",
      "Choose a unique provider nickname.",
    );
  const sms = parsed.sms;
  sms.integration =
    parsed.provider === "Other (Generic)" ? "connect" : "direct";
  const item: Channel = {
    ...base(
      id || "sms-" + randomUUID(),
      projectId,
      parsed.name,
      "Not connected",
    ),
    ...previous,
    ...parsed,
    channel: "SMS",
    config: { sender: "", domain: "", appId: "" },
    updatedAt: new Date().toISOString(),
  };
  validateSmsSettings(item);
  const changed =
    !previous ||
    previous.provider !== item.provider ||
    JSON.stringify({ ...previous.sms, isDefault: false }) !==
      JSON.stringify({ ...sms, isDefault: false });
  if (changed) {
    item.status = "Not connected";
    delete item.checkedAt;
  }
  if (sms.isDefault) clearDefaults(projectId);
  writeEntity("channels", item);
  return item;
}
function affectedEngagements(projectId: string, providerId: string) {
  const groupTargets = smsGroups(projectId)
    .filter((g) => g.providerIds.includes(providerId))
    .map((g) => "group:" + g.id);
  const active = ["Running", "Scheduled", "Paused"];
  return {
    campaigns: allEntities<Campaign>("campaigns", projectId).filter(
      (c) =>
        c.channel === "SMS" &&
        active.includes(c.status) &&
        (!c.smsTarget ||
          c.smsTarget === providerId ||
          groupTargets.includes(c.smsTarget)),
    ),
    journeys: allEntities<Journey>("journeys", projectId).filter(
      (j) =>
        active.includes(j.status) &&
        j.nodes.some(
          (n) =>
            n.data.channel === "SMS" &&
            (!n.data.smsTarget ||
              n.data.smsTarget === providerId ||
              groupTargets.includes(n.data.smsTarget)),
        ),
    ),
  };
}
export function archiveSmsProvider(
  projectId: string,
  id: string,
  confirm = false,
) {
  const item = providerById(projectId, id),
    affected = affectedEngagements(projectId, id);
  if (!confirm) return { affected };
  item.status = "Archived";
  item.sms!.isDefault = false;
  item.updatedAt = new Date().toISOString();
  writeEntity("channels", item);
  for (const campaign of affected.campaigns) {
    campaign.status = "Stopped";
    writeEntity("campaigns", campaign);
  }
  for (const journey of affected.journeys) {
    journey.status = "Stopped";
    writeEntity("journeys", journey);
  }
  for (const group of smsGroups(projectId).filter((g) =>
    g.providerIds.includes(id),
  )) {
    group.isDefault = false;
    writeGroup(group);
  }
  return { provider: item, affected };
}
function saveGroup(projectId: string, input: unknown, id?: string) {
  const parsed = z
    .object({
      name: z.string().trim().min(2).max(120),
      providerIds: z.array(z.string()).min(1).max(10),
      isDefault: z.boolean(),
    })
    .strict()
    .parse(input);
  if (new Set(parsed.providerIds).size !== parsed.providerIds.length)
    throw new ApiError(
      422,
      "DUPLICATE_PROVIDER",
      "A provider can appear only once in a group.",
    );
  for (const providerId of parsed.providerIds)
    if (providerById(projectId, providerId).status !== "Connected")
      throw new ApiError(
        422,
        "SMS_NOT_READY",
        "Only validated providers can be added to a group.",
      );
  const list = smsGroups(projectId),
    previous = id ? list.find((g) => g.id === id) : undefined;
  if (id && !previous)
    throw new ApiError(404, "NOT_FOUND", "Provider group not found.");
  if (
    list.some(
      (g) => g.id !== id && g.name.toLowerCase() === parsed.name.toLowerCase(),
    )
  )
    throw new ApiError(409, "DUPLICATE_NAME", "Choose a unique group name.");
  const now = new Date().toISOString();
  const group: SmsGroup = {
    id: id || "smsg-" + randomUUID(),
    projectId,
    createdAt: previous?.createdAt || now,
    updatedAt: now,
    ...parsed,
  };
  if (group.isDefault) clearDefaults(projectId);
  writeGroup(group);
  return group;
}
function messages(projectId: string): SmsMessage[] {
  return getDb()
    .prepare(
      "SELECT data FROM sms_messages WHERE project_id=? ORDER BY created_at DESC",
    )
    .all(projectId)
    .map((r) => JSON.parse(String(r.data)));
}
function writeMessage(message: SmsMessage) {
  getDb()
    .prepare(
      "INSERT INTO sms_messages VALUES (?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
    )
    .run(
      message.id,
      message.projectId,
      message.idempotencyKey,
      message.createdAt,
      JSON.stringify(message),
    );
}
function selectedMessages(projectId: string, params: URLSearchParams) {
  const provider = params.get("providerId"),
    group = params.get("groupId"),
    mode = params.get("mode") || "demo",
    status = params.get("status"),
    search = (params.get("search") || "").toLowerCase();
  const from = params.get("from"),
    to = params.get("to");
  if (!["demo", "live"].includes(mode))
    throw new ApiError(400, "INVALID_MODE", "Choose demo or live messages.");
  for (const date of [from, to])
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)))
    )
      throw new ApiError(400, "INVALID_DATE", "Use a valid YYYY-MM-DD date.");
  if (from && to && from > to)
    throw new ApiError(
      400,
      "INVALID_RANGE",
      "The start date must precede the end date.",
    );
  return messages(projectId).filter(
    (m) =>
      (!provider ||
        m.providerId === provider ||
        m.attempts.some((a) => a.providerId === provider)) &&
      (!group || m.groupId === group) &&
      (!mode || mode === "all" || m.mode === mode) &&
      (!status || status === "All" || m.status === status) &&
      (!from || m.createdAt.slice(0, 10) >= from) &&
      (!to || m.createdAt.slice(0, 10) <= to) &&
      (!search ||
        (m.to + " " + m.body + " " + m.id).toLowerCase().includes(search)),
  );
}
function stats(items: SmsMessage[], providerId: string | null): SmsStats {
  const owns = (m: SmsMessage) => !providerId || m.providerId === providerId;
  const errorCount = (m: SmsMessage) =>
    m.attempts.filter(
      (a) =>
        (!providerId || a.providerId === providerId) &&
        a.outcome !== "Accepted",
    ).length + +(owns(m) && !!m.providerMessageId && m.status === "Failed");
  const sent = items.filter((m) => owns(m) && m.providerMessageId).length,
    delivered = items.filter((m) => owns(m) && m.status === "Delivered").length;
  const clicked = items.filter((m) => owns(m) && m.clicked).length,
    replied = items.filter((m) => owns(m) && m.replied).length,
    errors = items.reduce((total, m) => total + errorCount(m), 0);
  const daily = new Map<
    string,
    { date: string; sent: number; delivered: number; errors: number }
  >();
  for (const m of items) {
    const date = m.createdAt.slice(0, 10);
    const row = daily.get(date) || { date, sent: 0, delivered: 0, errors: 0 };
    row.sent += +(owns(m) && !!m.providerMessageId);
    row.delivered += +(owns(m) && m.status === "Delivered");
    row.errors += errorCount(m);
    daily.set(date, row);
  }
  return {
    sent,
    delivered,
    clicked,
    replied,
    errors,
    deliveryRate: sent ? (delivered / sent) * 100 : 0,
    clickRate: sent ? (clicked / sent) * 100 : 0,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}

async function allowedUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(
      422,
      "INVALID_ENDPOINT",
      "Enter a valid HTTPS endpoint.",
    );
  }
  const hosts = (process.env.SMS_ALLOWED_HOSTS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443") ||
    !hosts.includes(url.hostname.toLowerCase()) ||
    url.hostname === "localhost" ||
    isIP(url.hostname) ||
    url.hostname.includes(":")
  )
    throw new ApiError(
      403,
      "ENDPOINT_NOT_ALLOWED",
      "The deployment owner must allow this SMS endpoint host.",
    );
  const addresses = await lookup(url.hostname, { all: true }).catch(() => []);
  if (
    !addresses.length ||
    addresses.some(({ address }) => {
      if (isIP(address) === 6)
        return !/^[23]/i.test(address) || /^2001:(db8|0:)/i.test(address);
      const [a, b] = address.split(".").map(Number);
      return (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && (b === 168 || b === 0)) ||
        (a === 100 && b >= 64 && b <= 127) ||
        (a === 198 && (b === 18 || b === 19))
      );
    })
  )
    throw new ApiError(
      403,
      "ENDPOINT_NOT_ALLOWED",
      "SMS endpoints must resolve to public addresses.",
    );
  return url;
}
async function providerFetch(url: string, init: RequestInit) {
  try {
    return await fetch(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new ApiError(
      502,
      "DISPATCH_UNKNOWN",
      "The provider response is unknown. Check the provider before retrying; no fallback was attempted.",
    );
  }
}
type DispatchResult = { id: string; errorCode: string; uncertain?: boolean };
async function dispatch(
  provider: Channel,
  message: SmsMessage,
  callbackUrl: string,
): Promise<DispatchResult> {
  const s = provider.sms!,
    c = credentials(provider);
  if (provider.provider === "Twilio") {
    if (!c.authToken)
      throw new ApiError(
        422,
        "CREDENTIALS_MISSING",
        "Configure the Twilio credential profile on the server.",
      );
    const payload = new URLSearchParams({
      To: message.to,
      Body: message.body,
      StatusCallback: callbackUrl,
    });
    if (s.serviceSid) payload.set("MessagingServiceSid", s.serviceSid);
    else payload.set("From", s.fromNumber);
    const response = await providerFetch(
      "https://api.twilio.com/2010-04-01/Accounts/" +
        s.accountSid +
        "/Messages.json",
      {
        method: "POST",
        headers: {
          Authorization:
            "Basic " +
            Buffer.from(s.accountSid + ":" + c.authToken).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: payload,
      },
    );
    const data = await response.json().catch(() => ({}));
    if (response.ok && typeof data.sid === "string")
      return { id: data.sid, errorCode: "" };
    return {
      id: "",
      errorCode: "TWILIO_HTTP_" + response.status,
      uncertain: response.ok || response.status >= 500,
    };
  }
  if (provider.provider === "Nexmo") {
    if (!c.apiKey || !c.apiSecret)
      throw new ApiError(
        422,
        "CREDENTIALS_MISSING",
        "Configure the Nexmo credential profile on the server.",
      );
    const response = await providerFetch("https://rest.nexmo.com/sms/json", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        api_key: c.apiKey,
        api_secret: c.apiSecret,
        from: s.senderId,
        to: message.to.replace(/^\+/, ""),
        text: message.body,
        "status-report-req": "true",
        callback: callbackUrl,
        type: "unicode",
      }),
    });
    const data = await response.json().catch(() => ({}));
    const entry = data.messages?.[0];
    return entry?.status === "0" && entry["message-id"]
      ? { id: String(entry["message-id"]), errorCode: "" }
      : {
          id: "",
          errorCode: "NEXMO_REJECTED",
          uncertain: !entry || response.status >= 500,
        };
  }
  const url = await allowedUrl(s.http.endpoint);
  const replacements: Record<string, string> = {
    To: message.to,
    Body: message.body,
    TemplateID: s.templateId,
    TemplateVariables: "{}",
    MessageID: message.id,
    CampaignID: "test",
    CallbackURL: callbackUrl,
    Sender: s.senderId,
  };
  for (const [key, value] of Object.entries(c))
    replacements["Secret_" + key] = value;
  let payload: unknown;
  try {
    payload = renderSmsPayload(JSON.parse(s.http.payload), replacements);
  } catch (error) {
    throw new ApiError(422, "INVALID_PAYLOAD", (error as Error).message);
  }
  const headers = new Headers();
  for (const h of s.http.headers) {
    try {
      headers.set(h.key, String(renderSmsPayload(h.value, replacements)));
    } catch {
      throw new ApiError(
        422,
        "CREDENTIALS_MISSING",
        "A credential referenced by an SMS header is missing.",
      );
    }
  }
  if (s.http.authentication === "basic") {
    if (!c.username || !c.password)
      throw new ApiError(
        422,
        "CREDENTIALS_MISSING",
        "Configure Basic Authentication credentials on the server.",
      );
    headers.set(
      "Authorization",
      "Basic " + Buffer.from(c.username + ":" + c.password).toString("base64"),
    );
  }
  if (s.http.authentication === "oauth2") {
    const tokenUrl = await allowedUrl(s.http.tokenEndpoint);
    if (!c.clientId || !c.clientSecret)
      throw new ApiError(
        422,
        "CREDENTIALS_MISSING",
        "Configure OAuth client credentials on the server.",
      );
    const tokenResponse = await providerFetch(tokenUrl.href, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: c.clientId,
        client_secret: c.clientSecret,
      }),
    });
    const token = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok || !token.access_token)
      throw new ApiError(
        422,
        "AUTHENTICATION_FAILED",
        "The SMS provider rejected OAuth authentication.",
      );
    headers.set("Authorization", "Bearer " + token.access_token);
  }
  const form = new URLSearchParams(
    Object.entries(payload as Record<string, unknown>).map(([k, v]) => [
      k,
      String(v),
    ]),
  );
  if (s.http.method === "GET")
    for (const [key, value] of form) url.searchParams.set(key, value);
  else
    headers.set(
      "Content-Type",
      s.http.format === "json"
        ? "application/json"
        : "application/x-www-form-urlencoded",
    );
  const response = await providerFetch(url.href, {
    method: s.http.method,
    headers,
    body:
      s.http.method === "GET"
        ? undefined
        : s.http.format === "json"
          ? JSON.stringify(payload)
          : form,
  });
  if (!response.ok)
    return {
      id: "",
      errorCode: "HTTP_" + response.status,
      uncertain: response.status >= 500,
    };
  return { id: message.id, errorCode: "" };
}
function callbackUrl(
  request: Request,
  projectId: string,
  providerId: string,
  messageId?: string,
) {
  const origin = process.env.SMS_PUBLIC_URL || new URL(request.url).origin;
  return new URL(
    "/api/sms/callbacks/" +
      providerId +
      "?projectId=" +
      encodeURIComponent(projectId) +
      (messageId ? "&messageId=" + encodeURIComponent(messageId) : ""),
    origin,
  ).href;
}
function messageForKey(projectId: string, key: string): SmsMessage | undefined {
  const row = getDb()
    .prepare(
      "SELECT data FROM sms_messages WHERE project_id=? AND idempotency_key=?",
    )
    .get(projectId, key);
  return row ? JSON.parse(String(row.data)) : undefined;
}
export function simulateSmsDelivery(
  projectId: string,
  target: string,
  to: string,
  body: string,
  key: string,
  clicked: boolean,
  replied = false,
) {
  const previous = messageForKey(projectId, key);
  if (previous) return previous;
  const list = validateSmsTarget(projectId, target),
    now = new Date().toISOString();
  let message: SmsMessage = {
    id: "smsm-" + randomUUID(),
    projectId,
    target,
    providerId: list[0].id,
    groupId: target.startsWith("group:") ? target.slice(6) : "",
    to,
    body,
    mode: "demo",
    status: "Failed",
    providerMessageId: "",
    errorCode: "",
    createdAt: now,
    updatedAt: now,
    clicked: false,
    replied: false,
    idempotencyKey: key,
    attempts: [],
    receipts: [],
  };
  for (const provider of list) {
    const rejected = provider.sms!.demoBehavior === "reject";
    message.providerId = provider.id;
    message.errorCode = rejected ? "DEMO_DISPATCH_REJECTED" : "";
    message.attempts.push({
      providerId: provider.id,
      outcome: rejected ? "Rejected" : "Accepted",
      errorCode: message.errorCode,
    });
    if (!rejected) {
      message.providerMessageId = "demo-" + randomUUID();
      message.status = "Sent";
      message = applySmsReceipt(message, "delivered", "simulator");
      if (clicked) message = applySmsReceipt(message, "clicked", "simulator");
      if (replied) message = applySmsReceipt(message, "replied", "simulator");
      break;
    }
  }
  writeMessage(message);
  return message;
}
async function sendTest(request: Request, projectId: string, input: unknown) {
  const data = z
    .object({
      target: z.string().max(100),
      to: z
        .string()
        .regex(
          /^\+[1-9]\d{6,14}$/,
          "Use an international phone number, for example +12025550123.",
        ),
      body: z.string().trim().min(1).max(1600),
      mode: z.enum(["demo", "live"]),
      idempotencyKey: z.string().min(8).max(100),
    })
    .strict()
    .parse(input);
  if (data.mode === "live") requireLiveAccess(request);
  const previous = messageForKey(projectId, data.idempotencyKey);
  if (previous) {
    if (
      previous.to !== data.to ||
      previous.body !== data.body ||
      previous.mode !== data.mode ||
      previous.target !== data.target
    )
      throw new ApiError(
        409,
        "IDEMPOTENCY_CONFLICT",
        "This request key was already used for a different message.",
      );
    return previous;
  }
  const list = validateSmsTarget(projectId, data.target);
  if (data.mode === "live") {
    const recipients = (process.env.SMS_TEST_RECIPIENTS || "")
      .split(",")
      .map((v) => v.trim());
    if (!recipients.includes(data.to))
      throw new ApiError(
        403,
        "RECIPIENT_NOT_ALLOWED",
        "This test recipient has not been allowed by the deployment owner.",
      );
    if (
      messages(projectId).filter(
        (m) =>
          m.mode === "live" && Date.parse(m.createdAt) > Date.now() - 3600000,
      ).length >= 20
    )
      throw new ApiError(
        429,
        "SMS_RATE_LIMIT",
        "The hourly live test limit has been reached.",
      );
  }
  const now = new Date().toISOString();
  const message: SmsMessage = {
    id: "smsm-" + randomUUID(),
    projectId,
    target: data.target,
    providerId: list[0].id,
    groupId: data.target.startsWith("group:") ? data.target.slice(6) : "",
    to: data.to,
    body: data.body,
    mode: data.mode,
    status: "Queued",
    providerMessageId: "",
    errorCode: "",
    createdAt: now,
    updatedAt: now,
    clicked: false,
    replied: false,
    idempotencyKey: data.idempotencyKey,
    attempts: [],
    receipts: [],
  };
  // Reserve the request before awaiting HTTP so concurrent local requests cannot double-send.
  writeMessage(message);
  for (const provider of list) {
    validateSmsSettings(provider);
    message.providerId = provider.id;
    writeMessage(message);
    let result: DispatchResult;
    try {
      result =
        data.mode === "demo"
          ? provider.sms!.demoBehavior === "reject"
            ? { id: "", errorCode: "DEMO_DISPATCH_REJECTED" }
            : { id: "demo-" + randomUUID(), errorCode: "" }
          : await dispatch(
              provider,
              message,
              callbackUrl(request, projectId, provider.id, message.id),
            );
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      result = {
        id: "",
        errorCode: error.code,
        uncertain: error.code === "DISPATCH_UNKNOWN",
      };
      if (error.code !== "DISPATCH_UNKNOWN") {
        message.attempts.push({
          providerId: provider.id,
          outcome: "Rejected",
          errorCode: error.code,
        });
        message.status = "Failed";
        message.errorCode = error.code;
        break;
      }
    }
    message.attempts.push({
      providerId: provider.id,
      outcome: result.uncertain
        ? "Unknown"
        : result.id
          ? "Accepted"
          : "Rejected",
      errorCode: result.errorCode,
    });
    message.errorCode = result.errorCode;
    if (result.id) {
      message.providerMessageId = result.id;
      message.status = "Sent";
      break;
    }
    message.status = result.uncertain ? "Unknown" : "Failed";
    if (result.uncertain) break;
  }
  const received = messageForKey(projectId, message.idempotencyKey);
  if (received?.providerId === message.providerId) {
    if (!message.providerMessageId && received.providerMessageId)
      message.providerMessageId = received.providerMessageId;
    for (const receipt of received.receipts) {
      Object.assign(
        message,
        applySmsReceipt(message, receipt.event, receipt.source, receipt.at),
      );
    }
  }
  writeMessage(message);
  return message;
}

async function readJson(request: Request) {
  const text = await request.text();
  if (text.length > 40000)
    throw new ApiError(413, "BODY_TOO_LARGE", "SMS request is too large.");
  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Send a valid JSON object.");
  }
}
async function receiveCallback(
  request: Request,
  projectId: string,
  id: string,
) {
  const provider = providerById(projectId, id),
    c = credentials(provider),
    raw = await request.text();
  if (raw.length > 40000)
    throw new ApiError(413, "BODY_TOO_LARGE", "SMS callback is too large.");
  let providerMessageId = "",
    event: SmsReceiptEvent | undefined,
    errorCode = "",
    incomingFrom = "",
    incomingTo = "";
  if (provider.provider === "Twilio") {
    if (request.method !== "POST")
      throw new ApiError(
        405,
        "METHOD_NOT_ALLOWED",
        "Twilio callbacks must use POST.",
      );
    if (!c.authToken)
      throw new ApiError(
        403,
        "INVALID_SIGNATURE",
        "Callback signature is invalid.",
      );
    const params = new URLSearchParams(raw);
    const incomingUrl = new URL(request.url);
    const signedUrl = new URL(
      incomingUrl.pathname + incomingUrl.search,
      process.env.SMS_PUBLIC_URL || incomingUrl.origin,
    ).href;
    const payload =
      signedUrl +
      [...new Set(params.keys())]
        .sort()
        .map((k) => k + params.get(k))
        .join("");
    const signature = createHmac("sha1", c.authToken)
      .update(payload)
      .digest("base64");
    if (
      !secureEqual(signature, request.headers.get("x-twilio-signature") || "")
    )
      throw new ApiError(
        403,
        "INVALID_SIGNATURE",
        "Callback signature is invalid.",
      );
    providerMessageId = params.get("MessageSid") || "";
    const status = params.get("MessageStatus");
    event =
      status === "delivered"
        ? "delivered"
        : ["failed", "undelivered"].includes(status || "")
          ? "failed"
          : status === "sent"
            ? "sent"
            : undefined;
    if (!status && params.has("Body")) {
      event = "replied";
      incomingFrom = params.get("From") || "";
      incomingTo = params.get("To") || "";
    }
    errorCode = (params.get("ErrorCode") || "")
      .replace(/[^\w-]/g, "")
      .slice(0, 100);
  } else if (provider.provider === "Nexmo") {
    let params: Record<string, string>;
    try {
      params =
        request.method === "GET"
          ? Object.fromEntries(new URL(request.url).searchParams)
          : (request.headers.get("content-type") || "").includes(
                "application/json",
              )
            ? JSON.parse(raw)
            : Object.fromEntries(new URLSearchParams(raw));
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Enter a valid Nexmo callback.");
    }
    delete params.projectId;
    const sig = params.sig || "";
    delete params.sig;
    const value = Object.keys(params)
      .sort()
      .map((key) => "&" + key + "=" + String(params[key]).replace(/[&=]/g, "_"))
      .join("");
    const algorithm = c.signatureMethod || "sha256";
    const validAlgorithms = ["md5hash", "md5", "sha1", "sha256", "sha512"];
    if (
      !c.signatureSecret ||
      !validAlgorithms.includes(algorithm) ||
      !/^\d+$/.test(params.timestamp || "") ||
      Math.abs(Date.now() / 1000 - Number(params.timestamp)) > 300
    )
      throw new ApiError(
        403,
        "INVALID_SIGNATURE",
        "Nexmo callback signature is invalid or expired.",
      );
    const expected =
      algorithm === "md5hash"
        ? createHash("md5")
            .update(value + c.signatureSecret)
            .digest("hex")
        : createHmac(algorithm, c.signatureSecret).update(value).digest("hex");
    if (!secureEqual(expected, sig))
      throw new ApiError(
        403,
        "INVALID_SIGNATURE",
        "Nexmo callback signature is invalid.",
      );
    providerMessageId = params.messageId || "";
    event =
      params.status === "delivered"
        ? "delivered"
        : ["failed", "rejected", "expired", "undeliverable"].includes(
              params.status,
            )
          ? "failed"
          : ["accepted", "buffered"].includes(params.status)
            ? "sent"
            : undefined;
    if (!params.status && params.text) {
      event = "replied";
      incomingFrom = "+" + String(params.msisdn || "").replace(/^\+/, "");
      incomingTo = String(params.to || "");
    }
    errorCode = String(params["err-code"] || "")
      .replace(/[^\w-]/g, "")
      .slice(0, 100);
  } else {
    if (request.method !== "POST")
      throw new ApiError(
        405,
        "METHOD_NOT_ALLOWED",
        "Generic callbacks must use POST.",
      );
    const timestamp = request.headers.get("x-sms-timestamp") || "";
    const signature = createHmac("sha256", c.callbackSecret || "")
      .update(timestamp + "." + raw)
      .digest("hex");
    if (
      !c.callbackSecret ||
      !/^\d+$/.test(timestamp) ||
      Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
      !secureEqual(signature, request.headers.get("x-sms-signature") || "")
    )
      throw new ApiError(
        403,
        "INVALID_SIGNATURE",
        "Callback signature is invalid or expired.",
      );
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new ApiError(400, "INVALID_JSON", "Send a valid callback object.");
    }
    const data = z
      .object({
        messageId: z.string().max(200),
        event: z.enum(["sent", "delivered", "failed", "clicked", "replied"]),
        errorCode: z
          .string()
          .max(100)
          .regex(/^[\w-]*$/)
          .optional(),
      })
      .parse(parsed);
    providerMessageId = data.messageId;
    event = data.event;
    errorCode = data.errorCode || "";
  }
  if (!event) return { ignored: true };
  const correlationId = new URL(request.url).searchParams.get("messageId");
  const message = messages(projectId).find(
    (m) =>
      m.mode === "live" &&
      m.providerId === id &&
      (incomingFrom
        ? m.to === incomingFrom &&
          (provider.provider === "Nexmo"
            ? provider.sms?.senderId.replace(/^\+/, "") ===
              incomingTo.replace(/^\+/, "")
            : provider.sms?.serviceSid ||
              provider.sms?.fromNumber === incomingTo)
        : m.id === correlationId ||
          m.providerMessageId === providerMessageId ||
          m.id === providerMessageId),
  );
  if (!message)
    throw new ApiError(
      404,
      "MESSAGE_NOT_FOUND",
      "Live SMS message not found for this provider.",
    );
  const next = applySmsReceipt(message, event, "provider");
  if (!next.providerMessageId && providerMessageId)
    next.providerMessageId = providerMessageId;
  if (event === "failed" && next.status === "Failed" && errorCode)
    next.errorCode = errorCode;
  writeMessage(next);
  return { received: true, incoming: !!incomingFrom };
}
export async function handleSmsApi(
  request: Request,
  path: string[],
  projectId: string,
): Promise<Response> {
  const [section, id, action] = path,
    method = request.method,
    params = new URL(request.url).searchParams;
  if (
    ["messages", "stats"].includes(section) &&
    params.get("mode") === "live" &&
    params.get("search")
  )
    requireLiveAccess(request);
  const json = (data: unknown, status = 200) =>
    Response.json(
      { data },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (path.length > 3)
    throw new ApiError(404, "NOT_FOUND", "SMS endpoint not found.");
  if (
    section === "callbacks" &&
    id &&
    ["POST", "GET"].includes(method) &&
    path.length === 2
  ) {
    const result = await receiveCallback(request, projectId, id);
    return "incoming" in result && result.incoming
      ? new Response("<Response></Response>", {
          headers: { "Content-Type": "text/xml", "Cache-Control": "no-store" },
        })
      : json(result);
  }
  if (!section && method === "GET")
    return json({
      providers: smsProviders(projectId),
      groups: smsGroups(projectId),
      credentials: Object.keys(credentialProfiles()),
      liveEnabled: isLiveEnabled(),
    });
  if (section === "providers") {
    if (method === "GET" && !action)
      return json(id ? providerById(projectId, id) : smsProviders(projectId));
    if (id && action === "impact" && method === "GET") {
      providerById(projectId, id);
      return json({ affected: affectedEngagements(projectId, id) });
    }
    if (!id && method === "POST")
      return json(saveSmsProvider(projectId, await readJson(request)), 201);
    if (id && !action && method === "PATCH")
      return json(saveSmsProvider(projectId, await readJson(request), id));
    if (id && action === "validate" && method === "POST") {
      const item = providerById(projectId, id);
      if (item.status === "Archived")
        throw new ApiError(
          409,
          "PROVIDER_ARCHIVED",
          "Archived providers cannot be restored.",
        );
      validateSmsSettings(item);
      item.status = "Connected";
      item.checkedAt = item.updatedAt = new Date().toISOString();
      writeEntity("channels", item);
      return json({
        provider: item,
        message:
          "Configuration validated for demo delivery. Use Send test SMS to check a live integration.",
      });
    }
    if (id && action === "default" && method === "POST") {
      const item = providerById(projectId, id);
      validateSmsTarget(projectId, id);
      clearDefaults(projectId);
      item.sms!.isDefault = true;
      writeEntity("channels", item);
      return json(item);
    }
    if (id && action === "archive" && method === "POST")
      return json(
        archiveSmsProvider(
          projectId,
          id,
          (await readJson(request)).confirm === true,
        ),
      );
    if (id && !action && method === "DELETE") {
      const item = providerById(projectId, id),
        affected = affectedEngagements(projectId, id);
      if (
        affected.campaigns.length ||
        affected.journeys.length ||
        allEntities<Campaign>("campaigns", projectId).some(
          (c) => c.smsTarget === id,
        ) ||
        allEntities<Journey>("journeys", projectId).some((j) =>
          j.nodes.some((n) => n.data.smsTarget === id),
        ) ||
        smsGroups(projectId).some((g) => g.providerIds.includes(id))
      )
        throw new ApiError(
          409,
          "RESOURCE_IN_USE",
          "Remove group and engagement references before deleting this provider.",
        );
      getDb()
        .prepare("DELETE FROM channels WHERE id=? AND project_id=?")
        .run(item.id, projectId);
      for (const message of messages(projectId).filter(
        (m) =>
          m.providerId === id || m.attempts.some((a) => a.providerId === id),
      ))
        getDb()
          .prepare("DELETE FROM sms_messages WHERE id=? AND project_id=?")
          .run(message.id, projectId);
      return json({ deleted: true });
    }
  }
  if (section === "groups") {
    if (method === "GET" && !action) {
      const list = smsGroups(projectId);
      const item = id ? list.find((g) => g.id === id) : list;
      if (!item)
        throw new ApiError(404, "NOT_FOUND", "Provider group not found.");
      return json(item);
    }
    if (!id && method === "POST")
      return json(saveGroup(projectId, await readJson(request)), 201);
    if (id && !action && method === "PATCH")
      return json(saveGroup(projectId, await readJson(request), id));
    if (id && action === "default" && method === "POST") {
      const group = smsGroups(projectId).find((g) => g.id === id);
      if (!group)
        throw new ApiError(404, "NOT_FOUND", "Provider group not found.");
      validateSmsTarget(projectId, "group:" + id);
      clearDefaults(projectId);
      group.isDefault = true;
      writeGroup(group);
      return json(group);
    }
    if (id && !action && method === "DELETE") {
      if (!smsGroups(projectId).some((g) => g.id === id))
        throw new ApiError(404, "NOT_FOUND", "Provider group not found.");
      if (
        allEntities<Campaign>("campaigns", projectId).some(
          (c) => c.smsTarget === "group:" + id,
        ) ||
        allEntities<Journey>("journeys", projectId).some((j) =>
          j.nodes.some((n) => n.data.smsTarget === "group:" + id),
        )
      )
        throw new ApiError(
          409,
          "RESOURCE_IN_USE",
          "Remove engagement references before deleting this group.",
        );
      getDb()
        .prepare("DELETE FROM sms_groups WHERE id=? AND project_id=?")
        .run(id, projectId);
      return json({ deleted: true });
    }
  }
  if (section === "test" && method === "POST" && !id)
    return json(
      await sendTest(request, projectId, await readJson(request)),
      201,
    );
  if (section === "messages" && method === "GET" && !id) {
    const items = selectedMessages(projectId, params),
      pageSize = Math.min(
        100,
        Math.max(1, Number(params.get("pageSize") || 10)),
      ),
      pages = Math.max(1, Math.ceil(items.length / pageSize)),
      page = Math.min(pages, Math.max(1, Number(params.get("page") || 1)));
    if (!Number.isInteger(pageSize) || !Number.isInteger(page))
      throw new ApiError(
        400,
        "INVALID_PAGINATION",
        "Use integer pagination values.",
      );
    const authorized =
      isLiveEnabled() &&
      secureEqual(
        request.headers.get("authorization") || "",
        "Bearer " + process.env.SMS_ADMIN_TOKEN,
      );
    return Response.json(
      {
        data: items.slice((page - 1) * pageSize, page * pageSize).map((m) =>
          m.mode === "live" && !authorized
            ? {
                ...m,
                to: "••••" + m.to.slice(-4),
                body: "Live message content is visible only to the deployment owner.",
              }
            : m,
        ),
        meta: { page, pageSize, pages, total: items.length },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  if (
    section === "messages" &&
    id &&
    action === "receipt" &&
    method === "POST"
  ) {
    const message = messages(projectId).find((m) => m.id === id);
    if (!message)
      throw new ApiError(404, "NOT_FOUND", "SMS message not found.");
    if (message.mode !== "demo")
      throw new ApiError(
        409,
        "LIVE_RECEIPT_REQUIRED",
        "Live messages can only be updated by authenticated provider callbacks.",
      );
    if (!message.providerMessageId)
      throw new ApiError(
        409,
        "NOT_ACCEPTED",
        "This message was not accepted by a provider.",
      );
    const input = z
      .object({
        event: z.enum(["sent", "delivered", "failed", "clicked", "replied"]),
      })
      .parse(await readJson(request));
    const next = applySmsReceipt(message, input.event, "demo");
    writeMessage(next);
    return json(next);
  }
  if (section === "stats" && method === "GET" && !id)
    return json(
      stats(selectedMessages(projectId, params), params.get("providerId")),
    );
  throw new ApiError(404, "NOT_FOUND", "SMS endpoint not found.");
}
