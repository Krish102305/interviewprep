import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function Stepper({ steps, current }: { steps: string[]; current: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s} className="flex flex-1 items-center gap-2" aria-current={i === current ? "step" : undefined}>
          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold", i < current ? "bg-olive-600 text-white" : i === current ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-500")}>
            {i < current ? <Check className="h-3.5 w-3.5" /> : i + 1}
          </span>
          <span className={cn("hidden text-xs font-medium md:block", i === current ? "text-ink-900" : "text-ink-500")}>{s}</span>
          {i < steps.length - 1 && <span className={cn("h-px flex-1", i < current ? "bg-olive-400" : "bg-ink-200")} />}
        </li>
      ))}
    </ol>
  );
}
