import { db } from "@/lib/db";
import { parseJsonArray } from "@/lib/json";
import type { InterviewType } from "@/lib/constants";
import { gradeInterview, type QAPair } from "@/lib/ai/grading";
import { notify } from "./notifications";
import { track } from "./analytics";
import { rewardCandidate, rewardInterviewer } from "./gamification";
import { recommendNext } from "./performance";

/**
 * The grading pipeline (spec §25):
 *   interview → transcript → question/answer pairs → type/role/JD/rubric
 *   → AI evaluation → category + overall scores → strengths/weaknesses → recommendations
 *
 * Every interview, AI or human, goes through here. Human interviewers can add
 * qualitative feedback, but only this pipeline writes the official score.
 */
export async function runGrading(interviewId: string) {
  // Claim the job atomically so concurrent triggers don't grade twice.
  const claimed = await db.interview.updateMany({
    where: {
      id: interviewId,
      status: { in: ["completed", "reported"] },
      OR: [
        { gradingStatus: { in: ["pending", "failed"] } },
        // Recover a job that died mid-flight (e.g. server restart).
        { gradingStatus: "processing", updatedAt: { lt: new Date(Date.now() - 10 * 60_000) } },
      ],
    },
    data: { gradingStatus: "processing", gradingError: null },
  });
  if (claimed.count !== 1) return;

  const iv = await db.interview.findUniqueOrThrow({
    where: { id: interviewId },
    include: {
      questions: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
      answers: { orderBy: { createdAt: "asc" } },
      jobDescription: { select: { content: true } },
      feedback: true,
      notes: { orderBy: { createdAt: "asc" } },
    },
  });

  const asked = iv.questions.filter((q) => q.askedAt);
  const qa: QAPair[] = asked.map((q) => {
    const root = q.parentQuestionId ? iv.questions.find((x) => x.id === q.parentQuestionId) : null;
    return {
      questionId: q.id,
      question: q.text,
      category: root?.category ?? q.category,
      whatItTests: q.whatItTests,
      gradingCriteria: parseJsonArray(q.gradingCriteria),
      keywords: parseJsonArray(q.keywords),
      isFollowUp: q.isFollowUp,
      answer: iv.answers
        .filter((a) => a.questionId === q.id)
        .map((a) => a.text)
        .join(" ")
        .trim(),
    };
  });

  if (!qa.some((p) => p.answer)) {
    await db.interview.update({
      where: { id: interviewId },
      data: {
        gradingStatus: "failed",
        gradingError:
          "No answers were captured in the transcript, so this interview couldn't be scored. This isn't counted against you. If speech capture didn't work, try typing your answers next time.",
      },
    });
    await track("grading_failed", iv.studentId, { reason: "no_answers" });
    return;
  }

  try {
    const result = await gradeInterview({
      type: iv.type as InterviewType,
      mode: iv.mode as "ai" | "human",
      targetRole: iv.targetRole,
      roleCategory: iv.roleCategory,
      company: iv.company,
      jobDescription: iv.jobDescription?.content,
      difficulty: iv.difficulty,
      qa,
      interviewerFeedback: iv.feedback,
      interviewerNotes: iv.notes.map((n) => n.text),
    });
    const rec = await recommendNext(iv.studentId, { id: iv.id, type: iv.type, mode: iv.mode, scores: result.scores, overall: result.overallScore });
    const data = {
      engine: result.engine,
      model: result.model,
      overallScore: result.overallScore,
      communication: result.scores.communication ?? null,
      confidence: result.scores.confidence ?? null,
      answerStructure: result.scores.answerStructure ?? null,
      technicalKnowledge: result.scores.technicalKnowledge ?? null,
      problemSolving: result.scores.problemSolving ?? null,
      roleKnowledge: result.scores.roleKnowledge ?? null,
      professionalism: result.scores.professionalism ?? null,
      behavioral: result.scores.behavioral ?? null,
      summary: result.summary,
      strengths: JSON.stringify(result.strengths),
      improvements: JSON.stringify(result.improvements),
      questionFeedback: JSON.stringify(result.questionFeedback),
      recommendation: JSON.stringify(rec),
      interviewerFeedbackSummary: result.interviewerFeedbackSummary,
    };
    await db.aiEvaluation.upsert({ where: { interviewId }, create: { interviewId, ...data }, update: data });
    await db.interview.update({ where: { id: interviewId }, data: { gradingStatus: "completed", overallScore: result.overallScore } });
    await track("grading_completed", iv.studentId, { engine: result.engine, mode: iv.mode, type: iv.type });
    await notify(iv.studentId, "feedback_ready", "Your interview feedback is ready", `You scored ${result.overallScore}/100 on your ${iv.targetRole} interview. See what went well and what to practice next.`, `/interviews/${iv.id}/results`);
    if (iv.status === "completed") {
      await rewardCandidate(iv.id);
      if (iv.mode === "human") await rewardInterviewer(iv.id);
    }
  } catch (err) {
    console.error("[grading] failed", err);
    await db.interview.update({
      where: { id: interviewId },
      data: { gradingStatus: "failed", gradingError: "The AI grading service didn't respond. Your transcript is saved. Retry grading in a moment." },
    });
    await track("grading_failed", iv.studentId, { reason: "ai_error" });
  }
}

/**
 * Human interviews wait for the interviewer's optional feedback before grading
 * (so the AI can incorporate it). If the interviewer hasn't submitted within
 * 15 minutes, grade anyway.
 */
export async function gradeIfFeedbackWindowPassed(interviewId: string) {
  const iv = await db.interview.findUnique({ where: { id: interviewId }, include: { feedback: { select: { id: true } } } });
  if (!iv || iv.gradingStatus !== "pending" || !["completed", "reported"].includes(iv.status)) return false;
  const waited = iv.completedAt ? Date.now() - iv.completedAt.getTime() : Infinity;
  if (iv.mode === "ai" || iv.feedback || waited > 15 * 60_000) {
    await runGrading(interviewId);
    return true;
  }
  return false;
}
