import { Clock, Pause } from "lucide-react";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/cn";

export const fmtClock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export function RoomTopBar({ title, subtitle, elapsed, duration, current, total, paused, live }: { title: string; subtitle: string; elapsed: number; duration: number; current: number; total: number; paused?: boolean; live?: boolean }) {
  const over = elapsed > duration * 60;
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/10 px-4 py-3 text-white sm:px-6">
      <div className="hidden sm:block"><Logo light href="#" /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{title}</p>
        <p className="truncate text-xs text-ink-400">{subtitle}</p>
      </div>
      {total > 0 && (
        <div className="flex items-center gap-3" aria-label={`Question ${current} of ${total}`}>
          <span className="text-xs text-ink-300">Question {Math.max(current, 0)} of {total}</span>
          <div className="hidden gap-1 md:flex" aria-hidden>
            {Array.from({ length: total }).map((_, i) => <span key={i} className={cn("h-1 w-4 rounded-full", i < current ? "bg-olive-400" : "bg-white/15")} />)}
          </div>
        </div>
      )}
      <div className={cn("flex items-center gap-2 rounded-lg px-2.5 py-1 font-mono text-sm tabular-nums", over ? "bg-amber-500/20 text-amber-200" : "bg-white/10")} role="timer" aria-label={`Elapsed ${fmtClock(elapsed)} of ${duration} minutes`}>
        {paused ? <Pause className="h-3.5 w-3.5" /> : live ? <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" aria-hidden /> : <Clock className="h-3.5 w-3.5" />}
        {fmtClock(elapsed)} <span className="text-ink-400">/ {duration}:00</span>
      </div>
    </header>
  );
}

export function ControlButton({ onClick, active = true, label, children, danger, disabled }: { onClick: () => void; active?: boolean; label: string; children: React.ReactNode; danger?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={danger ? undefined : !active}
      title={label}
      className={cn(
        "flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-3.5 text-sm font-medium transition focus-visible:ring-offset-ink-950 disabled:opacity-40",
        danger ? "bg-red-600 text-white hover:bg-red-700" : active ? "bg-white/10 text-white hover:bg-white/20" : "bg-white text-ink-950 hover:bg-ink-100",
      )}
    >
      {children}
    </button>
  );
}
