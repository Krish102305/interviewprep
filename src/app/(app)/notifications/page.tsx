import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { MarkAllRead } from "@/components/shared/mark-all-read";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requirePageUser({ allowRestricted: true });
  const items = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Notifications" action={items.some((n) => !n.readAt) ? <MarkAllRead /> : undefined} />
      <Card>
        {items.length === 0 ? <div className="p-6"><EmptyState icon={<Bell className="h-5 w-5" />} title="You're all caught up" /></div> : (
          <ul className="divide-y divide-ink-100">
            {items.map((n) => {
              const body = (
                <div className={cn("flex gap-3 px-5 py-4", !n.readAt && "bg-olive-50/50")}>
                  {!n.readAt ? <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-olive-600" aria-label="Unread" /> : <span className="w-2 shrink-0" />}
                  <div>
                    <p className="text-sm font-medium text-ink-900">{n.title}</p>
                    <p className="mt-0.5 text-sm text-ink-600">{n.body}</p>
                    <p className="mt-1 text-xs text-ink-400">{formatDateTime(n.createdAt, user.profile?.timezone)}</p>
                  </div>
                </div>
              );
              return <li key={n.id}>{n.link ? <Link href={n.link} className="block hover:bg-ink-50">{body}</Link> : body}</li>;
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
