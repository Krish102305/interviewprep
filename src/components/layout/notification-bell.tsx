"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { api } from "@/lib/client-api";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/ui/feedback";

type N = { id: string; title: string; body: string; link: string | null; readAt: string | null; createdAt: string };

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<N[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ unread: number; items: N[] }>("/api/notifications?limit=8");
      setUnread(data.unread);
      setItems(data.items);
    } catch {
      /* ignore transient errors */
    }
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    refresh();
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refresh]);

  async function markAll() {
    await api("/api/notifications", { body: { all: true } });
    refresh();
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className="relative rounded-lg p-2 text-ink-600 hover:bg-ink-100 hover:text-ink-900" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} aria-expanded={open}>
        <Bell className="h-5 w-5" />
        {unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-olive-600 px-1 text-[10px] font-semibold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,380px)] animate-fade-in overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-lift">
          <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
            <p className="text-sm font-semibold">Notifications</p>
            {unread > 0 && <button onClick={markAll} className="text-xs font-medium text-olive-700 hover:underline">Mark all read</button>}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items === null ? (
              <div className="flex justify-center py-8 text-ink-400"><Spinner /></div>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">You&apos;re all caught up.</p>
            ) : (
              items.map((n) => (
                <Link key={n.id} href={n.link ?? "/notifications"} onClick={() => { setOpen(false); if (!n.readAt) api("/api/notifications", { body: { ids: [n.id] } }).then(refresh); }} className={cn("block border-b border-ink-100 px-4 py-3 last:border-0 hover:bg-ink-50", !n.readAt && "bg-olive-50/50")}>
                  <div className="flex items-start gap-2">
                    {!n.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-olive-600" aria-label="Unread" />}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-900">{n.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{n.body}</p>
                      <p className="mt-1 text-[11px] text-ink-400">{relativeTime(n.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              ))
            )}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-ink-100 px-4 py-2.5 text-center text-xs font-medium text-ink-600 hover:bg-ink-50">View all notifications</Link>
        </div>
      )}
    </div>
  );
}
