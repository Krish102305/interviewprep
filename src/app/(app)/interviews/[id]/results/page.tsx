import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowRight, Bot, CheckCircle2, Info, Lightbulb, MessageSquareQuote, RotateCcw, Sparkles, Target, TrendingUp, Trophy, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { CATEGORIES_BY_TYPE, LABELS, SCORE_CATEGORIES, type InterviewType } from "@/lib/constants";
import { formatDate, shortName } from "@/lib/format";
import { parseJsonArray } from "@/lib/json";
import { loadForUser } from "@/lib/services/interviews";
import { parseRecommendation } from "@/lib/services/performance";
import type { QuestionFeedback } from "@/lib/ai/grading";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Alert, Spinner } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { ScoreBar, ScorePill, ScoreRing } from "@/components/ui/score";
import { AutoRefresh } from "@/components/interviews/auto-refresh";
import { RatingForm } from "@/components/results/rating-form";
import { RegradeButton } from "@/components/results/regrade-button";
import { TranscriptView } from "@/components/room/transcript-view";
import { aiInterviewerLabel, personaFor } from "@/lib/ai/personas";

export const metadata: Metadata = { title: "Interview results" };

const EVAL_KEY: Record<string, "communication" | "confidence" | "answerStructure" | "technicalKnowledge" | "problemSolving" | "roleKnowledge" | "professionalism" | "behavioral"> = {
  communication: "communication", confidence: "confidence", answerStructure: "answerStructure", technicalKnowledge: "technicalKnowledge",
  problemSolving: "problemSolving", roleKnowledge: "roleKnowledge", professionalism: "professionalism", behavioral: "behavioral",
};

