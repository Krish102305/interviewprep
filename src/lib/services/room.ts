import { db } from "@/lib/db";
import { badRequest, conflict, forbidden } from "@/lib/errors";
import { parseJsonArray } from "@/lib/json";
import { FOLLOW_UPS_PER_QUESTION, LABELS } from "@/lib/constants";
import { shortName } from "@/lib/format";
import type { SessionUser } from "@/lib/auth/session";
import { decideNextTurn, replyToCandidateQuestions, suggestFollowUp } from "@/lib/ai/followups";
import { guideQuestion, loadForUser } from "./interviews";
import { escalateIfRepeated, issueWarning, recordConductEvent } from "./conduct";
import { track } from "./analytics";

const PRESENCE_WINDOW_MS = 15_000;
export const AI_INTERVIEWER_NAME = "Ava";

type Iv = Awaited<ReturnType<typeof loadForUser>>["iv"];

// ---------------------------------------------------------------------------
// Room state (role-filtered)
// ---------------------------------------------------------------------------

/**
 * Candidates only ever receive: interview metadata, progress, the question that
 * is currently being asked, and the transcript of what has already been said.
 * The full plan and hidden grading metadata go to interviewers/admins only.
 */
export async function getRoomState(interviewId: string, user: SessionUser) {
  const { iv, role } = await loadForUser(interviewId, user);

  if (role !== "admin" && ["scheduled", "waiting", "active"].includes(iv.status)) {
    await db.interviewSession.upsert({
      where: { interviewId_userId: { interviewId, userId: user.id } },
      create: { interviewId, userId: user.id, participantRole: role, lastSeenAt: new Date(), connectionState: "connected" },
      update: { lastSeenAt: new Date() },
    });
  }

  // Both participants may be ready before the guide finishes generating — start once it is.
  if (iv.mode === "human" && iv.status === "waiting" && iv.questionStatus === "ready" && iv.interviewerId) {
    const ready = await db.interviewSession.count({ where: { interviewId, ready: true, userId: { in: [iv.studentId, iv.interviewerId] } } });
    if (ready === 2) {
      const started = await db.interview.updateMany({ where: { id: interviewId, status: "waiting" }, data: { status: "active", startedAt: new Date() } });
      if (started.count) {
        iv.status = "active";
        iv.startedAt = new Date();
        await track("interview_started", iv.studentId, { mode: "human", type: iv.type });
      }
    }
  }

  const [questions, transcript, sessions, people, warnings] = await Promise.all([
    db.interviewQuestion.findMany({ where: { interviewId }, orderBy: [{ order: "asc" }, { createdAt: "asc" }] }),
    db.transcriptEntry.findMany({ where: { interviewId }, orderBy: { createdAt: "asc" } }),
    db.interviewSession.findMany({ where: { interviewId } }),
    db.user.findMany({
      where: { id: { in: [iv.studentId, iv.interviewerId].filter(Boolean) as string[] } },
      select: { id: true, profile: true, interviewerProfile: { select: { title: true, interviewerType: true } }, studentProfile: { select: { school: true, major: true } } },
    }),
    role === "admin"
      ? Promise.resolve([])
      : db.conductEvent.findMany({ where: { interviewId, userId: user.id, type: "warning_issued", resolved: false }, orderBy: { createdAt: "desc" }, take: 1 }),
  ]);

  const main = questions.filter((q) => !q.isFollowUp);
  const active = questions.find((q) => q.id === iv.activeQuestionId) ?? null;
  const now = Date.now();
  const presence = (userId: string | null) => {
    if (!userId) return null;
    const s = sessions.find((x) => x.userId === userId);
    return {
      ready: s?.ready ?? false,
      online: Boolean(s?.lastSeenAt && now - s.lastSeenAt.getTime() < PRESENCE_WINDOW_MS && !s.leftAt),
      connectionState: s?.connectionState ?? "disconnected",
    };
  };
  const person = (id: string | null) => people.find((p) => p.id === id);
  const student = person(iv.studentId);
  const interviewer = person(iv.interviewerId);
  const isStaff = role === "interviewer" || role === "admin";

  return {
    id: iv.id,
    mode: iv.mode,
    type: iv.type,
    typeLabel: LABELS.type[iv.type],
    targetRole: iv.targetRole,
    company: iv.company,
    difficulty: iv.difficulty,
    duration: iv.duration,
    status: iv.status,
    gradingStatus: iv.gradingStatus,
    questionStatus: iv.questionStatus,
    questionEngine: iv.questionEngine,
    scheduledAt: iv.scheduledAt,
    startedAt: iv.startedAt,
    pausedAt: iv.pausedAt,
    serverNow: new Date().toISOString(),
    me: { id: user.id, role },
    candidate: { id: iv.studentId, name: shortName(student?.profile), presence: presence(iv.studentId), school: isStaff ? student?.studentProfile?.school ?? null : undefined },
    interviewer:
      iv.mode === "ai"
        ? { id: null, name: AI_INTERVIEWER_NAME, title: "AI Interviewer", presence: { ready: true, online: true, connectionState: "connected" } }
        : iv.interviewerId
          ? { id: iv.interviewerId, name: shortName(interviewer?.profile), title: interviewer?.interviewerProfile?.title ?? LABELS.interviewerType[interviewer?.interviewerProfile?.interviewerType ?? "professional"], presence: presence(iv.interviewerId) }
          : null,
    progress: { current: Math.max(0, iv.currentQuestionIndex + 1), total: main.length },
    activeQuestion: active
      ? { id: active.id, text: active.text, isFollowUp: active.isFollowUp, ...(isStaff ? { category: active.category, parentQuestionId: active.parentQuestionId } : {}) }
      : null,
    transcript: transcript.map((t) => ({ id: t.id, speaker: t.speaker, kind: t.kind, text: t.text, questionId: t.questionId, source: t.source, createdAt: t.createdAt })),
    pendingWarning: warnings[0] ? { id: warnings[0].id, details: warnings[0].details, source: warnings[0].source } : null,
    guide: isStaff ? questions.map(guideQuestion) : undefined,
  };
}

