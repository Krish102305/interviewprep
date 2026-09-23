import "server-only";
import { db } from "@/lib/db";
import { badRequest, notFound, tooMany } from "@/lib/errors";
import { parseJsonArray } from "@/lib/json";
import { gradeRetry, type QuestionFeedback } from "@/lib/ai/grading";
import type { InterviewType } from "@/lib/constants";
import type { SessionUser } from "@/lib/auth/session";
import { track } from "./analytics";

/** Retries grade with AI, so cap them per account per day to keep costs predictable. */
export const RETRIES_PER_DAY = Number(process.env.RETRIES_PER_DAY) || 20;

/**
 * Everything needed to practice one question again. Only the candidate who took
 * the interview can retry it, and only once it has been graded.
 */
export async function loadRetryContext(interviewId: string, questionId: string, user: Pick<SessionUser, "id">) {
  const iv = await db.interview.findUnique({
    where: { id: interviewId },
    include: { evaluation: true, questions: { where: { id: questionId } } },
  });
  if (!iv || iv.studentId !== user.id) throw notFound("Interview not found.");
  if (iv.gradingStatus !== "completed" || !iv.evaluation) throw badRequest("You can practice questions again once this interview has been graded.");
  const q = iv.questions[0];
  if (!q || !q.askedAt) throw notFound("Question not found.");

  const root = q.parentQuestionId ? await db.interviewQuestion.findUnique({ where: { id: q.parentQuestionId } }) : null;
  const answers = await db.interviewAnswer.findMany({ where: { interviewId, questionId }, orderBy: { createdAt: "asc" } });
  const original = parseJsonArray<QuestionFeedback>(iv.evaluation.questionFeedback).find((f) => f.questionId === questionId) ?? null;
  const attempts = await db.questionRetry.findMany({ where: { interviewId, questionId, userId: user.id }, orderBy: { createdAt: "desc" } });

  return {
    iv,
    question: {
      id: q.id,
      text: q.text,
      category: root?.category ?? q.category,
      whatItTests: q.whatItTests,
      gradingCriteria: parseJsonArray<string>(q.gradingCriteria),
      keywords: parseJsonArray<string>(q.keywords),
      isFollowUp: q.isFollowUp,
    },
    originalAnswer: answers.map((a) => a.text).join(" ").trim(),
    original,
    attempts,
  };
}

export async function submitRetry(
  interviewId: string,
  questionId: string,
  user: Pick<SessionUser, "id">,
  input: { text: string; source: "speech" | "typed"; durationSec?: number },
) {
  const since = new Date(Date.now() - 24 * 3600_000);
  const today = await db.questionRetry.count({ where: { userId: user.id, createdAt: { gte: since } } });
  if (today >= RETRIES_PER_DAY) throw tooMany(`You've reached today's limit of ${RETRIES_PER_DAY} practice attempts. Come back tomorrow.`);

  const ctx = await loadRetryContext(interviewId, questionId, user);
  const result = await gradeRetry({
    type: ctx.iv.type as InterviewType,
    targetRole: ctx.iv.targetRole,
    roleCategory: ctx.iv.roleCategory,
    company: ctx.iv.company,
    difficulty: ctx.iv.difficulty,
    qa: { questionId, question: ctx.question.text, category: ctx.question.category, whatItTests: ctx.question.whatItTests, gradingCriteria: ctx.question.gradingCriteria, keywords: ctx.question.keywords, isFollowUp: ctx.question.isFollowUp, answer: input.text },
    originalAnswer: ctx.originalAnswer,
    originalScore: ctx.original?.score ?? null,
    originalFeedback: ctx.original?.feedback ?? null,
  });

  const retry = await db.questionRetry.create({
    data: {
      userId: user.id,
      interviewId,
      questionId,
      answer: input.text,
      source: input.source,
      durationSec: input.durationSec,
      score: result.score,
      originalScore: ctx.original?.score ?? null,
      feedback: result.feedback,
      improved: JSON.stringify(result.improved),
      nextSteps: JSON.stringify(result.nextSteps),
      star: result.star ? JSON.stringify(result.star) : null,
      engine: result.engine,
    },
  });
  await track("question_retried", user.id, { engine: result.engine, delta: ctx.original ? result.score - ctx.original.score : null });
  return serializeRetry(retry);
}

export function serializeRetry(r: { id: string; answer: string; score: number; originalScore: number | null; feedback: string; improved: string; nextSteps: string; star: string | null; engine: string; createdAt: Date }) {
  return {
    id: r.id,
    answer: r.answer,
    score: r.score,
    originalScore: r.originalScore,
    feedback: r.feedback,
    improved: parseJsonArray<string>(r.improved),
    nextSteps: parseJsonArray<string>(r.nextSteps),
    star: r.star ? (JSON.parse(r.star) as { situation: boolean; task: boolean; action: boolean; result: boolean }) : null,
    engine: r.engine as "ai" | "fallback",
    createdAt: r.createdAt.toISOString(),
  };
}
export type RetryView = ReturnType<typeof serializeRetry>;
