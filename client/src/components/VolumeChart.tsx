import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { VolumePoint } from "#shared/schemas.js";

function formatHour(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    hour12: true,
  });
}

function formatTooltipLabel(label: unknown): string {
  if (typeof label !== "string") return "";
  return new Date(label).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    hour12: true,
  });
}

const SERIES_COLOR_LIGHT = "#2a78d6";
const SERIES_COLOR_DARK = "#3987e5";

function useSeriesColor(): string {
  if (typeof window === "undefined") return SERIES_COLOR_LIGHT;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? SERIES_COLOR_DARK
    : SERIES_COLOR_LIGHT;
}

export function VolumeChart({ data }: { data: VolumePoint[] }) {
  const color = useSeriesColor();

  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-neutral-400 dark:text-neutral-500">
        No label activity in the last 24 hours
      </div>
    );
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
          <CartesianGrid
            strokeDasharray=""
            stroke="var(--color-neutral-200)"
            className="dark:[stroke:var(--color-neutral-700)]"
            vertical={false}
          />
          <XAxis
            dataKey="hour"
            tickFormatter={formatHour}
            tick={{ fontSize: 12, fill: "var(--color-neutral-400)" }}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 12, fill: "var(--color-neutral-400)" }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
          />
          <Tooltip
            labelFormatter={formatTooltipLabel}
            contentStyle={{
              borderRadius: 8,
              border: "1px solid var(--color-neutral-200)",
              fontSize: 13,
            }}
          />
          <Area
            type="monotone"
            dataKey="labels"
            name="Labels"
            stroke={color}
            strokeWidth={2}
            fill={color}
            fillOpacity={0.1}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