export type RoomState = Awaited<ReturnType<typeof getRoomState>>;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function assertRunning(iv: Iv) {
  if (iv.status !== "active") throw conflict("This interview isn't in progress.");
  if (iv.pausedAt) throw conflict("The interview is paused.");
}

async function say(interviewId: string, speaker: "interviewer" | "candidate" | "system", kind: string, text: string, questionId?: string | null, source = "ai") {
  return db.transcriptEntry.create({ data: { interviewId, speaker, kind, text, questionId: questionId ?? null, source } });
}

async function markAsked(interviewId: string, questionId: string, mainIndex?: number) {
  await db.interviewQuestion.update({ where: { id: questionId }, data: { askedAt: new Date() } });
  await db.interview.update({
    where: { id: interviewId },
    data: { activeQuestionId: questionId, ...(mainIndex != null ? { currentQuestionIndex: mainIndex } : {}) },
  });
}

function elapsedSeconds(iv: Iv) {
  if (!iv.startedAt) return 0;
  const end = iv.pausedAt ?? new Date();
  return Math.max(0, (end.getTime() - iv.startedAt.getTime()) / 1000);
}

// ---------------------------------------------------------------------------
// Lobby / presence
// ---------------------------------------------------------------------------

export async function markReady(interviewId: string, user: SessionUser, deviceCheck: Record<string, unknown>, recordingConsent: boolean) {
  const { iv, role } = await loadForUser(interviewId, user);
  if (role === "admin") throw forbidden();
  if (!["scheduled", "waiting", "active"].includes(iv.status)) throw conflict("This interview is not open.");
  if (iv.mode === "human" && !iv.interviewerId) throw conflict("You haven't been matched with an interviewer yet.");
  await db.interviewSession.upsert({
    where: { interviewId_userId: { interviewId, userId: user.id } },
    create: { interviewId, userId: user.id, participantRole: role, ready: true, joinedAt: new Date(), lastSeenAt: new Date(), connectionState: "connected", deviceCheck: JSON.stringify(deviceCheck) },
    update: { ready: true, joinedAt: new Date(), lastSeenAt: new Date(), leftAt: null, connectionState: "connected", deviceCheck: JSON.stringify(deviceCheck) },
  });
  if (role === "candidate" && recordingConsent) await db.interview.update({ where: { id: interviewId }, data: { recordingConsent: true } });

  if (iv.status === "scheduled") await db.interview.update({ where: { id: interviewId }, data: { status: "waiting" } });
  if (iv.mode === "human" && iv.status !== "active") {
    const sessions = await db.interviewSession.findMany({ where: { interviewId, ready: true } });
    const bothReady = [iv.studentId, iv.interviewerId].every((id) => sessions.some((s) => s.userId === id));
    if (bothReady && iv.questionStatus === "ready") {
      await db.interview.update({ where: { id: interviewId }, data: { status: "active", startedAt: new Date() } });
      await track("interview_started", iv.studentId, { mode: "human", type: iv.type });
    }
  }
}

