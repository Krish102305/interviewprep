import Link from "next/link";
import { Bot, ChevronRight, Users } from "lucide-react";
import { LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { ScorePill } from "@/components/ui/score";

export type InterviewRow = {
  id: string;
  targetRole: string;
  company: string | null;
  mode: string;
  type: string;
  status: string;
  gradingStatus: string;
  overallScore: number | null;
  date: Date | null;
  interviewerName: string | null;
  studentName?: string;
};

export function hrefFor(r: Pick<InterviewRow, "id" | "status" | "gradingStatus">, viewer: "student" | "interviewer" = "student") {
  if (viewer === "student" && ["completed", "reported"].includes(r.status)) return `/interviews/${r.id}/results`;
  return `/interviews/${r.id}`;
}

/** Responsive list/table of interviews: a table on desktop, stacked cards on mobile. */
export function InterviewList({ rows, viewer = "student", showScore = true, timeZone }: { rows: InterviewRow[]; viewer?: "student" | "interviewer"; showScore?: boolean; timeZone?: string }) {
  return (
    <div>
      <table className="hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-ink-200 text-left text-xs text-ink-500">
            <th scope="col" className="px-6 py-2.5 font-medium">Interview</th>
            <th scope="col" className="py-2.5 pr-4 font-medium">Date</th>
            <th scope="col" className="py-2.5 pr-4 font-medium">Mode</th>
            <th scope="col" className="py-2.5 pr-4 font-medium">Type</th>
            <th scope="col" className="py-2.5 pr-4 font-medium">{viewer === "student" ? "Interviewer" : "Status"}</th>
            {showScore && <th scope="col" className="py-2.5 pr-4 text-right font-medium">Score</th>}
            <th scope="col" className="py-2.5 pr-6"><span className="sr-only">Open</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="group border-b border-ink-100 last:border-0 hover:bg-ink-50/70">
              <td className="px-6 py-3">
                <Link href={hrefFor(r, viewer)} className="font-medium text-ink-900 group-hover:underline">{r.targetRole}</Link>
                {r.company && <p className="text-xs text-ink-500">{r.company}</p>}
              </td>
              <td className="py-3 pr-4 text-ink-600">{formatDate(r.date, timeZone)}</td>
              <td className="py-3 pr-4"><span className="inline-flex items-center gap-1.5 text-ink-700">{r.mode === "ai" ? <Bot className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}{r.mode === "ai" ? "AI" : "Human"}</span></td>
              <td className="py-3 pr-4 text-ink-700">{LABELS.type[r.type]}</td>
              <td className="py-3 pr-4 text-ink-700">
                {viewer === "student" ? (r.mode === "ai" ? "AI Interviewer" : r.interviewerName ?? <span className="text-ink-400">Matching…</span>) : <Badge tone={toneForStatus(r.status)}>{LABELS.status[r.status]}</Badge>}
              </td>
              {showScore && (
                <td className="py-3 pr-4 text-right">
                  {r.overallScore != null ? <ScorePill score={r.overallScore} /> : ["completed", "reported"].includes(r.status) ? <Badge tone={toneForStatus(r.gradingStatus)}>{LABELS.grading[r.gradingStatus]}</Badge> : <Badge tone={toneForStatus(r.status)}>{LABELS.status[r.status]}</Badge>}
                </td>
              )}
              <td className="py-3 pr-6 text-right">
                <Link href={hrefFor(r, viewer)} className="inline-flex items-center gap-1 text-xs font-medium text-olive-700 hover:underline">
                  {viewer === "student" && ["completed", "reported"].includes(r.status) ? "View feedback" : "Open"} <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="divide-y divide-ink-100 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={hrefFor(r, viewer)} className="flex items-center gap-3 px-5 py-4 hover:bg-ink-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-700">{r.mode === "ai" ? <Bot className="h-4 w-4" /> : <Users className="h-4 w-4" />}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink-900">{r.targetRole}</p>
                <p className="text-xs text-ink-500">{formatDate(r.date, timeZone)} · {r.mode === "ai" ? "AI" : "Human"} · {LABELS.type[r.type]}</p>
              </div>
              {showScore && r.overallScore != null ? <ScorePill score={r.overallScore} /> : <Badge tone={toneForStatus(r.status)}>{LABELS.status[r.status]}</Badge>}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
