import { cn } from "@/lib/cn";
import { scoreLabel, scoreTone } from "@/lib/format";

const toneColor = { excellent: "#4A5430", good: "#76844C", fair: "#B7791F", low: "#B91C1C", neutral: "#94989D" };

export function ScoreRing({ score, size = 132, stroke = 10, label = "Overall score" }: { score: number | null; size?: number; stroke?: number; label?: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(0, Math.min(100, score)) / 100;
  const color = toneColor[scoreTone(score)];
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }} role="img" aria-label={`${label}: ${score ?? "not available"} out of 100`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#EFEFF0" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round" className="transition-[stroke-dashoffset] duration-700" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-ink-950">{score ?? "—"}</span>
        <span className="text-[11px] text-ink-500">/ 100</span>
      </div>
    </div>
  );
}

export function ScoreBar({ label, score, className }: { label: string; score: number | null | undefined; className?: string }) {
  const tone = scoreTone(score);
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-700">{label}</span>
        <span className="font-semibold tabular-nums text-ink-900">
          {score ?? "—"}
          <span className="ml-1.5 text-[11px] font-normal text-ink-500">{score != null ? scoreLabel(score) : "N/A"}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-label={label} aria-valuenow={score ?? 0} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${score ?? 0}%`, backgroundColor: toneColor[tone] }} />
      </div>
    </div>
  );
}

export function ScorePill({ score }: { score: number | null | undefined }) {
  if (score == null) return <span className="text-sm text-ink-400">—</span>;
  const tone = scoreTone(score);
  const bg = { excellent: "bg-olive-100 text-olive-900", good: "bg-olive-50 text-olive-800", fair: "bg-amber-50 text-amber-800", low: "bg-red-50 text-red-700", neutral: "bg-ink-100 text-ink-600" }[tone];
  return <span className={cn("inline-flex min-w-[3.25rem] justify-center rounded-md px-2 py-0.5 text-sm font-semibold tabular-nums", bg)}>{score}</span>;
}
