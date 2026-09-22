import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { LABELS } from "@/lib/constants";
import { formatDateTime, fullName } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { ScorePill } from "@/components/ui/score";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Interviews · Admin" };

export default async function AdminInterviews({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePageUser({ roles: ["admin"] });
  const status = (await searchParams).status;
  const list = await db.interview.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 200, include: { student: { select: { profile: true } }, interviewer: { select: { profile: true } } } });
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Interviews" />
      <nav className="mb-4 flex flex-wrap gap-1.5">
        {[undefined, "scheduled", "active", "completed", "reported", "no_show", "cancelled"].map((s) => (
          <Link key={s ?? "all"} href={s ? `/admin/interviews?status=${s}` : "/admin/interviews"} className={cn("rounded-full px-3 py-1 text-sm", status === s ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100")}>{s ? LABELS.status[s] : "All"}</Link>
        ))}
      </nav>
      <Card className="overflow-x-auto">
        {list.length === 0 ? <div className="p-6"><EmptyState title="No interviews" /></div> : (
          <table className="w-full min-w-[900px] text-sm">
            <thead><tr className="border-b border-ink-200 text-left text-xs text-ink-500"><th className="px-5 py-2.5 font-medium">Role</th><th className="py-2.5 pr-4 font-medium">Candidate</th><th className="py-2.5 pr-4 font-medium">Interviewer</th><th className="py-2.5 pr-4 font-medium">Mode / Type</th><th className="py-2.5 pr-4 font-medium">When</th><th className="py-2.5 pr-4 font-medium">Status</th><th className="py-2.5 pr-4 font-medium">Grading</th><th className="py-2.5 pr-5 text-right font-medium">Score</th></tr></thead>
            <tbody>
              {list.map((iv) => (
                <tr key={iv.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-5 py-3"><Link href={`/admin/interviews/${iv.id}`} className="font-medium hover:underline">{iv.targetRole}</Link></td>
                  <td className="py-3 pr-4">{fullName(iv.student.profile)}</td>
                  <td className="py-3 pr-4">{iv.mode === "ai" ? "AI" : iv.interviewer ? fullName(iv.interviewer.profile) : <span className="text-ink-400">Unmatched</span>}</td>
                  <td className="py-3 pr-4">{LABELS.mode[iv.mode]} · {LABELS.type[iv.type]}</td>
                  <td className="py-3 pr-4 text-ink-500">{formatDateTime(iv.completedAt ?? iv.scheduledAt ?? iv.createdAt)}</td>
                  <td className="py-3 pr-4"><Badge tone={toneForStatus(iv.status)}>{LABELS.status[iv.status]}</Badge></td>
                  <td className="py-3 pr-4"><Badge tone={toneForStatus(iv.gradingStatus)}>{iv.gradingStatus}</Badge></td>
                  <td className="py-3 pr-5 text-right"><ScorePill score={iv.overallScore} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
