"use client";
import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table2, LineChart as LineIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { LABELS } from "@/lib/constants";

/** Fixed series→color mapping (validated palette). Color follows the metric, never its rank. */
export const SERIES = [
  { key: "overall", label: "Overall", color: "#6b8a1f" },
  { key: "behavioral", label: "Behavioral", color: "#2a78d6" },
  { key: "technical", label: "Technical", color: "#eb6834" },
  { key: "communication", label: "Communication", color: "#4a3aa7" },
  { key: "confidence", label: "Confidence", color: "#eda100" },
  { key: "problemSolving", label: "Problem Solving", color: "#e87ba4" },
  { key: "professionalism", label: "Professionalism", color: "#1baf7a", dashed: true },
] as const;
type SeriesKey = (typeof SERIES)[number]["key"];

export type TimelinePoint = { id: string; date: string; role: string; mode: string; type: string } & Partial<Record<SeriesKey, number | null>>;

const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function PerformanceChart({ data, defaultSeries = ["overall"], height = 280, maxSeries = 4 }: { data: TimelinePoint[]; defaultSeries?: SeriesKey[]; height?: number; maxSeries?: number }) {
  const [active, setActive] = useState<SeriesKey[]>(defaultSeries);
  const [table, setTable] = useState(false);
  const rows = useMemo(() => data.map((d, i) => ({ ...d, idx: i, label: fmt(d.date) })), [data]);
  const shown = SERIES.filter((s) => active.includes(s.key));

  const toggle = (k: SeriesKey) =>
    setActive((a) => (a.includes(k) ? (a.length > 1 ? a.filter((x) => x !== k) : a) : a.length >= maxSeries ? [...a.slice(1), k] : [...a, k]));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Metrics shown">
          {SERIES.map((s) => {
            const on = active.includes(s.key);
            return (
              <button key={s.key} type="button" aria-pressed={on} onClick={() => toggle(s.key)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition", on ? "border-ink-300 bg-white text-ink-900 shadow-card" : "border-transparent text-ink-500 hover:text-ink-800")}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: on ? s.color : "#C4C7CA" }} aria-hidden />
                {s.label}
              </button>
            );
          })}
        </div>
        <button type="button" onClick={() => setTable((t) => !t)} className="ml-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-600 hover:bg-ink-100" aria-pressed={table}>
          {table ? <LineIcon className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />} {table ? "Chart view" : "Table view"}
        </button>
      </div>

      {table ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Scores by interview</caption>
            <thead>
              <tr className="border-b border-ink-200 text-left text-xs text-ink-500">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Interview</th>
                {shown.map((s) => <th key={s.key} className="py-2 pr-4 text-right font-medium">{s.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-ink-100">
                  <td className="py-2 pr-4 text-ink-600">{r.label}</td>
                  <td className="py-2 pr-4 text-ink-800">{r.role} · {LABELS.mode[r.mode]} · {LABELS.type[r.type]}</td>
                  {shown.map((s) => <td key={s.key} className="py-2 pr-4 text-right tabular-nums text-ink-900">{r[s.key] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ height }} role="img" aria-label={`Line chart of ${shown.map((s) => s.label).join(", ")} scores across ${rows.length} interviews. Use table view for exact values.`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#EFEFF0" vertical={false} />
              <XAxis dataKey="idx" tickFormatter={(i) => rows[i]?.label ?? ""} tick={{ fontSize: 11, fill: "#686C72" }} axisLine={{ stroke: "#E2E3E5" }} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
              <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fontSize: 11, fill: "#686C72" }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ stroke: "#94989D", strokeWidth: 1 }}
                content={({ active: a, payload }) => {
                  if (!a || !payload?.length) return null;
                  const p = payload[0].payload as (typeof rows)[number];
                  return (
                    <div className="rounded-xl border border-ink-200 bg-white px-3 py-2 text-xs shadow-lift">
                      <p className="font-medium text-ink-900">{p.role}</p>
                      <p className="mb-1.5 text-ink-500">{p.label} · {LABELS.mode[p.mode]} · {LABELS.type[p.type]}</p>
                      {shown.map((s) => (
                        <p key={s.key} className="flex items-center justify-between gap-4 text-ink-700">
                          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />{s.label}</span>
                          <span className="font-semibold tabular-nums text-ink-900">{p[s.key] ?? "—"}</span>
                        </p>
                      ))}
                    </div>
                  );
                }}
              />
              {shown.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2} strokeDasharray={"dashed" in s ? "5 4" : undefined} dot={{ r: 4, strokeWidth: 2, stroke: "#fff", fill: s.color }} activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2 }} connectNulls isAnimationActive={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
