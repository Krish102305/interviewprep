"use client";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Single-series daily count chart (title names the series; no legend needed). */
export function DailyBars({ data, label }: { data: { day: string; count: number }[]; label: string }) {
  return (
    <div className="h-56" role="img" aria-label={`${label} per day over the last ${data.length} days`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -24 }} barCategoryGap={2}>
          <CartesianGrid stroke="#EFEFF0" vertical={false} />
          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "#686C72" }} tickLine={false} axisLine={{ stroke: "#E2E3E5" }} interval="preserveStartEnd" minTickGap={20} />
          <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#686C72" }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(24,25,27,0.05)" }} content={({ active, payload }) => active && payload?.length ? <div className="rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-xs shadow-lift"><p className="text-ink-500">{payload[0].payload.day}</p><p className="font-semibold text-ink-900">{payload[0].value} {label.toLowerCase()}</p></div> : null} />
          <Bar dataKey="count" fill="#6b8a1f" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
