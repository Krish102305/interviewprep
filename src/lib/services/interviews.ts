import { db } from "@/lib/db";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { parseJsonArray } from "@/lib/json";
import { inferRoleCategory, type Difficulty, type InterviewType, type RoleCategory } from "@/lib/constants";
import { generateQuestionPlan } from "@/lib/ai/questions";
import type { SessionUser } from "@/lib/auth/session";
import type { createInterviewSchema } from "@/lib/validation";
import type { z } from "zod";
import { bookSlot, matchNow } from "./matching";
import { notify } from "./notifications";
import { track } from "./analytics";

export type ParticipantRole = "candidate" | "interviewer" | "admin";

/** Load an interview the user is allowed to see, and their role in it. */
export async function loadForUser(interviewId: string, user: Pick<SessionUser, "id" | "role">) {
  const iv = await db.interview.findUnique({ where: { id: interviewId } });
  if (!iv) throw notFound("Interview not found.");
  let role: ParticipantRole;
  if (iv.studentId === user.id) role = "candidate";
  else if (iv.interviewerId && iv.interviewerId === user.id) role = "interviewer";
  else if (user.role === "admin") role = "admin";
  else throw notFound("Interview not found."); // don't reveal existence
  return { iv, role };
}

export async function createInterview(user: SessionUser, input: z.infer<typeof createInterviewSchema>) {
  if (user.role !== "student") throw forbidden("Only student accounts can create practice interviews.");
  const student = await db.studentProfile.findUnique({ where: { userId: user.id } });

  let resumeId: string | null = null;
  if (input.resumeId) {
    const resume = await db.resume.findFirst({ where: { id: input.resumeId, userId: user.id } });
    if (!resume) throw badRequest("Resume not found.");
    resumeId = resume.id;
  }

  const roleCategory = inferRoleCategory(input.targetRole, student?.targetIndustry);
  const isAiNow = input.mode === "ai" && input.timing === "now";
  const scheduledAt = input.mode === "ai" && input.timing === "schedule" && input.scheduledAt ? new Date(input.scheduledAt) : null;
  if (scheduledAt && scheduledAt < new Date(Date.now() - 60_000)) throw badRequest("Pick a time in the future.");

  const interview = await db.$transaction(async (tx) => {
    const jd = input.jobDescription.trim()
      ? await tx.jobDescription.create({
          data: { userId: user.id, title: input.targetRole, company: input.company || null, content: input.jobDescription.trim() },
        })
      : null;
    const iv = await tx.interview.create({
      data: {
        studentId: user.id,
        mode: input.mode,
        type: input.type,
        targetRole: input.targetRole,
        roleCategory,
        company: input.company || null,
        jobDescriptionId: jd?.id ?? null,
        resumeId,
        difficulty: input.difficulty,
        duration: input.duration,
        interviewerPreference: input.mode === "human" ? input.interviewerPreference : "anyone",
        status: isAiNow ? "waiting" : "scheduled",
        scheduledAt: isAiNow ? new Date() : scheduledAt,
        questionStatus: "generating",
      },
    });
    if (input.mode === "human" && input.timing === "schedule" && input.availabilityId) {
      await bookSlot(tx, input.availabilityId, iv.id, user.id, input.duration);
    }
    return tx.interview.findUniqueOrThrow({ where: { id: iv.id } });
  });

  await track("interview_created", user.id, { mode: input.mode, type: input.type, timing: input.timing });
  if (interview.interviewerId) {
    await track("interview_booked", user.id, { mode: "human" });
    await notify(user.id, "interview_scheduled", "Interview scheduled", `Your ${interview.targetRole} interview is booked.`, `/interviews/${interview.id}`);
    await notify(
      interview.interviewerId,
      "interview_scheduled",
      "New interview booked",
      `A candidate booked your slot for a ${interview.targetRole} ${interview.type} interview. Your AI interview guide is being prepared.`,
      `/interviews/${interview.id}`,
    );
  } else if (input.mode === "human") {
    await matchNow(interview.id);
  } else if (scheduledAt) {
    await notify(user.id, "interview_scheduled", "AI interview scheduled", `Your AI ${interview.type} interview is scheduled.`, `/interviews/${interview.id}`);
  }
  return interview;
}

/** Generate and store the question plan (runs after the response via `after()`). */
export async function generateQuestionsFor(interviewId: string) {
  const iv = await db.interview.findUnique({
    where: { id: interviewId },
    include: {
      resume: { select: { parsedText: true } },
      jobDescription: { select: { content: true } },
      student: { select: { studentProfile: true } },
      questions: { select: { id: true }, take: 1 },
    },
  });
  if (!iv) return;
  if (iv.questions.length) {
    await db.interview.update({ where: { id: interviewId }, data: { questionStatus: "ready" } });
    return;
  }
  try {
    const sp = iv.student.studentProfile;
    const plan = await generateQuestionPlan({
      mode: iv.mode as "ai" | "human",
      type: iv.type as InterviewType,
      targetRole: iv.targetRole,
      roleCategory: iv.roleCategory as RoleCategory,
      company: iv.company,
      jobDescription: iv.jobDescription?.content,
      resumeText: iv.resume?.parsedText,
      difficulty: iv.difficulty as Difficulty,
      duration: iv.duration,
      experienceLevel: sp?.experienceLevel,
      school: sp?.school,
      major: sp?.major,
      targetIndustry: sp?.targetIndustry,
    });
    await db.$transaction([
      db.interviewQuestion.createMany({
        data: plan.questions.map((q, i) => ({
          interviewId,
          order: i,
          category: q.category,
          text: q.text,
          difficulty: q.difficulty,
          whatItTests: q.whatItTests,
          competencies: JSON.stringify(q.competencies),
          followUps: JSON.stringify(q.followUps),
          gradingCriteria: JSON.stringify(q.gradingCriteria),
          keywords: JSON.stringify(q.keywords),
        })),
      }),
      db.interview.update({ where: { id: interviewId }, data: { questionStatus: "ready", questionEngine: plan.engine } }),
    ]);
    if (iv.mode === "human" && iv.interviewerId)
      await notify(iv.interviewerId, "interview_scheduled", "Interview guide ready", `Your AI-generated guide for the ${iv.targetRole} interview is ready to review.`, `/interviews/${iv.id}`);
  } catch (err) {
    console.error("[interviews] question generation failed", err);
    await db.interview.update({ where: { id: interviewId }, data: { questionStatus: "failed" } });
  }
}

