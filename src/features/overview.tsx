"use client";
import { clickRate } from "@/lib/domain";
import { PlatformChart, TrendChart } from "@/components/charts";
import {
  Badge,
  ChannelIcon,
  ErrorState,
  Loading,
  PageHeader,
  SectionHeading,
} from "@/components/ui";
import { useWorkspace } from "@/components/workspace-provider";
import { compact, endpoint, money, number, useRequest } from "@/lib/client";
import type { AnalyticsResult, Campaign, ListResponse } from "@/lib/types";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  CreditCard,
  Info,
  Layers,
  Megaphone,
  Plus,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

export function Overview() {
  const { projectId, project, from, to } = useWorkspace(),
    [metric, setMetric] = useState("users");
  const request = useRequest<{ data: AnalyticsResult }>(
    endpoint("analytics", projectId, { from, to }),
  );
  const campaigns = useRequest<ListResponse<Campaign>>(
    endpoint("campaigns", projectId, { pageSize: 4, status: "Running" }),
  );
  if (request.error)
    return <ErrorState message={request.error} retry={request.reload} />;
  if (!request.data)
    return <Loading label="Bringing your workspace into focus..." />;
  const data = request.data.data;
  const metrics = [
    {
      title: "Total users",
      value: number(data.totals.users),
      icon: Users,
      color: "blue",
      note: number(data.totals.reachable) + " reachable customers",
      sub: "Your growing customer community",
    },
    {
      title: "Active users",
      value: number(data.totals.active),
      icon: Activity,
      color: "purple",
      note:
        (data.totals.users
          ? (data.totals.active / data.totals.users) * 100
          : 0
        ).toFixed(1) + "% of your customer base",
      sub: "Unique users in this period",
    },
    {
      title: "Revenue",
      value: money(data.totals.revenue),
      icon: CreditCard,
      color: "green",
      note: number(data.totals.purchases) + " successful purchases",
      sub: "From your Charged events",
    },
    {
      title: "Active campaigns",
      value: number(data.totals.campaigns),
      icon: Megaphone,
      color: "orange",
      note: "Across your connected channels",
      sub: "Making every moment matter",
    },
  ];
  return (
    <>
      <PageHeader
        eyebrow={
          "YOUR " + (project?.name || "SHOPWISE").toUpperCase() + " WORKSPACE"
        }
        title="Overview"
        description="A little clarity. A lot of possibility."
        actions={
          <Link className="btn primary" href="/campaigns/new">
            <Plus size={17} />
            Create campaign
          </Link>
        }
      />
      <div className="overview-tabs">
        <span className="active">Business overview</span>
        <Link href="/boards">
          Your boards <ArrowUpRight size={13} />
        </Link>
        <span className="overview-asof">Data through Nov 19, 2026</span>
      </div>
      <div className="metric-grid">
        {metrics.map((item) => (
          <section className="metric-card" key={item.title}>
            <div className="metric-heading">
              <span>{item.title}</span>
              <span className={"metric-icon " + item.color}>
                <item.icon size={17} />
              </span>
            </div>
            <strong className="metric-value">{item.value}</strong>
            <div className="metric-note">
              <span className="small-status-dot" />
              {item.note}
            </div>
            <div className="metric-sub">{item.sub}</div>
          </section>
        ))}
      </div>
      <div className="overview-chart-grid">
        <section className="panel trend-panel">
          <SectionHeading
            title="Customer activity"
            description="See how your customers connect with your brand."
            action={
              <div className="segmented-control">
                {[
                  ["users", "Active users"],
                  ["events", "Events"],
                  ["revenue", "Revenue"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    className={metric === key ? "active" : ""}
                    onClick={() => setMetric(key)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            }
          />
          <div className="chart-value">
            <strong>
              {metric === "revenue"
                ? money(data.totals.revenue)
                : number(
                    metric === "users"
                      ? data.totals.active
                      : data.totals.events,
                  )}
            </strong>
            <span>
              <i style={{ background: "#3b6cf4" }} />
              {metric === "users"
                ? "Unique active customers"
                : metric === "revenue"
                  ? "Purchase revenue"
                  : "Events performed"}
            </span>
          </div>
          <TrendChart data={data.series} dataKey={metric} />
        </section>
        <section className="panel platform-panel">
          <SectionHeading
            title="Your audience, by platform"
            action={
              <span title="User profiles grouped by their device platform">
                <Info size={15} className="muted" />
              </span>
            }
          />
          <PlatformChart data={data.platforms} total={data.totals.users} />
        </section>
      </div>
      <div className="overview-bottom-grid">
        <section className="panel">
          <SectionHeading
            title="Campaigns in motion"
            description="A snapshot of the conversations you're starting."
            action={
              <Link className="text-link" href="/campaigns">
                View all
                <ChevronRight size={14} />
              </Link>
            }
          />
          <div className="compact-campaign-table">
            <div className="compact-table-head">
              <span>Campaign</span>
              <span>Status</span>
              <span>Click rate</span>
            </div>
            {campaigns.data?.data.map((campaign) => (
              <Link
                href={"/campaigns/" + campaign.id}
                key={campaign.id}
                className="compact-campaign-row"
              >
                <div>
                  <ChannelIcon channel={campaign.channel} boxed />
                  <span>
                    <strong>{campaign.name}</strong>
                    <small>{campaign.channel} · One-time</small>
                  </span>
                </div>
                <Badge status={campaign.status} />
                <strong>
                  {clickRate(campaign.channel, campaign.stats).toFixed(1)}%
                </strong>
              </Link>
            ))}
          </div>
        </section>
        <section className="panel">
          <SectionHeading
            title="What your customers do"
            description="The events shaping their experience."
            action={
              <Link className="text-link" href="/analytics/trends">
                <ArrowUpRight size={15} />
              </Link>
            }
          />
          <div className="event-ranking">
            {data.events.slice(0, 5).map((event, index) => (
              <Link
                key={event.name}
                href={"/analytics/events/" + encodeURIComponent(event.name)}
              >
                <span className="event-rank">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="event-rank-name">
                  {event.name}
                  <span
                    className="rank-bar"
                    style={{
                      width:
                        (event.count / Math.max(1, data.events[0].count)) *
                          100 +
                        "%",
                    }}
                  />
                </span>
                <strong>{compact(event.count)}</strong>
              </Link>
            ))}
          </div>
        </section>
      </div>
      <section className="next-steps">
        <div className="next-steps-heading">
          <h2>Make your next move</h2>
          <p>A few thoughtful actions can make a big difference.</p>
        </div>
        <div>
          {[
            {
              title: "Find your people",
              desc: "Build an audience that matters.",
              href: "/segments/new",
              icon: Layers,
              color: "purple",
            },
            {
              title: "Start a conversation",
              desc: "Create your next campaign.",
              href: "/campaigns/new",
              icon: Megaphone,
              color: "blue",
            },
            {
              title: "Connect the moments",
              desc: "Bring a customer journey to life.",
              href: "/journeys/new",
              icon: Workflow,
              color: "green",
            },
          ].map((item) => (
            <Link href={item.href} key={item.href}>
              <span className={"summary-icon " + item.color}>
                <item.icon size={20} />
              </span>
              <span>
                <strong>{item.title}</strong>
                <small>{item.desc}</small>
              </span>
              <ArrowRight size={17} />
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