export async function updateConnection(interviewId: string, user: SessionUser, state: "connected" | "reconnecting" | "disconnected") {
  const { role } = await loadForUser(interviewId, user);
  if (role === "admin") return;
  await db.interviewSession.updateMany({ where: { interviewId, userId: user.id }, data: { connectionState: state, lastSeenAt: new Date() } });
}

// ---------------------------------------------------------------------------
// AI interview loop
// ---------------------------------------------------------------------------

export async function aiStart(interviewId: string, user: SessionUser) {
  const { iv, role } = await loadForUser(interviewId, user);
  if (role !== "candidate") throw forbidden();
  if (iv.mode !== "ai") throw badRequest("This is not an AI interview.");
  if (iv.status === "active") return; // idempotent (e.g. page refresh)
  if (!["scheduled", "waiting"].includes(iv.status)) throw conflict("This interview can no longer be started.");
  if (iv.questionStatus !== "ready") throw conflict("Your interview is still being prepared.");
  const first = await db.interviewQuestion.findFirst({ where: { interviewId, isFollowUp: false }, orderBy: { order: "asc" } });
  if (!first) throw conflict("This interview has no questions.");
  const profile = await db.profile.findUnique({ where: { userId: user.id } });

  const started = await db.interview.updateMany({
    where: { id: interviewId, status: { in: ["scheduled", "waiting"] } },
    data: { status: "active", startedAt: new Date() },
  });
  if (started.count !== 1) return;
  const company = iv.company ? ` at ${iv.company}` : "";
  await say(
    interviewId,
    "interviewer",
    "intro",
    `Hi ${profile?.firstName ?? "there"}, I'm ${AI_INTERVIEWER_NAME}, and I'll be your interviewer today. This is a ${iv.duration}-minute ${LABELS.type[iv.type].toLowerCase()} for the ${iv.targetRole} role${company}. I'll ask one question at a time and may follow up on your answers. Take a moment to think whenever you need to — answer just as you would in a real interview. Let's begin.`,
  );
  await say(interviewId, "interviewer", "question", first.text, first.id);
  await markAsked(interviewId, first.id, 0);
  await track("interview_started", user.id, { mode: "ai", type: iv.type });
}

