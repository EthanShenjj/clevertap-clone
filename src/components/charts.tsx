"use client";
import { compact } from "@/lib/client";
import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
export const CHART_COLORS = [
  "#3b6cf4",
  "#8b76e8",
  "#33b69b",
  "#f3ac50",
  "#ea758b",
];
const axis = { fontSize: 11, fill: "#8991a1", fontFamily: "inherit" };
const tip = {
  border: "1px solid #e8ebf1",
  borderRadius: 9,
  fontSize: 12,
  boxShadow: "0 8px 24px #1c2b4a12",
};
export function TrendChart({
  data,
  dataKey = "users",
  height = 260,
  color = "#3b6cf4",
}: {
  data: Record<string, unknown>[];
  dataKey?: string;
  height?: number;
  color?: string;
}) {
  const id = useId().replaceAll(":", "");
  return (
    <div
      style={{ height, width: "100%", minWidth: 0 }}
      aria-label={dataKey + " over time"}
      role="img"
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 16, right: 14, left: -13, bottom: 0 }}
        >
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.15} />
              <stop offset="100%" stopColor={color} stopOpacity={0.005} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 4"
            vertical={false}
            stroke="#edf0f5"
          />
          <XAxis
            dataKey="date"
            tick={axis}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
            tickFormatter={(value) =>
              new Date(String(value) + "T12:00:00").toLocaleDateString(
                "en-US",
                { month: "short", day: "numeric" },
              )
            }
          />
          <YAxis
            tick={axis}
            axisLine={false}
            tickLine={false}
            tickFormatter={compact}
          />
          <Tooltip contentStyle={tip} labelStyle={{ color: "#657087" }} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={2.2}
            fill={"url(#" + id + ")"}
            activeDot={{ r: 5, stroke: "white", strokeWidth: 3 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function MultiLineChart({
  data,
  events,
}: {
  data: Record<string, unknown>[];
  events: string[];
}) {
  return (
    <div
      style={{ height: 320, minWidth: 0 }}
      role="img"
      aria-label="Event trends"
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={{ top: 15, right: 15, left: -15, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 4"
            vertical={false}
            stroke="#edf0f5"
          />
          <XAxis
            dataKey="date"
            tick={axis}
            axisLine={false}
            tickLine={false}
            minTickGap={40}
            tickFormatter={(v) => String(v).slice(5)}
          />
          <YAxis
            tick={axis}
            axisLine={false}
            tickLine={false}
            tickFormatter={compact}
          />
          <Tooltip contentStyle={tip} />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: 20 }} />
          {events.map((event, index) => (
            <Line
              key={event}
              type="monotone"
              dataKey={event}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeWidth={2.1}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
export function PlatformChart({
  data,
  total,
}: {
  data: { name: string; value: number; color: string }[];
  total: number;
}) {
  return (
    <>
      <div className="donut-container">
        <ResponsiveContainer width="100%" height={210}>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              innerRadius={65}
              outerRadius={85}
              paddingAngle={3}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {data.map((item) => (
                <Cell key={item.name} fill={item.color} />
              ))}
            </Pie>
            <Tooltip contentStyle={tip} />
          </PieChart>
        </ResponsiveContainer>
        <div className="donut-label">
          <strong>{compact(total)}</strong>
          <span>Total users</span>
        </div>
      </div>
      <div className="chart-legend">
        {data.map((item) => (
          <div key={item.name}>
            <span>
              <i style={{ background: item.color }} />
              {item.name}
            </span>
            <strong>
              {total ? ((item.value / total) * 100).toFixed(0) : 0}%
              <small>{compact(item.value)}</small>
            </strong>
          </div>
        ))}
      </div>
    </>
  );
}
