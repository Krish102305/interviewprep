import { CheckCircle2 } from "lucide-react";
import { parseJsonArray } from "@/lib/json";
import { Badge } from "@/components/ui/badge";

type Q = { id: string; order: number; category: string; text: string; whatItTests: string; followUps: string; gradingCriteria: string; competencies: string; askedAt: Date | null };

/** Read-only interview guide for interviewer prep (never rendered for candidates). */
export function GuideList({ questions }: { questions: Q[] }) {
  return (
    <ol className="space-y-4">
      {questions.map((q, i) => (
        <li key={q.id} className="rounded-xl border border-ink-200 bg-white p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-500">Question {i + 1}</p>
            <div className="flex items-center gap-1.5">
              <Badge tone="olive">{q.category.replace("_", " ")}</Badge>
              {q.askedAt && <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>Asked</Badge>}
            </div>
          </div>
          <p className="mt-2 font-medium leading-relaxed text-ink-900">{q.text}</p>
          <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-medium text-ink-500">What this tests</dt>
              <dd className="mt-0.5 text-ink-700">{q.whatItTests}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-ink-500">Suggested follow-up</dt>
              <dd className="mt-0.5 text-ink-700">{parseJsonArray(q.followUps)[0] ? `“${parseJsonArray(q.followUps)[0]}”` : "N/A"}</dd>
            </div>
          </dl>
          {parseJsonArray(q.gradingCriteria).length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-xs font-medium text-olive-700">What a strong answer includes</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-600">{parseJsonArray(q.gradingCriteria).map((c) => <li key={c}>{c}</li>)}</ul>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}