/** Candidate submits an answer; the AI decides on a follow-up or the next question. */
export async function aiAnswer(interviewId: string, user: SessionUser, input: { questionId: string; text: string; source: "speech" | "typed"; durationSec?: number }) {
  const { iv, role } = await loadForUser(interviewId, user);
  if (role !== "candidate") throw forbidden();
  if (iv.mode !== "ai") throw badRequest("This is not an AI interview.");
  assertRunning(iv);
  if (iv.activeQuestionId !== input.questionId) throw conflict("That question has already been answered.");

  const current = await db.interviewQuestion.findUniqueOrThrow({ where: { id: input.questionId } });
  // Claim the active question first so a double-submit can't record two answers.
  const claimed = await db.interview.updateMany({ where: { id: interviewId, activeQuestionId: input.questionId }, data: { activeQuestionId: null } });
  if (claimed.count !== 1) throw conflict("That question has already been answered.");

  await db.interviewAnswer.create({ data: { interviewId, questionId: current.id, text: input.text, source: input.source, durationSec: input.durationSec } });
  await say(interviewId, "candidate", "answer", input.text, current.id, input.source);

  const root = current.parentQuestionId ? await db.interviewQuestion.findUniqueOrThrow({ where: { id: current.parentQuestionId } }) : current;
  const mainQuestions = await db.interviewQuestion.findMany({ where: { interviewId, isFollowUp: false }, orderBy: { order: "asc" } });
  const followUpsSoFar = await db.interviewQuestion.findMany({ where: { interviewId, parentQuestionId: root.id }, select: { text: true } });
  const overtime = elapsedSeconds(iv) >= iv.duration * 60;
  const ctx = { targetRole: iv.targetRole, company: iv.company, type: iv.type, difficulty: iv.difficulty };

  if (root.category === "candidate_questions") {
    const reply = await replyToCandidateQuestions({ ctx, answer: input.text });
    await say(interviewId, "interviewer", "note", reply);
    return finishAi(iv, user);
  }

  const decision = overtime
    ? { action: "next" as const, followUp: null, acknowledgement: "Thank you." }
    : await decideNextTurn({
        ctx,
        question: {
          text: current.text,
          category: root.category,
          whatItTests: root.whatItTests,
          followUps: parseJsonArray(root.followUps),
          gradingCriteria: parseJsonArray(root.gradingCriteria),
          keywords: parseJsonArray(root.keywords),
        },
        answer: input.text,
        followUpsSoFar: followUpsSoFar.map((f) => f.text),
        maxFollowUps: FOLLOW_UPS_PER_QUESTION[iv.duration] ?? 1,
      });

  if (decision.action === "follow_up" && decision.followUp) {
    const fu = await db.interviewQuestion.create({
      data: {
        interviewId,
        order: root.order,
        category: root.category,
        text: decision.followUp,
        difficulty: root.difficulty,
        whatItTests: `Follow-up: ${root.whatItTests}`,
        competencies: root.competencies,
        gradingCriteria: root.gradingCriteria,
        keywords: root.keywords,
        isFollowUp: true,
        parentQuestionId: root.id,
      },
    });
    await say(interviewId, "interviewer", "follow_up", `${decision.acknowledgement} ${decision.followUp}`.trim(), fu.id);
    await markAsked(interviewId, fu.id);
    return;
  }

  let nextIndex = mainQuestions.findIndex((q) => q.id === root.id) + 1;
  if (overtime) {
    // Out of time: jump to the candidate-questions segment if the plan has one, otherwise wrap up.
    const cq = mainQuestions.findIndex((q, i) => i >= nextIndex && q.category === "candidate_questions");
    nextIndex = cq >= 0 ? cq : mainQuestions.length;
  }
  const next = mainQuestions[nextIndex];
  if (!next) {
    await say(interviewId, "interviewer", "note", decision.acknowledgement);
    return finishAi(iv, user);
  }
  await say(interviewId, "interviewer", "question", `${decision.acknowledgement} ${overtime && next.category === "candidate_questions" ? "We're almost out of time. " : ""}${next.text}`.trim(), next.id);
  await markAsked(interviewId, next.id, nextIndex);
}

async function finishAi(iv: Iv, user: SessionUser) {
  const profile = await db.profile.findUnique({ where: { userId: user.id } });
  await say(
    iv.id,
    "interviewer",
    "closing",
    `That concludes our interview. Thank you for your time, ${profile?.firstName ?? ""}. Your AI evaluation is being prepared now — you'll see detailed feedback in a moment.`.replace(" ,", ","),
  );
  await completeInterview(iv.id, "completed");
}

// ---------------------------------------------------------------------------
// Human interview: interviewer controls
// ---------------------------------------------------------------------------

async function requireInterviewer(interviewId: string, user: SessionUser) {
  const ctx = await loadForUser(interviewId, user);
  if (ctx.role !== "interviewer") throw forbidden("Only the interviewer can do this.");
  return ctx;
}

