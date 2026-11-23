import { computeFunnel } from "@/lib/domain";
import type {
  Campaign,
  Channel,
  Journey,
  Project,
  Resource,
} from "@/lib/types";
import { RESOURCES } from "@/lib/types";
import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { usesCloudStorage } from "./database-context";
import { handleSmsApi, normalizeSmsProvider } from "./sms";
import {
  allEntities,
  getDb,
  getEvents,
  getPeople,
  resetProject,
} from "./database";
import {
  analytics,
  ApiError,
  changeStatus,
  dataset,
  dateRange,
  evaluate,
  hydrateSegments,
  listRuns,
  parseQuery,
  publish,
  remove,
  requireEntity,
  requireProject,
  save,
  simulate,
  testChannel,
} from "./services";

function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
function pagination<T>(items: T[], params: URLSearchParams) {
  const number = (key: string, fallback: number) => {
    const value = Number(params.get(key) || fallback);
    if (!Number.isInteger(value) || value < 1)
      throw new ApiError(
        400,
        "INVALID_PAGINATION",
        key + " must be a positive integer.",
      );
    return value;
  };
  const pageSize = Math.min(100, number("pageSize", 10)),
    total = items.length,
    pages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(number("page", 1), pages);
  return {
    data: items.slice((page - 1) * pageSize, page * pageSize),
    meta: { total, page, pageSize, pages },
  };
}
function filterItems<T extends { name: string }>(
  items: T[],
  params: URLSearchParams,
): T[] {
  const search = (params.get("search") || "").toLowerCase(),
    status = params.get("status"),
    channel = params.get("channel");
  const sort = params.get("sort") || "updatedAt",
    direction = params.get("direction") === "asc" ? 1 : -1;
  const allowedSort = [
    "name",
    "updatedAt",
    "createdAt",
    "status",
    "channel",
    "userCount",
    "value",
    "lastSeen",
    "email",
  ];
  if (!allowedSort.includes(sort))
    throw new ApiError(400, "INVALID_SORT", "Unsupported sort column.");
  return items
    .filter((item) => {
      const record = item as Record<string, unknown>;
      return (
        (!search ||
          (
            item.name +
            " " +
            (record.email || "") +
            " " +
            (record.description || "")
          )
            .toLowerCase()
            .includes(search)) &&
        (!status || status === "All" || record.status === status) &&
        (!channel || channel === "All" || record.channel === channel)
      );
    })
    .sort((a, b) => {
      const first = (a as Record<string, unknown>)[sort] ?? "",
        second = (b as Record<string, unknown>)[sort] ?? "";
      return (
        (typeof first === "number" && typeof second === "number"
          ? first - second
          : String(first).localeCompare(String(second))) * direction
      );
    });
}
async function body(request: Request): Promise<Record<string, unknown>> {
  if (!(request.headers.get("content-type") || "").includes("application/json"))
    throw new ApiError(415, "JSON_REQUIRED", "Send a JSON request body.");
  const length = Number(request.headers.get("content-length") || 0);
  if (length > 1000000)
    throw new ApiError(413, "BODY_TOO_LARGE", "The request body is too large.");
  try {
    const value = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Enter a valid JSON object.");
  }
}
function csv(items: Record<string, unknown>[], filename: string) {
  const columns = [...new Set(items.flatMap(Object.keys))].filter(
    (key) =>
      ![
        "content",
        "variantB",
        "config",
        "query",
        "nodes",
        "edges",
        "tiles",
        "reachability",
      ].includes(key),
  );
  const cell = (value: unknown) => {
    let text =
      typeof value === "object" ? JSON.stringify(value) : String(value ?? "");
    if (/^[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  return new Response(
    "\uFEFF" +
      [
        columns.map(cell).join(","),
        ...items.map((item) => columns.map((key) => cell(item[key])).join(",")),
      ].join("\r\n"),
    {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="' + filename + '.csv"',
        "Cache-Control": "no-store",
      },
    },
  );
}
export async function handleApi(
  request: Request,
  path: string[],
): Promise<Response> {
  const requestId = randomUUID();
  try {
    const url = new URL(request.url),
      params = url.searchParams,
      method = request.method;
    const smsCallback = path[0] === "sms" && path[1] === "callbacks";
    if (method !== "GET" && !smsCallback) {
      const origin = request.headers.get("origin");
      const publicHost = request.headers.get("host") || url.host;
      let sameOrigin = !origin;
      try {
        if (origin)
          sameOrigin =
            new URL(origin).host === publicHost &&
            new URL(origin).protocol === url.protocol;
      } catch {}
      if (!sameOrigin)
        throw new ApiError(
          403,
          "INVALID_ORIGIN",
          "Cross-origin writes are not allowed.",
        );
    }
    const [resource, id, action] = path;
    if (resource === "health" && method === "GET") {
      const counts = Object.fromEntries(
        ["projects", "people", "events", ...RESOURCES, "runs"].map((table) => [
          table,
          getDb()
            .prepare("SELECT COUNT(*) AS count FROM " + table)
            .get()!.count,
        ]),
      );
      return json({
        data: {
          status: "ok",
          storage: usesCloudStorage() ? "netlify-postgres" : "sqlite",
          counts,
        },
      });
    }
    if (resource === "projects") {
      if (method === "POST" && id && action === "reset") {
        requireProject(id);
        const input = await body(request);
        if (input.confirm !== id)
          throw new ApiError(
            422,
            "CONFIRMATION_REQUIRED",
            "Type the project ID to reset its demo data.",
          );
        resetProject(id);
        return json({ data: requireProject(id) });
      }
      if (method === "GET") {
        const items = getDb()
          .prepare("SELECT data FROM projects ORDER BY id")
          .all()
          .map((row) => JSON.parse(String(row.data)) as Project);
        return json({ data: id ? requireProject(id) : items });
      }
      if (method === "PATCH" && id) {
        const project = requireProject(id),
          input = await body(request);
        if (
          "name" in input &&
          (typeof input.name !== "string" ||
            input.name.trim().length < 2 ||
            input.name.trim().length > 120)
        )
          throw new ApiError(
            422,
            "INVALID_NAME",
            "Project name must contain 2–120 characters.",
          );
        if (typeof input.name === "string" && input.name.trim().length >= 2)
          project.name = input.name.trim().slice(0, 120);
        if (typeof input.timezone === "string") {
          try {
            new Intl.DateTimeFormat("en", {
              timeZone: input.timezone,
            }).format();
          } catch {
            throw new ApiError(
              400,
              "INVALID_TIMEZONE",
              "Choose a valid timezone.",
            );
          }
          project.timezone = input.timezone;
        }
        if (typeof input.website === "string") {
          if (!/^https?:\/\//.test(input.website))
            throw new ApiError(
              400,
              "INVALID_WEBSITE",
              "Use an http or https website URL.",
            );
          project.website = input.website;
        }
        getDb()
          .prepare("UPDATE projects SET data=? WHERE id=?")
          .run(JSON.stringify(project), id);
        return json({ data: project });
      }
    }
    const projectId = params.get("projectId") || "shopwise",
      project = requireProject(projectId);
    if (resource === "sms")
      return await handleSmsApi(request, path.slice(1), projectId);
    if (resource === "analytics" && method === "GET")
      return json({
        data: analytics(
          projectId,
          params.get("from") || undefined,
          params.get("to") || undefined,
          params.get("segmentId") || undefined,
        ),
      });
    if (resource === "analytics" && id === "query" && method === "POST") {
      const input = await body(request),
        range = dateRange(
          project,
          String(input.from || "2026-10-21"),
          String(input.to || "2026-11-19"),
        ),
        data = dataset(projectId);
      const segmentIds = input.segmentId
        ? new Set(
            evaluate(
              projectId,
              requireEntity<import("@/lib/types").Segment>(
                "segments",
                String(input.segmentId),
                projectId,
              ).query,
              data,
            ).ids,
          )
        : null;
      const people = segmentIds
        ? data.people.filter((p) => segmentIds.has(p.id))
        : data.people;
      if (input.type === "funnel") {
        const steps = input.steps;
        if (
          !Array.isArray(steps) ||
          steps.length < 2 ||
          steps.length > 8 ||
          !steps.every((s) => typeof s === "string")
        )
          throw new ApiError(400, "INVALID_STEPS", "Choose 2–8 funnel events.");
        const windowDays = Number(input.windowDays || 7);
        if (!Number.isFinite(windowDays) || windowDays < 1 || windowDays > 365)
          throw new ApiError(
            400,
            "INVALID_WINDOW",
            "Conversion window must be 1–365 days.",
          );
        return json({
          data: computeFunnel(
            people,
            data.events,
            steps,
            windowDays,
            range.start,
            range.end,
          ),
          range,
        });
      }
      const selectedEvents = Array.isArray(input.events)
        ? input.events.map(String).slice(0, 5)
        : ["App Launched"];
      const filteredEvents = data.events.filter(
        (e) =>
          e.timestamp >= range.start &&
          e.timestamp < range.end &&
          selectedEvents.includes(e.name) &&
          (!segmentIds || segmentIds.has(e.personId)),
      );
      const days = new Map<string, Record<string, number | string>>(),
        formatter = new Intl.DateTimeFormat("en-CA", {
          timeZone: project.timezone,
        });
      const unique = new Map<string, Set<string>>();
      for (
        let time = Date.parse(range.from + "T12:00:00Z");
        time <= Date.parse(range.to + "T12:00:00Z");
        time += 86400000
      ) {
        const date = new Date(time).toISOString().slice(0, 10);
        days.set(date, {
          date,
          ...Object.fromEntries(selectedEvents.map((e) => [e, 0])),
        });
      }
      for (const event of filteredEvents) {
        const day = formatter.format(new Date(event.timestamp)),
          row = days.get(day);
        if (!row) continue;
        if (input.metric === "users") {
          const key = day + event.name,
            ids = unique.get(key) || new Set<string>();
          ids.add(event.personId);
          unique.set(key, ids);
          row[event.name] = ids.size;
        } else
          row[event.name] =
            Number(row[event.name]) +
            (input.metric === "revenue"
              ? Number(event.properties.amount || 0)
              : 1);
      }
      return json({
        data: [...days.values()],
        events: selectedEvents,
        total: filteredEvents.length,
      });
    }
    if (resource === "schema" && method === "GET") {
      const data = dataset(projectId);
      const events = [...new Set(data.events.map((e) => e.name))].map(
        (name) => {
          const matching = data.events.filter((e) => e.name === name);
          return {
            id: name,
            name,
            type: name.startsWith("Message") ? "System event" : "Custom event",
            status: "Active",
            count: matching.length,
            properties: [
              ...new Set(matching.flatMap((e) => Object.keys(e.properties))),
            ],
            lastSeen: matching.at(-1)?.timestamp,
          };
        },
      );
      const properties = [
        { name: "name", type: "String" },
        { name: "email", type: "String" },
        { name: "country", type: "String" },
        { name: "city", type: "String" },
        { name: "platform", type: "String" },
        { name: "plan", type: "String" },
        { name: "value", type: "Number" },
      ];
      return json({ data: { events, properties } });
    }
    if (resource === "people" && method === "GET") {
      if (id) {
        const person = getPeople(projectId).find((p) => p.id === id);
        if (!person)
          throw new ApiError(
            404,
            "NOT_FOUND",
            "User not found in this project.",
          );
        return json({
          data: action === "events" ? getEvents(projectId, id) : person,
        });
      }
      let items = getPeople(projectId);
      if (params.get("ids")) {
        const ids = new Set(params.get("ids")!.split(",").slice(0, 100));
        items = items.filter((p) => ids.has(p.id));
      }
      if (params.get("segmentId")) {
        const segment = requireEntity<import("@/lib/types").Segment>(
          "segments",
          params.get("segmentId")!,
          projectId,
        );
        const ids = new Set(evaluate(projectId, segment.query).ids);
        items = items.filter((p) => ids.has(p.id));
      }
      const platform = params.get("platform");
      if (platform && platform !== "All")
        items = items.filter((p) => p.platform === platform);
      return json(pagination(filterItems(items, params), params));
    }
    if (resource === "exports" && method === "GET") {
      if (id === "people")
        return csv(
          filterItems(getPeople(projectId), params) as unknown as Record<
            string,
            unknown
          >[],
          "people",
        );
      if (RESOURCES.includes(id as Resource)) {
        let items = allEntities(id as Resource, projectId);
        if (id === "segments")
          items = hydrateSegments(
            items as import("@/lib/types").Segment[],
            projectId,
          );
        return csv(
          filterItems(items, params) as unknown as Record<string, unknown>[],
          id,
        );
      }
      throw new ApiError(404, "NOT_FOUND", "Export not found.");
    }
    if (resource === "segments" && id === "evaluate" && method === "POST") {
      const input = await body(request);
      return json({
        data: evaluate(projectId, parseQuery(input.query || input)),
      });
    }
    if (RESOURCES.includes(resource as Resource)) {
      const table = resource as Resource;
      if (id === "summary" && method === "GET") {
        const items = allEntities(table, projectId);
        return json({
          data: {
            total: items.length,
            statuses: Object.fromEntries(
              [...new Set(items.map((i) => i.status))].map((status) => [
                status,
                items.filter((i) => i.status === status).length,
              ]),
            ),
            channels: Object.fromEntries(
              [
                ...new Set(
                  items
                    .filter((i) => "channel" in i)
                    .map((i) => (i as Channel).channel),
                ),
              ].map((channel) => [
                channel,
                items.filter((i) => "channel" in i && i.channel === channel)
                  .length,
              ]),
            ),
          },
        });
      }
      if (id && action === "runs" && method === "GET") {
        requireEntity(table, id, projectId);
        return json({ data: listRuns(projectId, id) });
      }
      if (
        id &&
        action === "publish" &&
        method === "POST" &&
        (table === "campaigns" || table === "journeys")
      )
        return json({ data: publish(table, id, projectId) });
      if (
        id &&
        action === "simulate" &&
        method === "POST" &&
        (table === "campaigns" || table === "journeys")
      )
        return json({ data: simulate(table, id, projectId) }, 201);
      if (id && action === "test" && method === "POST" && table === "channels")
        return json({ data: testChannel(id, projectId) });
      if (id && action === "status" && method === "POST") {
        const input = await body(request);
        return json({
          data: changeStatus(table, id, projectId, String(input.status)),
        });
      }
      if (id && action === "duplicate" && method === "POST") {
        const item = requireEntity(table, id, projectId);
        const input = { ...item, name: item.name + " (copy)" };
        if (table === "journeys") input.status = "Draft";
        return json({ data: save(table, projectId, input) }, 201);
      }
      if (action)
        throw new ApiError(404, "NOT_FOUND", "This action is not available.");
      if (method === "GET") {
        if (id) {
          let item = requireEntity(table, id, projectId);
          if (table === "channels" && (item as Channel).channel === "SMS")
            item = normalizeSmsProvider(item as Channel);
          if (table === "segments")
            item = hydrateSegments(
              [item as import("@/lib/types").Segment],
              projectId,
            )[0];
          const references =
            table === "segments"
              ? {
                  campaigns: allEntities<Campaign>(
                    "campaigns",
                    projectId,
                  ).filter((c) => c.segmentId === id),
                  journeys: allEntities<Journey>("journeys", projectId).filter(
                    (j) => j.nodes.some((n) => n.data.segmentId === id),
                  ),
                }
              : undefined;
          return json({ data: item, references });
        }
        let items = allEntities(table, projectId);
        if (table === "channels")
          items = items.map((item) =>
            (item as Channel).channel === "SMS"
              ? normalizeSmsProvider(item as Channel)
              : item,
          );
        if (table === "segments")
          items = hydrateSegments(
            items as import("@/lib/types").Segment[],
            projectId,
          );
        return json(pagination(filterItems(items, params), params));
      }
      if (method === "POST" && !id)
        return json({ data: save(table, projectId, await body(request)) }, 201);
      if (method === "PATCH" && id)
        return json({ data: save(table, projectId, await body(request), id) });
      if (method === "DELETE" && id) {
        remove(table, id, projectId);
        return json({ data: { deleted: true, id } });
      }
    }
    throw new ApiError(404, "NOT_FOUND", "API endpoint not found.");
  } catch (error) {
    if (error instanceof ApiError)
      return json(
        {
          error: {
            code: error.code,
            message: error.message,
            fields: error.fields,
          },
          requestId,
        },
        error.status,
      );
    if (error instanceof ZodError)
      return json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: error.issues[0]?.message || "Invalid request.",
            fields: Object.fromEntries(
              error.issues.map((issue) => [
                issue.path.join("."),
                issue.message,
              ]),
            ),
          },
          requestId,
        },
        422,
      );
    console.error("API " + requestId, error);
    return json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Something went wrong. Please try again.",
        },
        requestId,
      },
      500,
    );
  }
}