export default async function ResultsPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser({ allowRestricted: true });
  const { id } = await params;
  const ctx = await loadForUser(id, user).catch(() => null);
  if (!ctx) notFound();
  if (ctx.role === "interviewer") redirect(`/interviews/${id}/wrap-up`);
  const iv = await db.interview.findUniqueOrThrow({
    where: { id },
    include: {
      evaluation: true,
      interviewer: { select: { profile: true } },
      rating: { select: { id: true } },
      transcript: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!["completed", "reported"].includes(iv.status)) redirect(`/interviews/${id}`);
  const pointsEarned = await db.pointsEntry.aggregate({ where: { interviewId: id, userId: iv.studentId }, _sum: { amount: true } });
  const ev = iv.evaluation;
  const interviewerName = iv.mode === "ai" ? `${personaFor(iv.roleCategory).name} (AI Interviewer)` : shortName(iv.interviewer?.profile);
  const header = (
    <div className="mb-8">
      <p className="eyebrow">{LABELS.mode[iv.mode]} · {LABELS.type[iv.type]} · {formatDate(iv.completedAt, user.profile?.timezone)}</p>
      <h1 className="mt-2 text-3xl font-semibold text-ink-950">{iv.targetRole}{iv.company ? <span className="text-ink-400"> · {iv.company}</span> : null}</h1>
      <p className="mt-1 text-sm text-ink-500">Interviewer: {interviewerName}</p>
    </div>
  );

  if (!ev || iv.gradingStatus !== "completed") {
    const waitingForInterviewer = iv.mode === "human" && iv.gradingStatus === "pending";
    return (
      <div className="mx-auto max-w-3xl">
        {header}
        {iv.gradingStatus === "failed" ? (
          <Alert tone={iv.gradingError?.startsWith("No answers") ? "warning" : "danger"} title="We couldn't grade this interview" action={iv.gradingError?.startsWith("No answers") ? null : <RegradeButton id={iv.id} />}>
            {iv.gradingError ?? "Something went wrong while grading."}
          </Alert>
        ) : (
          <>
            <AutoRefresh every={4000} ping={`/api/interviews/${iv.id}/grade`} />
            <Card>
              <CardBody className="flex flex-col items-center py-16 text-center">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-olive-50 text-olive-700"><Sparkles className="h-7 w-7" /></span>
                <h2 className="mt-6 text-xl font-semibold">Your feedback is being generated…</h2>
                <p className="mt-2 max-w-md text-sm text-ink-500">
                  {waitingForInterviewer
                    ? "We're giving your interviewer a few minutes to add optional notes so the AI can include them. Grading starts automatically within 15 minutes."
                    : "The AI is evaluating your transcript against a standardized rubric for this role."}
                </p>
                <Spinner className="mt-6 text-olive-600" />
              </CardBody>
            </Card>
          </>
        )}
        {iv.transcript.length > 0 && (
          <Card className="mt-6">
            <CardHeader title="Transcript" />
            <CardBody><TranscriptView entries={iv.transcript} interviewerName={iv.mode === "ai" ? aiInterviewerLabel(iv.roleCategory) : interviewerName} candidateName="You" /></CardBody>
          </Card>
        )}
      </div>
    );
  }

  const applicable = CATEGORIES_BY_TYPE[iv.type as InterviewType];
  const cats = SCORE_CATEGORIES.filter((c) => applicable.includes(c.key)).map((c) => ({ ...c, value: ev[EVAL_KEY[c.key]] as number | null }));
  const strengths = parseJsonArray<string>(ev.strengths);
  const improvements = parseJsonArray<string>(ev.improvements);
  const qf = parseJsonArray<QuestionFeedback>(ev.questionFeedback);
  const rec = parseRecommendation(ev.recommendation);
  const prior = await db.interview.findFirst({
    where: { studentId: iv.studentId, gradingStatus: "completed", completedAt: { lt: iv.completedAt ?? new Date() }, id: { not: iv.id } },
    orderBy: { completedAt: "desc" },
    select: { overallScore: true },
  });
  const delta = prior?.overallScore != null ? ev.overallScore - prior.overallScore : null;
  // "Practice this question again" (candidate only): best retry per question + the weakest answer to start with.
  const canPractice = ctx.role === "candidate";
  const bestRetry = new Map(
    canPractice
      ? (await db.questionRetry.groupBy({ by: ["questionId"], where: { interviewId: iv.id, userId: user.id }, _max: { score: true } })).map((r) => [r.questionId, r._max.score])
      : [],
  );
  const weakest = qf.length ? qf.reduce((w, q) => (q.score < w.score ? q : w)) : null;

  return (
    <div className="mx-auto max-w-5xl">
      {header}
      <Card className="overflow-hidden">
        <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-3 text-center">
            <p className="eyebrow">Your interview results</p>
            <ScoreRing score={ev.overallScore} size={156} />
            <p className="text-sm font-medium text-ink-700">Overall Score</p>
            {delta != null && (
              <Badge tone={delta >= 0 ? "success" : "warning"} icon={<TrendingUp className="h-3 w-3" />}>{delta >= 0 ? "+" : ""}{delta} vs. previous interview</Badge>
            )}
          </div>
          <div className="grid content-center gap-x-8 gap-y-4 sm:grid-cols-2">
            {cats.map((c) => <ScoreBar key={c.key} label={c.label} score={c.value} />)}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 bg-ink-50/60 px-6 py-3 text-xs text-ink-500 sm:px-8">
          <span className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            {ev.engine === "ai" ? "Standardized AI evaluation of your transcript. The official score is always AI-graded and never set by a person." : "Development grading: no AI key is configured on this server, so this score comes from Interview Connect's transparent rule-based rubric over your transcript."}
          </span>
          {(pointsEarned._sum.amount ?? 0) > 0 && <span className="flex items-center gap-1.5 font-medium text-olive-700"><Trophy className="h-3.5 w-3.5" /> +{pointsEarned._sum.amount} points earned</span>}
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-olive-600" /> What you did well</span>} />
          <CardBody>
            {strengths.length ? <ul className="space-y-3 text-sm leading-relaxed text-ink-700">{strengths.map((s) => <li key={s} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-olive-500" />{s}</li>)}</ul> : <p className="text-sm text-ink-500">No standout strengths were identified this time.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Target className="h-4 w-4 text-amber-600" /> Areas to improve</span>} />
          <CardBody>
            {improvements.length ? <ul className="space-y-3 text-sm leading-relaxed text-ink-700">{improvements.map((s) => <li key={s} className="flex gap-2"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{s}</li>)}</ul> : <p className="text-sm text-ink-500">Nothing major, keep practicing at a higher difficulty.</p>}
            {canPractice && weakest && weakest.score < 85 && (
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50/70 px-4 py-3">
                <p className="text-sm text-ink-700">Your weakest answer scored <strong>{weakest.score}</strong>. Try it again and see the difference.</p>
                <ButtonLink href={`/interviews/${iv.id}/practice/${weakest.questionId}`} size="sm"><RotateCcw className="h-3.5 w-3.5" /> Practice it again</ButtonLink>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title={<span className="flex items-center gap-2"><Bot className="h-4 w-4" /> AI interview summary</span>} />
          <CardBody className="space-y-4">
            <p className="text-sm leading-relaxed text-ink-700">{ev.summary}</p>
            {ev.interviewerFeedbackSummary && (
              <div className="rounded-xl border border-ink-200 bg-ink-50 p-4">
                <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500"><Users className="h-3.5 w-3.5" /> From your interviewer</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-700">{ev.interviewerFeedbackSummary}</p>
                <p className="mt-2 text-[11px] text-ink-400">Interviewer notes inform the report but don&apos;t set your score.</p>
              </div>
            )}
          </CardBody>
        </Card>
        {rec && (
          <Card className="border-olive-200 bg-olive-50/60">
            <CardBody>
              <p className="eyebrow flex items-center gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Recommended next practice</p>
              <p className="mt-3 font-semibold text-ink-900">{rec.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{rec.detail}</p>
              <ButtonLink href={`/interviews/new?mode=${rec.mode}&type=${rec.type}`} size="sm" className="mt-4">Start {rec.mode === "ai" ? "AI" : "human"} {LABELS.type[rec.type].toLowerCase()} <ArrowRight className="h-3.5 w-3.5" /></ButtonLink>
            </CardBody>
          </Card>
        )}
      </div>

      <Card className="mt-6 scroll-mt-6" id="questions">
        <CardHeader title="Question-by-question feedback" description={canPractice ? "Scores and feedback grounded in what you actually said. Practice any question again to improve it." : "Scores and feedback grounded in what you actually said."} />
        <CardBody>
          <ol className="space-y-4">
            {qf.map((q, i) => (
              <li key={q.questionId} className="rounded-xl border border-ink-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-medium text-ink-900"><span className="mr-2 text-ink-400">{i + 1}.</span>{q.question}</p>
                  <ScorePill score={q.score} />
                </div>
                {q.answerExcerpt && (
                  <blockquote className="mt-3 flex gap-2 border-l-2 border-ink-200 pl-3 text-sm italic text-ink-500"><MessageSquareQuote className="mt-0.5 h-4 w-4 shrink-0 not-italic" />{q.answerExcerpt}</blockquote>
                )}
                <p className="mt-3 text-sm text-ink-700">{q.feedback}</p>
                {q.star && (
                  <div className="mt-3 flex flex-wrap gap-1.5" aria-label="STAR components">
                    {(["situation", "task", "action", "result"] as const).map((k) => (
                      <Badge key={k} tone={q.star![k] ? "success" : "warning"}>{q.star![k] ? "✓" : "✗"} {k[0].toUpperCase() + k.slice(1)}</Badge>
                    ))}
                  </div>
                )}
                {canPractice && (
                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-100 pt-3">
                    <ButtonLink href={`/interviews/${iv.id}/practice/${q.questionId}`} variant="secondary" size="sm"><RotateCcw className="h-3.5 w-3.5" /> {bestRetry.has(q.questionId) ? "Practice again" : "Practice this question again"}</ButtonLink>
                    {bestRetry.get(q.questionId) != null && (
                      <span className="flex items-center gap-1.5 text-xs text-ink-500">
                        Best retry <ScorePill score={bestRetry.get(q.questionId)} />
                        {bestRetry.get(q.questionId)! > q.score && <span className="font-medium text-emerald-700">+{bestRetry.get(q.questionId)! - q.score}</span>}
                      </span>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      {iv.mode === "human" && iv.interviewerId && ctx.role === "candidate" && (
        <Card className="mt-6">
          <CardHeader title="Rate your interviewer" />
          <CardBody>{iv.rating ? <p className="text-sm text-ink-500">Thanks for rating this interview.</p> : <RatingForm interviewId={iv.id} interviewerName={interviewerName} />}</CardBody>
        </Card>
      )}

      <details className="group mt-6 rounded-2xl border border-ink-200 bg-white shadow-card">
        <summary className="cursor-pointer list-none px-6 py-4 text-[15px] font-semibold text-ink-900">Full transcript <span className="ml-1 text-sm font-normal text-ink-500">({iv.transcript.length} entries)</span></summary>
        <div className="border-t border-ink-100 px-6 py-5">
          <TranscriptView entries={iv.transcript} interviewerName={iv.mode === "ai" ? aiInterviewerLabel(iv.roleCategory) : interviewerName} candidateName="You" />
        </div>
      </details>
    </div>
  );
}
