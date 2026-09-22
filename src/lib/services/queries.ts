import { db } from "@/lib/db";
import { shortName } from "@/lib/format";
import type { InterviewRow } from "@/components/interviews/interview-list";

/** Shared list query → InterviewRow (only non-sensitive fields). */
export async function interviewRows(where: Parameters<typeof db.interview.findMany>[0] extends infer A ? A extends { where?: infer W } ? W : never : never, take = 50, orderBy: "recent" | "upcoming" = "recent"): Promise<InterviewRow[]> {
  const list = await db.interview.findMany({
    where,
    take,
    orderBy: orderBy === "recent" ? [{ completedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }] : [{ scheduledAt: "asc" }],
    include: { interviewer: { select: { profile: true } }, student: { select: { profile: true } } },
  });
  return list.map((i) => ({
    id: i.id,
    targetRole: i.targetRole,
    company: i.company,
    mode: i.mode,
    type: i.type,
    status: i.status,
    gradingStatus: i.gradingStatus,
    overallScore: i.overallScore,
    date: i.completedAt ?? i.scheduledAt ?? i.createdAt,
    interviewerName: i.interviewer ? shortName(i.interviewer.profile) : null,
    studentName: shortName(i.student.profile),
  }));
}