export async function cancelInterview(interviewId: string, user: SessionUser, reason: string) {
  const { iv, role } = await loadForUser(interviewId, user);
  if (!["scheduled", "waiting"].includes(iv.status)) throw conflict("Only upcoming interviews can be cancelled.");
  if (role === "interviewer") {
    // Interviewer backs out → return the interview to matching, don't cancel the student's practice.
    await db.$transaction([
      db.interview.update({ where: { id: iv.id }, data: { interviewerId: null, matchStatus: "unmatched", status: "scheduled" } }),
      db.availability.updateMany({ where: { interviewId: iv.id }, data: { interviewId: null } }),
      db.match.updateMany({ where: { interviewId: iv.id, interviewerId: user.id }, data: { status: "cancelled" } }),
    ]);
    await notify(iv.studentId, "interview_cancelled", "Your interviewer had to cancel", "We're finding you a new interviewer now.", `/interviews/${iv.id}`);
    await matchNow(iv.id);
    return;
  }
  await db.$transaction([
    db.interview.update({ where: { id: iv.id }, data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason || "Cancelled" } }),
    db.availability.updateMany({ where: { interviewId: iv.id }, data: { interviewId: null } }),
    db.match.updateMany({ where: { interviewId: iv.id, status: "pending" }, data: { status: "cancelled" } }),
  ]);
  await track("interview_cancelled", user.id, { by: role });
  if (iv.interviewerId)
    await notify(iv.interviewerId, "interview_cancelled", "Interview cancelled", `The ${iv.targetRole} interview was cancelled by the candidate.`, "/interviewer");
}

/**
 * Lazy maintenance: no-shows and abandoned sessions. Called from dashboards.
 * No-shows are recorded (never as strikes); abandoned AI interviews with
 * answers are completed and graded so the student's work isn't lost.
 */
export async function sweepStaleInterviews() {
  const now = Date.now();
  const lateHuman = await db.interview.findMany({
    where: { mode: "human", status: { in: ["scheduled", "waiting"] }, interviewerId: { not: null }, scheduledAt: { lt: new Date(now - 20 * 60_000) } },
    include: { sessions: true },
  });
  for (const iv of lateHuman) {
    const joined = new Set(iv.sessions.filter((s) => s.joinedAt || s.ready).map((s) => s.userId));
    const noShows = [iv.studentId, iv.interviewerId!].filter((id) => !joined.has(id));
    if (!noShows.length) continue; // both showed up (e.g. still waiting on the guide) — not a no-show
    await db.interview.update({ where: { id: iv.id }, data: { status: "no_show", noShowUserIds: JSON.stringify(noShows) } });
    await track("interview_no_show", null, { count: noShows.length });
    for (const uid of [iv.studentId, iv.interviewerId!]) {
      const missed = noShows.includes(uid);
      await notify(
        uid,
        "interview_cancelled",
        missed ? "Missed interview recorded" : "Your interview partner didn't show",
        missed
          ? "You didn't join a scheduled interview. No-shows are tracked separately from conduct strikes, but repeated no-shows may be reviewed."
          : "Sorry about that — it wasn't counted against you. Schedule another interview any time.",
        `/interviews/${iv.id}`,
      );
    }
  }

  const abandoned = await db.interview.findMany({
    where: { mode: "ai", status: "active", sessions: { every: { lastSeenAt: { lt: new Date(now - 30 * 60_000) } } } },
    include: { answers: { select: { id: true }, take: 1 } },
  });
  for (const iv of abandoned) {
    if (iv.answers.length) {
      await db.interview.update({ where: { id: iv.id }, data: { status: "completed", completedAt: new Date() } });
      const { runGrading } = await import("./grading");
      await runGrading(iv.id);
    } else {
      await db.interview.update({ where: { id: iv.id }, data: { status: "cancelled", cancelledAt: new Date(), cancelReason: "Abandoned before any answers" } });
    }
  }
}

/** Hidden question fields are only ever serialized for interviewers/admins. */
export function guideQuestion(q: {
  id: string;
  order: number;
  category: string;
  text: string;
  difficulty: string;
  whatItTests: string;
  competencies: string;
  followUps: string;
  gradingCriteria: string;
  isFollowUp: boolean;
  parentQuestionId: string | null;
  askedAt: Date | null;
}) {
  return {
    id: q.id,
    order: q.order,
    category: q.category,
    text: q.text,
    difficulty: q.difficulty,
    whatItTests: q.whatItTests,
    competencies: parseJsonArray(q.competencies),
    followUps: parseJsonArray(q.followUps),
    gradingCriteria: parseJsonArray(q.gradingCriteria),
    isFollowUp: q.isFollowUp,
    parentQuestionId: q.parentQuestionId,
    askedAt: q.askedAt,
  };
}
