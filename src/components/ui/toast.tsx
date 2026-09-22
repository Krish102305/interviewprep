"use client";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, Info, XCircle, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Toast = { id: number; tone: "success" | "error" | "info"; message: string };
const ToastCtx = createContext<{ push: (tone: Toast["tone"], message: string) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((tone: Toast["tone"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-3), { id, tone, message }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === "error" ? 7000 : 4500);
  }, []);
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:right-6 sm:items-end" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? XCircle : Info;
          return (
            <div key={t.id} role={t.tone === "error" ? "alert" : "status"} className={cn("pointer-events-auto flex w-full max-w-sm animate-fade-in items-start gap-3 rounded-xl border bg-white px-4 py-3 text-sm shadow-lift", t.tone === "error" ? "border-red-200" : "border-ink-200")}>
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", t.tone === "success" ? "text-emerald-600" : t.tone === "error" ? "text-red-600" : "text-ink-500")} aria-hidden />
              <p className="flex-1 text-ink-800">{t.message}</p>
              <button onClick={() => setToasts((x) => x.filter((y) => y.id !== t.id))} className="text-ink-400 hover:text-ink-700" aria-label="Dismiss notification">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return {
    success: (m: string) => ctx.push("success", m),
    error: (m: string) => ctx.push("error", m),
    info: (m: string) => ctx.push("info", m),
  };
}
