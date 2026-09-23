import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { LABELS, roleCategoryLabel } from "@/lib/constants";
import { fullName } from "@/lib/format";
import { parseJsonArray } from "@/lib/json";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Interviewers · Admin" };

export default async function AdminInterviewers() {
  await requirePageUser({ roles: ["admin"] });
  const list = await db.interviewerProfile.findMany({ include: { user: { select: { id: true, email: true, accountStatus: true, profile: true, _count: { select: { interviewsAsInterviewer: { where: { status: "completed" } } } } } } } });
  const ratings = await db.interviewerRating.groupBy({ by: ["interviewerId"], where: { moderationStatus: "visible" }, _avg: { professionalism: true, realism: true, communication: true, feedbackQuality: true }, _count: true });
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Interviewers" description={`${list.length} interviewer profiles`} />
      <Card className="overflow-x-auto">
        {list.length === 0 ? <div className="p-6"><EmptyState title="No interviewers yet" /></div> : (
          <table className="w-full min-w-[860px] text-sm">
            <thead><tr className="border-b border-ink-200 text-left text-xs text-ink-500"><th className="px-5 py-2.5 font-medium">Name</th><th className="py-2.5 pr-4 font-medium">Type</th><th className="py-2.5 pr-4 font-medium">Title</th><th className="py-2.5 pr-4 font-medium">Roles</th><th className="py-2.5 pr-4 font-medium">Completed</th><th className="py-2.5 pr-4 font-medium">Rating</th><th className="py-2.5 pr-5 font-medium">Status</th></tr></thead>
            <tbody>
              {list.map((p) => {
                const r = ratings.find((x) => x.interviewerId === p.userId);
                const avg = r ? (((r._avg.professionalism ?? 0) + (r._avg.realism ?? 0) + (r._avg.communication ?? 0) + (r._avg.feedbackQuality ?? 0)) / 4).toFixed(1) : "N/A";
                return (
                  <tr key={p.id} className="border-b border-ink-100 last:border-0">
                    <td className="px-5 py-3"><Link href={`/admin/users/${p.userId}`} className="font-medium hover:underline">{fullName(p.user.profile)}</Link><p className="text-xs text-ink-500">{p.user.email}</p></td>
                    <td className="py-3 pr-4">{LABELS.interviewerType[p.interviewerType]}</td>
                    <td className="py-3 pr-4 text-ink-600">{p.title}{p.company ? ` · ${p.company}` : ""}</td>
                    <td className="py-3 pr-4 text-xs text-ink-600">{parseJsonArray(p.roles).map(roleCategoryLabel).join(", ")}</td>
                    <td className="py-3 pr-4 tabular-nums">{p.user._count.interviewsAsInterviewer}</td>
                    <td className="py-3 pr-4 tabular-nums">{avg}{r ? <span className="text-xs text-ink-400"> ({r._count})</span> : null}</td>
                    <td className="py-3 pr-5"><Badge tone={p.user.accountStatus === "active" ? "success" : "danger"}>{p.user.accountStatus}</Badge>{p.availableNow && <Badge tone="olive" className="ml-1">available now</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
