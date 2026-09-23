import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { LABELS } from "@/lib/constants";
import { interviewRows } from "@/lib/services/queries";
import { ButtonLink } from "@/components/ui/button";
import { Card, PageHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { InterviewList } from "@/components/interviews/interview-list";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Interview history" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "upcoming", label: "Upcoming" },
  { key: "ai", label: "AI" },
  { key: "human", label: "Human" },
  { key: "behavioral", label: "Behavioral" },
  { key: "technical", label: "Technical" },
  { key: "full", label: "Full" },
];

export default async function InterviewsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requirePageUser({ roles: ["student", "interviewer"] });
  const filter = (await searchParams).filter ?? "all";
  const isStudent = user.role === "student";
  const base = isStudent ? { studentId: user.id } : { interviewerId: user.id };
  const where = {
    ...base,
    ...(filter === "upcoming" ? { status: { in: ["scheduled", "waiting", "active"] } } : {}),
    ...(filter === "ai" || filter === "human" ? { mode: filter } : {}),
    ...(["behavioral", "technical", "full"].includes(filter) ? { type: filter } : {}),
  };
  const rows = await interviewRows(where, 100, filter === "upcoming" ? "upcoming" : "recent");
  return (
    <div>
      <PageHeader
        eyebrow={isStudent ? "Interview history" : "My interviews"}
        title={isStudent ? "Every interview, every score" : "Interviews you've conducted"}
        description={isStudent ? "Review feedback, transcripts and AI evaluations from past interviews." : "Upcoming and completed interviews you've been matched with."}
        action={isStudent ? <ButtonLink href="/interviews/new"><Plus className="h-4 w-4" /> Start an interview</ButtonLink> : undefined}
      />
      <nav aria-label="Filter interviews" className="mb-4 flex flex-wrap gap-1.5">
        {FILTERS.filter((f) => isStudent || !["ai", "human"].includes(f.key)).map((f) => (
          <Link key={f.key} href={`/interviews?filter=${f.key}`} aria-current={filter === f.key ? "page" : undefined} className={cn("rounded-full px-3 py-1 text-sm", filter === f.key ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100")}>{f.label}</Link>
        ))}
      </nav>
      <Card>
        {rows.length ? (
          isStudent ? <InterviewList rows={rows} timeZone={user.profile?.timezone} /> : <InterviewList rows={rows.map((r) => ({ ...r, interviewerName: r.studentName ?? null }))} viewer="interviewer" showScore={false} timeZone={user.profile?.timezone} />
        ) : (
          <div className="p-6">
            <EmptyState title={filter === "all" ? "No interviews yet" : `No ${LABELS.type[filter]?.toLowerCase() ?? filter} interviews`} description={isStudent ? "Start your first interview (AI or human) to see it here." : "Accept a request or open availability to get matched."} action={isStudent ? <ButtonLink href="/interviews/new" size="sm">Find an Interview</ButtonLink> : <ButtonLink href="/interviewer/availability" size="sm">Set availability</ButtonLink>} />
          </div>
        )}
      </Card>
    </div>
  );
}
