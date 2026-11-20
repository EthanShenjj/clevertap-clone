import type {
  Board,
  Campaign,
  Channel,
  Entity,
  EventRecord,
  Journey,
  MessageContent,
  MessageTemplate,
  Person,
  Project,
  Resource,
  Segment,
} from "@/lib/types";
import { CHANNELS, EMPTY_CONTENT, RESOURCES } from "@/lib/types";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { databaseContext } from "./database-context";

const globalDb = globalThis as unknown as { cleverTapDb?: DatabaseSync };
export const DEMO_DATE = "2026-11-20T00:00:00+08:00";
const seedTime = "2026-11-19T09:30:00.000Z";

export function getDb(): DatabaseSync {
  const requestDb = databaseContext.getStore();
  if (requestDb) return requestDb;
  if (globalDb.cleverTapDb) {
    if (
      !globalDb.cleverTapDb
        .prepare("SELECT version FROM migrations WHERE version=1")
        .get()
    )
      seed(globalDb.cleverTapDb);
    return globalDb.cleverTapDb;
  }
  const file =
    process.env.DATABASE_PATH ||
    path.join(process.cwd(), "data", "clevertap.sqlite");
  globalDb.cleverTapDb = openDatabase(file);
  return globalDb.cleverTapDb;
}

export function openDatabase(file: string): DatabaseSync {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(
    "PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;",
  );
  db.exec(
    "CREATE TABLE IF NOT EXISTS migrations (version INTEGER PRIMARY KEY); CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, data TEXT NOT NULL);",
  );
  for (const table of RESOURCES) {
    db.exec(
      "CREATE TABLE IF NOT EXISTS " +
        table +
        " (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL, status TEXT NOT NULL, channel TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_" +
        table +
        "_project ON " +
        table +
        "(project_id,status);",
    );
  }
  db.exec(
    "CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), name TEXT NOT NULL, email TEXT NOT NULL, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_people_project ON people(project_id); CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), person_id TEXT NOT NULL REFERENCES people(id), name TEXT NOT NULL, timestamp TEXT NOT NULL, run_id TEXT, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_events_query ON events(project_id,name,timestamp); CREATE INDEX IF NOT EXISTS idx_events_person ON events(person_id,timestamp); CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL REFERENCES projects(id), resource_id TEXT NOT NULL, created_at TEXT NOT NULL, data TEXT NOT NULL); CREATE INDEX IF NOT EXISTS idx_runs_resource ON runs(project_id,resource_id);",
  );
  if (!db.prepare("SELECT version FROM migrations WHERE version=1").get())
    seed(db);
  return db;
}
export function readEntity<T extends Entity>(
  table: Resource,
  id: string,
  projectId: string,
): T | undefined {
  const row = getDb()
    .prepare("SELECT data FROM " + table + " WHERE id=? AND project_id=?")
    .get(id, projectId);
  return row ? (JSON.parse(String(row.data)) as T) : undefined;
}
export function allEntities<T extends Entity>(
  table: Resource,
  projectId: string,
): T[] {
  return getDb()
    .prepare(
      "SELECT data FROM " +
        table +
        " WHERE project_id=? ORDER BY updated_at DESC",
    )
    .all(projectId)
    .map((row) => JSON.parse(String(row.data)) as T);
}
export function writeEntity(table: Resource, entity: Entity, db = getDb()) {
  db.prepare(
    "INSERT INTO " +
      table +
      " (id,project_id,name,status,channel,created_at,updated_at,data) VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,status=excluded.status,channel=excluded.channel,updated_at=excluded.updated_at,data=excluded.data",
  ).run(
    entity.id,
    entity.projectId,
    entity.name,
    entity.status,
    "channel" in entity ? entity.channel : "",
    entity.createdAt,
    entity.updatedAt,
    JSON.stringify(entity),
  );
}
export function getProject(id: string): Project | undefined {
  const row = getDb().prepare("SELECT data FROM projects WHERE id=?").get(id);
  return row ? (JSON.parse(String(row.data)) as Project) : undefined;
}
export function getPeople(projectId: string): Person[] {
  return getDb()
    .prepare("SELECT data FROM people WHERE project_id=?")
    .all(projectId)
    .map((row) => JSON.parse(String(row.data)) as Person);
}
export function getEvents(projectId: string, personId?: string): EventRecord[] {
  const rows = personId
    ? getDb()
        .prepare(
          "SELECT data FROM events WHERE project_id=? AND person_id=? ORDER BY timestamp DESC",
        )
        .all(projectId, personId)
    : getDb()
        .prepare(
          "SELECT data FROM events WHERE project_id=? ORDER BY timestamp",
        )
        .all(projectId);
  return rows.map((row) => JSON.parse(String(row.data)) as EventRecord);
}
export function base(
  id: string,
  projectId: string,
  name: string,
  status = "Draft",
) {
  return {
    id,
    projectId,
    name,
    description: "",
    status,
    createdAt: seedTime,
    updatedAt: seedTime,
    tags: [] as string[],
    createdBy: "Alex Morgan",
  };
}
export function defaultContent(channel: string, index = 0): MessageContent {
  return {
    ...EMPTY_CONTENT,
    title:
      index % 2
        ? "A little something, just for you"
        : "Your next favorite is waiting",
    subject: "A little thank you, {{first_name}}",
    preheader:
      "Discover something you'll love. Your exclusive offer is inside.",
    body: "Hi {{first_name}},\nThe things you love are still here. Come back and enjoy 15% off your next order with code HELLO15.",
    cta: "Explore collection",
    background: channel === "In-App" ? "#f4e9e0" : "#eef2ff",
    blocks: [
      { id: "b1", type: "text", value: "Thoughtfully picked. Just for you." },
      {
        id: "b2",
        type: "text",
        value:
          "Discover our latest collection and find your everyday favorites.",
      },
      { id: "b3", type: "button", value: "Explore collection" },
    ],
  };
}
export function resetProject(projectId: string) {
  if (!["shopwise", "streamly"].includes(projectId))
    throw new Error("Unknown demo project.");
  seed(getDb(), projectId);
}
function seed(db: DatabaseSync, onlyProject?: string) {
  db.exec("BEGIN");
  try {
    const projects: Project[] = [
      {
        id: "shopwise",
        name: "Shopwise",
        timezone: "Asia/Shanghai",
        website: "https://shopwise.example.com",
        currency: "USD",
        demoDate: DEMO_DATE,
      },
      {
        id: "streamly",
        name: "Streamly",
        timezone: "Asia/Shanghai",
        website: "https://streamly.example.com",
        currency: "USD",
        demoDate: DEMO_DATE,
      },
    ];
    const names = [
      "Alex Morgan",
      "Priya Sharma",
      "James Wilson",
      "Emma Chen",
      "Arjun Patel",
      "Sarah Johnson",
      "Daniel Kim",
      "Sofia Garcia",
      "Oliver Brown",
      "Ananya Singh",
      "Noah Williams",
      "Mia Thompson",
      "Ethan Davis",
      "Ava Martinez",
      "Liam Anderson",
      "Isabella Lee",
    ];
    const insertPerson = db.prepare("INSERT INTO people VALUES (?,?,?,?,?)");
    const insertEvent = db.prepare("INSERT INTO events VALUES (?,?,?,?,?,?,?)");
    if (onlyProject) {
      for (const table of ["runs", "events", "people", ...RESOURCES])
        db.prepare("DELETE FROM " + table + " WHERE project_id=?").run(
          onlyProject,
        );
      db.prepare("DELETE FROM projects WHERE id=?").run(onlyProject);
    }
    for (const project of projects.filter(
      (project) => !onlyProject || project.id === onlyProject,
    )) {
      db.prepare("INSERT INTO projects VALUES (?,?)").run(
        project.id,
        JSON.stringify(project),
      );
      const count = project.id === "shopwise" ? 1000 : 160;
      for (let i = 1; i <= count; i++) {
        const id = project.id + "-user-" + String(i).padStart(4, "0");
        const cityIndex = i % 7;
        const countries = [
          "India",
          "India",
          "India",
          "United States",
          "United Kingdom",
          "Singapore",
          "Germany",
        ];
        const cities = [
          "Mumbai",
          "Bengaluru",
          "Delhi",
          "New York",
          "London",
          "Singapore",
          "Berlin",
        ];
        const lastDay = i % 11 === 0 ? 35 : i % 5;
        const person: Person = {
          id,
          projectId: project.id,
          name: names[(i - 1) % names.length],
          email:
            names[(i - 1) % names.length].toLowerCase().replace(" ", ".") +
            i +
            "@example.com",
          phone: "+1 202 555 " + String(i).padStart(4, "0"),
          country: countries[cityIndex],
          city: cities[cityIndex],
          platform: ["Android", "iOS", "Android", "Web", "iOS"][i % 5],
          plan: i % 4 === 0 ? "Premium" : "Free",
          value: i % 6 === 0 ? 0 : Math.round(((i * 7.31) % 1500) * 100) / 100,
          createdAt: new Date(
            Date.parse(seedTime) - (40 + (i % 300)) * 86400000,
          ).toISOString(),
          lastSeen: new Date(
            Date.parse(seedTime) - lastDay * 86400000,
          ).toISOString(),
          reachability: {
            Email: i % 10 !== 0,
            Push: i % 4 !== 0,
            "In-App": true,
            "Web Pop-up": true,
            SMS: i % 3 !== 0,
            WhatsApp: i % 5 !== 0,
            "Web Push": i % 5 === 0,
            RCS: i % 7 === 0,
          },
        };
        insertPerson.run(
          id,
          project.id,
          person.name,
          person.email,
          JSON.stringify(person),
        );
        let eventIndex = 0;
        const add = (
          name: string,
          time: number,
          properties: Record<string, string | number> = {},
        ) => {
          const event: EventRecord = {
            id: id + "-e" + eventIndex++,
            projectId: project.id,
            personId: id,
            name,
            timestamp: new Date(time).toISOString(),
            properties: {
              platform: person.platform,
              country: person.country,
              ...properties,
            },
          };
          insertEvent.run(
            event.id,
            project.id,
            id,
            name,
            event.timestamp,
            null,
            JSON.stringify(event),
          );
        };
        add("Signed Up", Date.parse(person.createdAt));
        for (let dayIndex = 0; dayIndex < 12; dayIndex++) {
          const day = (i * 7 + dayIndex * 13) % 60;
          if (i % 11 === 0 && day < 30) continue;
          const time =
            Date.parse(seedTime) - day * 86400000 - (i % 20) * 120000;
          add("App Launched", time);
          add("Product Viewed", time + 10000, {
            category: ["Fashion", "Home", "Electronics"][i % 3],
          });
          if ((i + dayIndex) % 3 !== 0) add("Added to Cart", time + 40000);
          if ((i + dayIndex) % 5 === 0)
            add("Charged", time + 120000, {
              amount: 29 + (i % 12) * 15,
              currency: "USD",
            });
        }
      }
      const segmentDefinitions = [
        ["All users", "Everyone in your customer base", []],
        [
          "Cart abandoners",
          "Added to cart, but haven't completed a purchase",
          [
            {
              kind: "event",
              field: "Added to Cart",
              operator: "did",
              value: "1",
              days: 7,
            },
            {
              kind: "event",
              field: "Charged",
              operator: "did_not",
              value: "1",
              days: 7,
            },
          ],
        ],
        [
          "Premium customers",
          "Your most valuable members",
          [
            {
              kind: "property",
              field: "plan",
              operator: "equals",
              value: "Premium",
              days: 30,
            },
          ],
        ],
        [
          "Android users",
          "Customers on Android devices",
          [
            {
              kind: "property",
              field: "platform",
              operator: "equals",
              value: "Android",
              days: 30,
            },
          ],
        ],
        [
          "Customers in India",
          "Reach your audience in India",
          [
            {
              kind: "property",
              field: "country",
              operator: "equals",
              value: "India",
              days: 30,
            },
          ],
        ],
        [
          "High-value customers",
          "Lifetime value greater than $500",
          [
            {
              kind: "property",
              field: "value",
              operator: "greater_than",
              value: "500",
              days: 30,
            },
          ],
        ],
        [
          "Dormant users",
          "No app activity in the last 30 days",
          [
            {
              kind: "event",
              field: "App Launched",
              operator: "did_not",
              value: "1",
              days: 30,
            },
          ],
        ],
        [
          "Recent buyers",
          "Purchased in the last 7 days",
          [
            {
              kind: "event",
              field: "Charged",
              operator: "did",
              value: "1",
              days: 7,
            },
          ],
        ],
        [
          "iOS audience",
          "Customers on Apple devices",
          [
            {
              kind: "property",
              field: "platform",
              operator: "equals",
              value: "iOS",
              days: 30,
            },
          ],
        ],
        [
          "Free plan users",
          "Discover your next upgrade opportunity",
          [
            {
              kind: "property",
              field: "plan",
              operator: "equals",
              value: "Free",
              days: 30,
            },
          ],
        ],
      ] as const;
      segmentDefinitions.forEach((definition, i) => {
        const segment: Segment = {
          ...base(
            project.id + "-seg-" + i,
            project.id,
            definition[0],
            "Active",
          ),
          description: definition[1],
          type: "Past behavior",
          query: {
            combinator: "and",
            rules: definition[2].map((r, index) => ({ ...r, id: "r" + index })),
          },
          userCount: 0,
          tags: i === 1 ? ["Retention", "E-commerce"] : ["Audience"],
        };
        writeEntity("segments", segment, db);
      });
      const templateNames = [
        "Welcome to the club",
        "A little nudge",
        "Your exclusive offer",
        "New arrivals",
        "We miss you",
        "Order update",
        "Weekend favorites",
        "The perfect comeback",
      ];
      templateNames.forEach((name, i) => {
        const channel = CHANNELS[i % 4];
        const template: MessageTemplate = {
          ...base(project.id + "-tpl-" + i, project.id, name, "Active"),
          channel,
          content: defaultContent(channel, i),
          category: [
            "Welcome",
            "Promotional",
            "Transactional",
            "Re-engagement",
          ][i % 4],
          description: "A ready-to-personalize message for every moment.",
          tags: [i % 2 ? "Promotional" : "Lifecycle"],
        };
        writeEntity("templates", template, db);
      });
      CHANNELS.forEach((channel, i) => {
        const connected = i < 4;
        const providers = [
          "Firebase Cloud Messaging",
          "Amazon SES",
          "CleverTap SDK",
          "Web SDK",
          "Twilio",
          "Meta Business",
          "Web Push",
          "Google RCS",
        ];
        const item: Channel = {
          ...base(
            project.id + "-ch-" + i,
            project.id,
            channel,
            connected ? "Connected" : "Not connected",
          ),
          channel,
          provider: providers[i],
          config: {
            sender:
              channel === "Email" ? "hello@shopwise.example.com" : "Shopwise",
            domain: "shopwise.example.com",
            appId: "app_" + project.id,
          },
          description:
            "Configure your " +
            channel.toLowerCase() +
            " delivery preferences.",
        };
        writeEntity("channels", item, db);
      });
      const campaignNames = [
        "Weekend edit · November",
        "Your cart is waiting",
        "Welcome to Shopwise",
        "Black Friday early access",
        "Back for something good",
        "New season, new favorites",
        "A thank you for our members",
        "Your first order starts here",
        "Fresh finds for your home",
        "November newsletter",
        "Your next chapter",
        "Last chance to explore",
      ];
      campaignNames.forEach((name, i) => {
        const channel = CHANNELS[i % 4],
          status = [
            "Running",
            "Completed",
            "Scheduled",
            "Draft",
            "Paused",
            "Running",
          ][i % 6];
        const sent =
          status === "Draft" || status === "Scheduled" ? 0 : 124 + i * 31;
        const item: Campaign = {
          ...base(project.id + "-cmp-" + i, project.id, name, status),
          channel,
          segmentId: project.id + "-seg-" + (i % 7),
          templateId: project.id + "-tpl-" + (i % 8),
          content: defaultContent(channel, i),
          variantB: {
            ...defaultContent(channel, i),
            title: "Something good is waiting for you",
          },
          abEnabled: i % 3 === 0,
          split: 50,
          schedule: "",
          goal: "Charged",
          stats: {
            sent,
            delivered: Math.floor(sent * 0.96),
            viewed: Math.floor(sent * 0.42),
            clicked: Math.floor(sent * 0.12),
            converted: Math.floor(sent * 0.042),
            revenue: Math.floor(sent * 0.042) * 59,
          },
          runs: 0,
          tags: [i % 2 ? "Retention" : "Promotional"],
        };
        item.createdAt = new Date(
          Date.parse(seedTime) - i * 86400000,
        ).toISOString();
        item.updatedAt = item.createdAt;
        writeEntity("campaigns", item, db);
      });
      for (let i = 0; i < 4; i++) {
        const journey: Journey = {
          ...base(
            project.id + "-jrn-" + i,
            project.id,
            [
              "New customer welcome",
              "Recover abandoned carts",
              "Bring customers back",
              "Premium member moments",
            ][i],
            i === 3 ? "Draft" : "Running",
          ),
          goal: "Charged",
          version: 1,
          timeoutHours: 168,
          stats: {
            entered: 245 + i * 37,
            converted: 32 + i * 9,
            completed: 180 + i * 25,
          },
          nodes: [
            {
              id: "entry",
              type: "journey",
              position: { x: 250, y: 50 },
              data: {
                label: "Enter audience",
                kind: "entry",
                segmentId: project.id + "-seg-" + (i === 1 ? 1 : 0),
                event: "Signed Up",
              },
            },
            {
              id: "push",
              type: "journey",
              position: { x: 250, y: 210 },
              data: {
                label: "A warm welcome",
                kind: "message",
                channel: "Push",
                content: defaultContent("Push"),
              },
            },
            {
              id: "wait",
              type: "journey",
              position: { x: 250, y: 370 },
              data: { label: "Give it a day", kind: "delay", hours: 24 },
            },
            {
              id: "condition",
              type: "journey",
              position: { x: 250, y: 530 },
              data: {
                label: "Completed a purchase?",
                kind: "condition",
                event: "Charged",
              },
            },
            {
              id: "email",
              type: "journey",
              position: { x: 470, y: 710 },
              data: {
                label: "A little inspiration",
                kind: "message",
                channel: "Email",
                content: defaultContent("Email"),
              },
            },
            {
              id: "exit",
              type: "journey",
              position: { x: 30, y: 900 },
              data: { label: "Journey complete", kind: "exit" },
            },
          ],
          edges: [
            { id: "e1", source: "entry", target: "push", label: "Yes" },
            { id: "e2", source: "push", target: "wait", label: "Sent" },
            {
              id: "e3",
              source: "wait",
              target: "condition",
              label: "After 24h",
            },
            { id: "e4", source: "condition", target: "exit", label: "Yes" },
            { id: "e5", source: "condition", target: "email", label: "No" },
            { id: "e6", source: "email", target: "exit", label: "Sent" },
          ],
        };
        writeEntity("journeys", journey, db);
      }
      [
        "Business overview",
        "Customer engagement",
        "Purchase performance",
      ].forEach((name, i) => {
        const board: Board = {
          ...base(project.id + "-board-" + i, project.id, name, "Active"),
          description: [
            "Your business, at a glance.",
            "Every interaction tells a story.",
            "From first look to checkout.",
          ][i],
          tiles: [
            {
              id: "tile1",
              title: "Active users",
              event: "App Launched",
              metric: "users",
              size: "wide",
            },
            {
              id: "tile2",
              title: "Purchases",
              event: "Charged",
              metric: "events",
              size: "normal",
            },
            {
              id: "tile3",
              title: "Product discovery",
              event: "Product Viewed",
              metric: "users",
              size: "normal",
            },
          ],
        };
        writeEntity("boards", board, db);
      });
    }
    db.prepare("INSERT OR IGNORE INTO migrations(version) VALUES (1)").run();
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
