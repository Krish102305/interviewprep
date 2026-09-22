import Link from "next/link";
import { ShieldAlert, ShieldCheck, ShieldX } from "lucide-react";
import { MAX_STRIKES } from "@/lib/constants";
import { standing } from "@/lib/services/conduct";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

/** Conduct status with icon + label + meter — never color alone. */
export function StandingCard({ strikes, accountStatus, className }: { strikes: number; accountStatus: string; className?: string }) {
  const s = standing(strikes, accountStatus);
  const Icon = s.key === "good" ? ShieldCheck : s.key === "banned" ? ShieldX : ShieldAlert;
  const tone = { success: "bg-emerald-50 text-emerald-700", warning: "bg-amber-50 text-amber-700", danger: "bg-red-50 text-red-700" }[s.tone];
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Interview Conduct</p>
        <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tone)}><Icon className="h-4 w-4" aria-hidden /></span>
      </div>
      <p className="mt-3 text-lg font-semibold text-ink-900">{s.label}</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="flex gap-1" aria-hidden>
          {Array.from({ length: MAX_STRIKES }).map((_, i) => (
            <span key={i} className={cn("h-1.5 w-6 rounded-full", i < strikes ? (strikes >= 2 ? "bg-red-500" : "bg-amber-500") : "bg-ink-200")} />
          ))}
        </div>
        <span className="text-xs font-medium text-ink-600">{Math.min(strikes, MAX_STRIKES)} / {MAX_STRIKES} Strikes</span>
      </div>
      <Link href="/conduct" className="mt-2 inline-block text-xs text-ink-500 underline-offset-2 hover:underline">{strikes ? "View history & appeal" : "Conduct standards"}</Link>
    </Card>
  );
}