export async function interviewerAsk(interviewId: string, user: SessionUser, input: { questionId: string } | { customText: string; parentQuestionId?: string | null }) {
  const { iv } = await requireInterviewer(interviewId, user);
  assertRunning(iv);
  if ("questionId" in input) {
    const q = await db.interviewQuestion.findFirst({ where: { id: input.questionId, interviewId } });
    if (!q) throw badRequest("Question not found.");
    let mainIndex: number | undefined;
    if (!q.isFollowUp) {
      const main = await db.interviewQuestion.findMany({ where: { interviewId, isFollowUp: false }, orderBy: { order: "asc" }, select: { id: true } });
      mainIndex = main.findIndex((m) => m.id === q.id);
    }
    await say(interviewId, "interviewer", q.isFollowUp ? "follow_up" : "question", q.text, q.id, "guide");
    await markAsked(interviewId, q.id, mainIndex);
    return { questionId: q.id };
  }
  const parentId = input.parentQuestionId ?? iv.activeQuestionId;
  const parentRaw = parentId ? await db.interviewQuestion.findFirst({ where: { id: parentId, interviewId } }) : null;
  const root = parentRaw?.parentQuestionId ? await db.interviewQuestion.findUnique({ where: { id: parentRaw.parentQuestionId } }) : parentRaw;
  const fu = await db.interviewQuestion.create({
    data: {
      interviewId,
      order: root?.order ?? 999,
      category: root?.category ?? "behavioral",
      text: input.customText,
      difficulty: root?.difficulty ?? iv.difficulty,
      whatItTests: root ? `Follow-up: ${root.whatItTests}` : "Interviewer follow-up",
      competencies: root?.competencies ?? "[]",
      gradingCriteria: root?.gradingCriteria ?? "[]",
      keywords: root?.keywords ?? "[]",
      isFollowUp: true,
      parentQuestionId: root?.id ?? null,
    },
  });
  await say(interviewId, "interviewer", "follow_up", fu.text, fu.id, "guide");
  await markAsked(interviewId, fu.id);
  return { questionId: fu.id };
}

/** Candidate speech/typed segments captured during a human interview. */
export async function addCandidateSegment(interviewId: string, user: SessionUser, input: { text: string; source: "speech" | "typed" }) {
  const { iv, role } = await loadForUser(interviewId, user);
  if (role !== "candidate") throw forbidden();
  if (iv.mode !== "human") throw badRequest("Use the AI answer flow for AI interviews.");
  if (iv.status !== "active") throw conflict("This interview isn't in progress.");
  if (iv.activeQuestionId) await db.interviewAnswer.create({ data: { interviewId, questionId: iv.activeQuestionId, text: input.text, source: input.source } });
  await say(interviewId, "candidate", "answer", input.text, iv.activeQuestionId, input.source);
}

export async function generateFollowUpSuggestion(interviewId: string, user: SessionUser) {
  const { iv } = await requireInterviewer(interviewId, user);
  if (!iv.activeQuestionId) throw conflict("Ask a question first — follow-ups are based on the candidate's answer.");
  const active = await db.interviewQuestion.findUniqueOrThrow({ where: { id: iv.activeQuestionId } });
  const root = active.parentQuestionId ? await db.interviewQuestion.findUniqueOrThrow({ where: { id: active.parentQuestionId } }) : active;
  const [answers, asked] = await Promise.all([
    db.interviewAnswer.findMany({ where: { interviewId, questionId: active.id }, orderBy: { createdAt: "asc" } }),
    db.interviewQuestion.findMany({ where: { interviewId, parentQuestionId: root.id }, select: { text: true } }),
  ]);
  return suggestFollowUp({
    ctx: { targetRole: iv.targetRole, company: iv.company, type: iv.type, difficulty: iv.difficulty },
    question: {
      text: active.text,
      category: root.category,
      whatItTests: root.whatItTests,
      followUps: parseJsonArray(root.followUps),
      gradingCriteria: parseJsonArray(root.gradingCriteria),
      keywords: parseJsonArray(root.keywords),
    },
    answer: answers.map((a) => a.text).join(" "),
    alreadyAsked: asked.map((a) => a.text),
  });
}

export async function addNote(interviewId: string, user: SessionUser, text: string, questionId?: string | null) {
  await requireInterviewer(interviewId, user);
  return db.interviewerNote.create({ data: { interviewId, interviewerId: user.id, text, questionId: questionId ?? null } });
}

export async function listNotes(interviewId: string, user: SessionUser) {
  const { role } = await loadForUser(interviewId, user);
  if (role === "candidate") throw forbidden(); // private to the interviewer (and admins)
  return db.interviewerNote.findMany({ where: { interviewId }, orderBy: { createdAt: "asc" } });
}

