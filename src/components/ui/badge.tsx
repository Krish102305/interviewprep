import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  olive: "bg-olive-50 text-olive-800 ring-olive-200",
  dark: "bg-ink-900 text-white ring-ink-900",
  success: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  warning: "bg-amber-50 text-amber-800 ring-amber-200",
  danger: "bg-red-50 text-red-700 ring-red-200",
  info: "bg-sky-50 text-sky-800 ring-sky-200",
};
export type BadgeTone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className, icon }: { tone?: BadgeTone; children: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset", tones[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

const statusTone: Record<string, BadgeTone> = {
  scheduled: "info",
  waiting: "warning",
  active: "olive",
  completed: "success",
  cancelled: "neutral",
  no_show: "warning",
  reported: "danger",
  pending: "warning",
  processing: "info",
  failed: "danger",
  confirmed: "danger",
  dismissed: "neutral",
  appealed: "info",
  overturned: "success",
  approved: "success",
  denied: "danger",
  removed: "neutral",
  banned: "danger",
  suspended: "warning",
};
export const toneForStatus = (s: string): BadgeTone => statusTone[s] ?? "neutral";
