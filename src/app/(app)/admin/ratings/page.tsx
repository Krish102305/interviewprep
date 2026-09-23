import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { formatDate, fullName } from "@/lib/format";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { RatingToggle } from "@/components/admin/rating-toggle";

export const metadata: Metadata = { title: "Ratings · Admin" };

export default async function AdminRatings() {
  await requirePageUser({ roles: ["admin"] });
  const ratings = await db.interviewerRating.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { student: { select: { profile: true } }, interviewer: { select: { profile: true } } } });
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Interviewer ratings" description="Hide abusive or bad-faith ratings. Hidden ratings don't count toward averages or badges." />
      <Card className="overflow-x-auto">
        {ratings.length === 0 ? <div className="p-6"><EmptyState title="No ratings yet" /></div> : (
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-ink-200 text-left text-xs text-ink-500"><th className="px-5 py-2.5 font-medium">Interviewer</th><th className="py-2.5 pr-4 font-medium">From</th><th className="py-2.5 pr-4 font-medium">Prof / Real / Comm / Feedback</th><th className="py-2.5 pr-4 font-medium">Comment</th><th className="py-2.5 pr-4 font-medium">Date</th><th className="py-2.5 pr-5" /></tr></thead>
            <tbody>
              {ratings.map((r) => (
                <tr key={r.id} className="border-b border-ink-100 last:border-0">
                  <td className="px-5 py-3 font-medium">{fullName(r.interviewer.profile)}</td>
                  <td className="py-3 pr-4 text-ink-600">{fullName(r.student.profile)}</td>
                  <td className="py-3 pr-4 tabular-nums">{r.professionalism} / {r.realism} / {r.communication} / {r.feedbackQuality}</td>
                  <td className="max-w-xs py-3 pr-4 text-ink-600">{r.comment ?? "N/A"}</td>
                  <td className="py-3 pr-4 text-ink-500">{formatDate(r.createdAt)}</td>
                  <td className="py-3 pr-5 text-right">{r.moderationStatus === "hidden" && <Badge tone="warning" className="mr-2">hidden</Badge>}<RatingToggle id={r.id} hidden={r.moderationStatus === "hidden"} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
