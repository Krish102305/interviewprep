import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { conductReasonLabel } from "@/lib/constants";
import { formatDate, fullName } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { AdminAction } from "@/components/admin/admin-action";

export const metadata: Metadata = { title: "Strikes · Admin" };

export default async function AdminStrikes() {
  await requirePageUser({ roles: ["admin"] });
  const strikes = await db.strike.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { user: { select: { id: true, profile: true, accountStatus: true } }, reviewer: { select: { profile: true } }, interview: { select: { id: true, targetRole: true } } } });
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Strikes" description="All strikes issued on the platform." />
      <Card className="overflow-x-auto">
        {strikes.length === 0 ? <div className="p-6"><EmptyState title="No strikes issued" /></div> : (
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-ink-200 text-left text-xs text-ink-500"><th className="px-5 py-2.5 font-medium">User</th><th className="py-2.5 pr-4 font-medium">#</th><th className="py-2.5 pr-4 font-medium">Reason</th><th className="py-2.5 pr-4 font-medium">Interview</th><th className="py-2.5 pr-4 font-medium">Reviewer</th><th className="py-2.5 pr-4 font-medium">Date</th><th className="py-2.5 pr-4 font-medium">Status</th><th className="py-2.5 pr-5" /></tr></thead>
            <tbody>
              {strikes.map((s) => (
                <tr key={s.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-5 py-3"><Link href={`/admin/users/${s.user.id}`} className="font-medium hover:underline">{fullName(s.user.profile)}</Link>{s.user.accountStatus === "banned" && <Badge tone="danger" className="ml-2">banned</Badge>}</td>
                  <td className="py-3 pr-4 tabular-nums">{s.strikeNumber}</td>
                  <td className="py-3 pr-4"><p>{conductReasonLabel(s.reason)}</p><p className="max-w-xs truncate text-xs text-ink-500" title={s.description}>{s.description}</p></td>
                  <td className="py-3 pr-4">{s.interview ? <Link href={`/admin/interviews/${s.interview.id}`} className="hover:underline">{s.interview.targetRole}</Link> : "—"}</td>
                  <td className="py-3 pr-4 text-ink-600">{fullName(s.reviewer?.profile)}</td>
                  <td className="py-3 pr-4 text-ink-500">{formatDate(s.createdAt)}</td>
                  <td className="py-3 pr-4"><Badge tone={s.status === "active" ? "danger" : "success"}>{s.status}</Badge></td>
                  <td className="py-3 pr-5 text-right">{s.status === "active" && <AdminAction url={`/api/admin/strikes/${s.id}`} noteRequired label="Remove" variant="ghost" title="Remove this strike?" description="If the user was banned and drops below 3 active strikes, their account can be restored." success="Strike removed." checkbox={{ key: "restoreAccount", label: "Restore account if eligible", default: true }} />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