export async function togglePause(interviewId: string, user: SessionUser) {
  const { iv, role } = await loadForUser(interviewId, user);
  const allowed = role === "interviewer" || (role === "candidate" && iv.mode === "ai");
  if (!allowed) throw forbidden("Only the interviewer can pause this interview.");
  if (iv.status !== "active") throw conflict("This interview isn't in progress.");
  if (iv.pausedAt) {
    // Resume: shift startedAt forward so paused time doesn't count against the clock.
    const pausedMs = Date.now() - iv.pausedAt.getTime();
    await db.interview.update({ where: { id: interviewId }, data: { pausedAt: null, startedAt: new Date((iv.startedAt ?? new Date()).getTime() + pausedMs) } });
    await say(interviewId, "system", "note", "Interview resumed.", null, "system");
    return { paused: false };
  }
  await db.interview.update({ where: { id: interviewId }, data: { pausedAt: new Date() } });
  await say(interviewId, "system", "note", "Interview paused.", null, "system");
  return { paused: true };
}

// ---------------------------------------------------------------------------
// Conduct inside the room
// ---------------------------------------------------------------------------

export async function sendConductWarning(interviewId: string, user: SessionUser, details: string) {
  const { iv } = await requireInterviewer(interviewId, user);
  if (iv.status !== "active") throw conflict("This interview isn't in progress.");
  await issueWarning(iv.studentId, interviewId, "interviewer", details || "Your interviewer asked you to return your attention to the interview.");
}

/**
 * Client-side signals (inactivity, tab hidden, ignored warning, acknowledgement).
 * These are *potential* events only. Acknowledging clears the warning.
 */
export async function recordRoomSignal(interviewId: string, user: SessionUser, type: string, details?: string) {
  const { iv, role } = await loadForUser(interviewId, user);
  if (role === "admin") throw forbidden();
  if (type === "warning_acknowledged") {
    await db.conductEvent.updateMany({ where: { interviewId, userId: user.id, type: "warning_issued", resolved: false }, data: { resolved: true } });
    await recordConductEvent({ userId: user.id, interviewId, type, details });
    return { escalated: false };
  }
  if (type === "inactivity" && iv.mode === "ai" && iv.status === "active") {
    // The AI room's own inactivity check issues a warning the candidate can acknowledge.
    await recordConductEvent({ userId: user.id, interviewId, type: "inactivity", details });
    await issueWarning(user.id, interviewId, "system", "You appear to be inactive. Please return your attention to the interview. Continued inactivity may result in a conduct strike.");
    return { escalated: false };
  }
  await recordConductEvent({ userId: user.id, interviewId, type, details });
  if (type === "no_response") {
    const report = await escalateIfRepeated(user.id, interviewId);
    return { escalated: Boolean(report) };
  }
  return { escalated: false };
}

// ---------------------------------------------------------------------------
// Ending
// ---------------------------------------------------------------------------

/** Mark complete and queue grading. AI interviews grade right away; human ones after interviewer feedback. */
export async function completeInterview(interviewId: string, status: "completed" | "reported") {
  const iv = await db.interview.update({
    where: { id: interviewId },
    data: { status, completedAt: new Date(), activeQuestionId: null, pausedAt: null },
  });
  await db.interviewSession.updateMany({ where: { interviewId }, data: { leftAt: new Date(), connectionState: "disconnected" } });
  await track("interview_completed", iv.studentId, { mode: iv.mode, type: iv.type });
  return iv;
}

export async function endInterview(interviewId: string, user: SessionUser, opts: { reason?: string } = {}) {
  const { iv, role } = await loadForUser(interviewId, user);
  if (role === "admin") throw forbidden();
  if (iv.status !== "active") {
    if (iv.status === "completed" || iv.status === "reported") return iv;
    throw conflict("This interview hasn't started yet.");
  }
  const elapsedMin = elapsedSeconds(iv) / 60;
  if (role === "candidate" && iv.mode === "human" && elapsedMin < iv.duration * 0.5) {
    // Leaving early is a *potential* signal only — the interviewer may report it for review.
    await recordConductEvent({ userId: user.id, interviewId, type: "left_early", details: `Left after ${Math.round(elapsedMin)} of ${iv.duration} minutes${opts.reason ? `: ${opts.reason}` : ""}` });
  }
  if (iv.mode === "ai") {
    await say(interviewId, "system", "note", "The candidate ended the interview.", null, "system");
  } else {
    await say(interviewId, "system", "note", `${role === "interviewer" ? "The interviewer" : "The candidate"} ended the interview.`, null, "system");
  }
  const hasReport = await db.conductReport.count({ where: { interviewId } });
  return completeInterview(interviewId, hasReport ? "reported" : "completed");
}
