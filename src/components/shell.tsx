"use client";
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  Command,
  Database,
  Filter,
  HelpCircle,
  Layers,
  LayoutDashboard,
  Megaphone,
  Menu,
  PanelLeftClose,
  PanelsTopLeft,
  Search,
  Settings,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button, Field, IconButton, Modal } from "./ui";
import { useWorkspace } from "./workspace-provider";

const navigation = [
  {
    group: "WORKSPACE",
    items: [
      { label: "Overview", href: "/overview", icon: LayoutDashboard },
      { label: "Boards", href: "/boards", icon: PanelsTopLeft },
    ],
  },
  {
    group: "ANALYZE",
    items: [
      { label: "Trends", href: "/analytics/trends", icon: BarChart3 },
      { label: "Funnels", href: "/analytics/funnels", icon: Filter },
    ],
  },
  {
    group: "UNDERSTAND",
    items: [
      { label: "Segments", href: "/segments", icon: Layers },
      { label: "Find people", href: "/people", icon: Users },
    ],
  },
  {
    group: "ENGAGE",
    items: [
      { label: "Campaigns", href: "/campaigns", icon: Megaphone },
      { label: "Journeys", href: "/journeys", icon: Workflow },
      { label: "Templates", href: "/templates", icon: PanelsTopLeft },
    ],
  },
  {
    group: "MANAGE",
    items: [
      { label: "Data management", href: "/data/schema", icon: Database },
      { label: "Channels", href: "/settings/channels", icon: Bell },
      { label: "Settings", href: "/settings/project", icon: Settings },
    ],
  },
];
export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname(),
    workspace = useWorkspace(),
    router = useRouter();
  const [collapsed, setCollapsed] = useState(false),
    [searchOpen, setSearchOpen] = useState(false),
    [search, setSearch] = useState("");
  const [dateOpen, setDateOpen] = useState(false),
    [from, setFrom] = useState(workspace.from),
    [to, setTo] = useState(workspace.to);
  const [notifications, setNotifications] = useState(false),
    [help, setHelp] = useState(false);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  const active = navigation
    .flatMap((group) => group.items)
    .find((item) => pathname.startsWith(item.href));
  return (
    <div className={"app-shell " + (collapsed ? "sidebar-collapsed" : "")}>
      <aside className="sidebar">
        <Link
          className="wordmark"
          href="/overview"
          aria-label="CleverTap overview"
        >
          <span className="brand-mark">C</span>
          {!collapsed ? (
            <span>
              CleverTap<span className="brand-period">.</span>
            </span>
          ) : null}
        </Link>
        <div className="project-switch">
          <span className="project-avatar">
            {workspace.project?.name.slice(0, 1) || "S"}
          </span>
          {!collapsed ? (
            <div>
              <select
                aria-label="Select project"
                value={workspace.projectId}
                onChange={(event) => {
                  workspace.setProject(event.target.value);
                  const parts = pathname.split("/").filter(Boolean);
                  if (
                    [
                      "segments",
                      "people",
                      "campaigns",
                      "templates",
                      "journeys",
                      "boards",
                    ].includes(parts[0]) &&
                    parts[1]
                  )
                    router.push("/" + parts[0]);
                }}
              >
                {workspace.projects.length ? (
                  workspace.projects.map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.name}
                    </option>
                  ))
                ) : (
                  <option value={workspace.projectId}>Shopwise</option>
                )}
              </select>
              <span>Demo workspace</span>
            </div>
          ) : null}
          {!collapsed ? <ChevronDown size={14} /> : null}
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.group}>
              {!collapsed ? (
                <div className="nav-label">{group.group}</div>
              ) : null}
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={
                    "nav-item " +
                    (pathname.startsWith(item.href) ? "active" : "")
                  }
                  aria-current={
                    pathname.startsWith(item.href) ? "page" : undefined
                  }
                >
                  <item.icon size={18} strokeWidth={1.7} />
                  {!collapsed ? (
                    <>
                      <span>{item.label}</span>
                      {item.label === "Journeys" ? (
                        <span className="tiny-dot" />
                      ) : null}
                    </>
                  ) : null}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {!collapsed ? (
            <a
              className="help-card"
              href="https://docs.clevertap.com/docs"
              target="_blank"
              rel="noreferrer"
            >
              <span className="help-card-icon">
                <Sparkles size={17} />
              </span>
              <div>
                <strong>A little help goes a long way</strong>
                <span>
                  Explore the knowledge base <ArrowUpRight size={12} />
                </span>
              </div>
            </a>
          ) : null}
          <button
            className="profile-button"
            onClick={() => setHelp((value) => !value)}
          >
            <span className="avatar avatar-small avatar-color-2">AM</span>
            {!collapsed ? (
              <>
                <span>
                  <strong>Alex Morgan</strong>
                  <small>Workspace admin</small>
                </span>
                <ChevronDown size={14} />
              </>
            ) : null}
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              label={collapsed ? "Expand navigation" : "Collapse navigation"}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <Menu size={18} /> : <PanelLeftClose size={18} />}
            </IconButton>
            <span>Workspace</span>
            <ChevronRight size={13} />
            <strong>{active?.label || "Overview"}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="global-search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span>Search anything...</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="demo-chip">
              <i />
              Demo
            </span>
            <IconButton
              label="Notifications"
              onClick={() => setNotifications((value) => !value)}
            >
              <Bell size={18} />
            </IconButton>
            <IconButton
              label="Help and resources"
              onClick={() => setHelp((value) => !value)}
            >
              <HelpCircle size={18} />
            </IconButton>
            <span className="avatar avatar-small avatar-color-2">AM</span>
          </div>
        </header>
        <div className="workspace-filter">
          <div>
            <span className="live-dot" />
            All systems operational
            <span className="filter-divider" />
            <span>
              Project timezone: {workspace.project?.timezone || "Asia/Shanghai"}
            </span>
          </div>
          <button
            className="date-button"
            onClick={() => {
              setFrom(workspace.from);
              setTo(workspace.to);
              setDateOpen(true);
            }}
          >
            <CalendarDays size={15} />
            <span>
              {workspace.from === "2026-10-21" && workspace.to === "2026-11-19"
                ? "Last 30 days"
                : workspace.from + " – " + workspace.to}
            </span>
            <ChevronDown size={13} />
          </button>
        </div>
        <main className="main-content">{children}</main>
        <footer className="workspace-footer">
          <span>Made for meaningful customer connections.</span>
          <span>CleverTap Clone · Demo workspace</span>
        </footer>
      </div>
      {searchOpen ? (
        <Modal
          title="Where would you like to go?"
          onClose={() => setSearchOpen(false)}
        >
          <div className="command-input">
            <Search size={19} />
            <input
              autoFocus
              aria-label="Search pages"
              placeholder="Search pages and tools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Command size={16} />
          </div>
          <div className="command-results">
            {navigation
              .flatMap((group) => group.items)
              .filter((item) =>
                item.label.toLowerCase().includes(search.toLowerCase()),
              )
              .map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  onClick={() => {
                    setSearchOpen(false);
                    setSearch("");
                  }}
                >
                  <item.icon size={18} />
                  <span>{item.label}</span>
                  <ArrowUpRight size={14} />
                </Link>
              ))}
          </div>
        </Modal>
      ) : null}
      {dateOpen ? (
        <Modal
          title="Choose a date range"
          description="Apply this range to your analytics and overview."
          onClose={() => setDateOpen(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => setDateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (from > to) {
                    workspace.toast(
                      "Start date must be before the end date.",
                      "error",
                    );
                    return;
                  }
                  workspace.setDates(from, to);
                  setDateOpen(false);
                }}
              >
                Apply date range
              </Button>
            </>
          }
        >
          <div className="date-presets">
            {[
              ["Last 7 days", "2026-11-13"],
              ["Last 14 days", "2026-11-06"],
              ["Last 30 days", "2026-10-21"],
            ].map(([name, value]) => (
              <button
                key={name}
                className={
                  from === value && to === "2026-11-19" ? "selected" : ""
                }
                onClick={() => {
                  setFrom(value);
                  setTo("2026-11-19");
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <Field label="From">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="To">
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </div>
          <p className="muted small">
            Seed data is anchored to November 19, 2026 for repeatable
            demonstrations.
          </p>
        </Modal>
      ) : null}
      {notifications ? (
        <Modal
          title="You're all caught up"
          description="Workspace updates and delivery notices appear here."
          onClose={() => setNotifications(false)}
        >
          <div className="notification-item">
            <span className="success-icon">
              <Check size={20} />
            </span>
            <div>
              <strong>Your workspace is ready</strong>
              <p>
                Customer data, templates and channels are available. Create a
                campaign to get started.
              </p>
              <small>Workspace setup</small>
            </div>
          </div>
        </Modal>
      ) : null}
      {help ? (
        <Modal title="Your workspace" onClose={() => setHelp(false)}>
          <div className="account-summary">
            <span className="avatar avatar-large avatar-color-2">AM</span>
            <div>
              <h3>Alex Morgan</h3>
              <p>alex.morgan@example.com</p>
              <BadgeLabel />
            </div>
          </div>
          <div className="resource-links">
            <a
              href="https://docs.clevertap.com/docs"
              target="_blank"
              rel="noreferrer"
            >
              Product documentation
              <ArrowUpRight size={16} />
            </a>
            <a
              href="https://clevertap.com/demo-center/"
              target="_blank"
              rel="noreferrer"
            >
              Official demo center
              <ArrowUpRight size={16} />
            </a>
            <Link href="/settings/project" onClick={() => setHelp(false)}>
              Project settings
              <Settings size={16} />
            </Link>
          </div>
          <p className="muted small">
            This local workspace saves data through a real API and database.
            Message delivery uses a demo simulation.
          </p>
        </Modal>
      ) : null}
    </div>
  );
}
function BadgeLabel() {
  return <span className="tag">Workspace admin</span>;
}
