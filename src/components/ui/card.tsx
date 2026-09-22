import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-2xl border border-ink-200/80 bg-white shadow-card", className)} {...rest} />;
}

export function CardHeader({ title, description, action, className, as: As = "h2" }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string; as?: "h2" | "h3" }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 sm:px-6", className)}>
      <div className="min-w-0">
        <As className="text-[15px] font-semibold text-ink-900">{title}</As>
        {description && <p className="mt-0.5 text-sm text-ink-500">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 py-5 sm:px-6", className)} {...rest} />;
}

export function StatCard({ label, value, sub, icon, tone = "default", className }: { label: string; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: "default" | "olive" | "warning" | "danger" | "success"; className?: string }) {
  const tones = {
    default: "bg-ink-50 text-ink-700",
    olive: "bg-olive-50 text-olive-700",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
    success: "bg-emerald-50 text-emerald-700",
  };
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        {icon && <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg", tones[tone])}>{icon}</span>}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight text-ink-900">{value}</div>
      {sub && <div className="mt-1 text-xs text-ink-500">{sub}</div>}
    </Card>
  );
}

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: ReactNode; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
        <h1 className="text-2xl font-semibold text-ink-950 sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-ink-500 sm:text-[15px]">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}
