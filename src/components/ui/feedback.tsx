import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/cn";

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <svg className={cn("h-5 w-5 animate-spin", className)} viewBox="0 0 24 24" fill="none" role={label ? "status" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton h-4", className)} aria-hidden />;
}

export function LoadingBlock({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div className={cn("flex items-center justify-center gap-3 py-12 text-sm text-ink-500", className)} role="status">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ icon, title, description, action, className }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-ink-200 bg-white/60 px-6 py-10 text-center", className)}>
      {icon && <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-olive-50 text-olive-700">{icon}</div>}
      <p className="font-medium text-ink-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

const alertStyles = {
  info: { box: "border-ink-200 bg-white text-ink-800", icon: Info, iconClass: "text-ink-500" },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-900", icon: CheckCircle2, iconClass: "text-emerald-600" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-900", icon: AlertTriangle, iconClass: "text-amber-600" },
  danger: { box: "border-red-200 bg-red-50 text-red-900", icon: XCircle, iconClass: "text-red-600" },
};

export function Alert({ tone = "info", title, children, className, action }: { tone?: keyof typeof alertStyles; title?: string; children?: ReactNode; className?: string; action?: ReactNode }) {
  const s = alertStyles[tone];
  const Icon = s.icon;
  return (
    <div className={cn("flex gap-3 rounded-xl border p-4 text-sm", s.box, className)} role={tone === "danger" || tone === "warning" ? "alert" : "status"}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", s.iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(title && "mt-1", "leading-relaxed opacity-90")}>{children}</div>}
      </div>
      {action && <div className="shrink-0 self-center">{action}</div>}
    </div>
  );
}
