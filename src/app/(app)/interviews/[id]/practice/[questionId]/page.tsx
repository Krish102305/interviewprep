import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { LABELS } from "@/lib/constants";
import { loadRetryContext, serializeRetry } from "@/lib/services/retry";
import { QuestionPractice } from "@/components/results/question-practice";

export const metadata: Metadata = { title: "Practice a question" };

export default async function PracticeQuestionPage({ params }: { params: Promise<{ id: string; questionId: string }> }) {
  const user = await requirePageUser({ roles: ["student"] });
  const { id, questionId } = await params;
  let ctx: Awaited<ReturnType<typeof loadRetryContext>>;
  try {
    ctx = await loadRetryContext(id, questionId, user);
  } catch (err) {
    if (err instanceof AppError && err.status === 400) redirect(`/interviews/${id}/results`);
    notFound();
  }

  return (
    <div className="mx-auto max-w-5xl">
      <Link href={`/interviews/${id}/results#questions`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Back to results
      </Link>
      <div className="mb-8 mt-4">
        <p className="eyebrow">Practice this question again · {LABELS.type[ctx.iv.type]}</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink-950">{ctx.iv.targetRole}{ctx.iv.company ? <span className="text-ink-400"> · {ctx.iv.company}</span> : null}</h1>
        <p className="mt-1 text-sm text-ink-500">Answer the same question again. We&apos;ll grade it on the same scale and show you exactly what changed.</p>
      </div>
      <QuestionPractice
        interviewId={id}
        question={{ id: ctx.question.id, text: ctx.question.text, isFollowUp: ctx.question.isFollowUp }}
        original={{ answer: ctx.originalAnswer, score: ctx.original?.score ?? null, feedback: ctx.original?.feedback ?? null, star: ctx.original?.star ?? null }}
        attempts={ctx.attempts.map(serializeRetry)}
      />
    </div>
  );
}
