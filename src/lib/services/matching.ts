import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { parseJsonArray } from "@/lib/json";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { roleCategoryLabel, LABELS } from "@/lib/constants";
import { notify } from "./notifications";
import { track } from "./analytics";

/**
 * Interviewer matching.
 *
 * Every eligible interviewer gets a fit score (role, type, industry, experience,
 * timezone, rating, load). We then pick *randomly* among the top candidates,
 * weighted by score, and penalise recent repeat pairings, so students meet a
 * variety of interviewers, styles and backgrounds instead of the same person.
 */

export type MatchCriteria = {
  studentId: string;
  type: string;
  roleCategory: string;
  difficulty: string;
  duration: number;
  preference: string; // anyone | student | professional
  studentIndustry?: string | null;
  studentTimezone?: string | null;
};

type Candidate = {
  userId: string;
  score: number;
  reasons: string[];
  interviewerType: string;
  industry: string | null;
  title: string | null;
  avgRating: number | null;
};

const MATCH_EXPIRY_MIN = 15;
const TOP_N = 5;

function tzOffsetHours(tz?: string | null) {
  if (!tz) return null;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "shortOffset" }).formatToParts(new Date());
    const off = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT";
    const m = off.match(/GMT([+-]\d+)(?::(\d+))?/);
    return m ? Number(m[1]) + (m[2] ? Number(m[2]) / 60 : 0) : 0;
  } catch {
    return null;
  }
}

function preferenceFilter(pref: string): Prisma.InterviewerProfileWhereInput {
  if (pref === "student") return { interviewerType: "student" };
  if (pref === "professional") return { interviewerType: { in: ["professional", "alumni"] } };
  return {};
}

/** Score all eligible interviewers for a request. Excludes banned/suspended/unonboarded users. */
export async function rankInterviewers(c: MatchCriteria, opts: { excludeIds?: string[]; requireAvailableNow?: boolean } = {}): Promise<Candidate[]> {
  const profiles = await db.interviewerProfile.findMany({
    where: {
      ...preferenceFilter(c.preference),
      ...(opts.requireAvailableNow ? { availableNow: true, availableNowAt: { gte: new Date(Date.now() - 4 * 3600_000) } } : {}),
      user: { role: "interviewer", accountStatus: "active", onboardedAt: { not: null }, id: { notIn: [c.studentId, ...(opts.excludeIds ?? [])] } },
    },
    include: { user: { select: { id: true, profile: { select: { timezone: true } } } } },
  });
  if (!profiles.length) return [];
  const ids = profiles.map((p) => p.userId);
  const weekAhead = new Date(Date.now() + 7 * 86400_000);
  const [ratings, loads, recentPairs] = await Promise.all([
    db.interviewerRating.groupBy({
      by: ["interviewerId"],
      where: { interviewerId: { in: ids }, moderationStatus: "visible" },
      _avg: { professionalism: true, realism: true, communication: true, feedbackQuality: true },
    }),
    db.interview.groupBy({
      by: ["interviewerId"],
      where: { interviewerId: { in: ids }, status: { in: ["scheduled", "waiting", "active"] }, OR: [{ scheduledAt: null }, { scheduledAt: { lte: weekAhead } }] },
      _count: true,
    }),
    db.interview.findMany({
      where: { studentId: c.studentId, interviewerId: { in: ids } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { interviewerId: true },
    }),
  ]);
  const studentOffset = tzOffsetHours(c.studentTimezone);

  const out: Candidate[] = [];
  for (const p of profiles) {
    const roles = parseJsonArray(p.roles);
    const types = parseJsonArray(p.interviewTypes);
    const load = loads.find((l) => l.interviewerId === p.userId)?._count ?? 0;
    if (load >= p.weeklyLimit) continue;
    const r = ratings.find((x) => x.interviewerId === p.userId)?._avg;
    const avgRating = r ? ((r.professionalism ?? 0) + (r.realism ?? 0) + (r.communication ?? 0) + (r.feedbackQuality ?? 0)) / 4 : null;

    let score = 10;
    const reasons: string[] = [];
    if (roles.includes(c.roleCategory)) {
      score += 35;
      reasons.push(`Interviews for ${roleCategoryLabel(c.roleCategory)}`);
    } else if (roles.includes("general")) score += 10;
    if (types.includes(c.type)) {
      score += 15;
      reasons.push(`Runs ${LABELS.type[c.type]?.toLowerCase()} interviews`);
    }
    if (c.studentIndustry && p.industry && p.industry.toLowerCase() === c.studentIndustry.toLowerCase()) {
      score += 12;
      reasons.push(`${p.industry} background`);
    }
    score += Math.min(10, p.yearsExperience);
    if (c.difficulty === "advanced" && p.interviewerType !== "student") score += 8;
    const off = tzOffsetHours(p.user.profile?.timezone);
    if (studentOffset != null && off != null && Math.abs(studentOffset - off) <= 3) {
      score += 8;
      reasons.push("Similar time zone");
    }
    if (avgRating) score += avgRating * 2;
    score -= load * 2;
    // Variety: avoid re-pairing with recent interviewers.
    if (recentPairs.some((x) => x.interviewerId === p.userId)) score -= 30;

    out.push({ userId: p.userId, score, reasons, interviewerType: p.interviewerType, industry: p.industry, title: p.title, avgRating });
  }
  return out.sort((a, b) => b.score - a.score);
}

/** Weighted random pick among the top candidates (randomized matching). */
export function pickRandom<T extends { score: number }>(ranked: T[], rand = Math.random): T | null {
  const top = ranked.slice(0, TOP_N).filter((c) => c.score > 0);
  if (!top.length) return ranked[0] ?? null;
  const total = top.reduce((s, c) => s + c.score, 0);
  let r = rand() * total;
  for (const c of top) {
    r -= c.score;
    if (r <= 0) return c;
  }
  return top[top.length - 1];
}

async function criteriaFor(interviewId: string): Promise<MatchCriteria & { interview: { id: string; targetRole: string; interviewerId: string | null; matchStatus: string } }> {
  const iv = await db.interview.findUnique({
    where: { id: interviewId },
    include: { student: { select: { profile: true, studentProfile: true } } },
  });
  if (!iv) throw notFound("Interview not found.");
  return {
    interview: iv,
    studentId: iv.studentId,
    type: iv.type,
    roleCategory: iv.roleCategory,
    difficulty: iv.difficulty,
    duration: iv.duration,
    preference: iv.interviewerPreference,
    studentIndustry: iv.student.studentProfile?.targetIndustry,
    studentTimezone: iv.student.profile?.timezone,
  };
}

/**
 * "Match me now": propose the interview to a randomly chosen, well-fitting
 * interviewer. Interviewers who toggled "available now" are preferred. The
 * request also stays visible in the open pool so any eligible interviewer can claim it.
 */
export async function matchNow(interviewId: string) {
  const c = await criteriaFor(interviewId);
  if (c.interview.interviewerId) return null;
  const tried = await db.match.findMany({ where: { interviewId }, select: { interviewerId: true } });
  const exclude = tried.map((t) => t.interviewerId);
  let ranked = await rankInterviewers(c, { excludeIds: exclude, requireAvailableNow: true });
  if (!ranked.length) ranked = await rankInterviewers(c, { excludeIds: exclude });
  const pick = pickRandom(ranked);
  if (!pick) {
    await db.interview.update({ where: { id: interviewId }, data: { matchStatus: "unmatched" } });
    return null;
  }
  const match = await db.match.create({
    data: { interviewId, interviewerId: pick.userId, score: pick.score, reasons: JSON.stringify(pick.reasons) },
  });
  await db.interview.update({ where: { id: interviewId }, data: { matchStatus: "pending" } });
  await notify(
    pick.userId,
    "interview_request",
    "New interview request",
    `A candidate is looking for a ${c.interview.targetRole} interviewer now. Accept within ${MATCH_EXPIRY_MIN} minutes to take it.`,
    "/interviewer",
  );
  return match;
}

/** Expire stale pending matches and re-match (lazy sweep). */
export async function expireStaleMatches() {
  const stale = await db.match.findMany({
    where: { status: "pending", createdAt: { lt: new Date(Date.now() - MATCH_EXPIRY_MIN * 60_000) } },
    select: { id: true, interviewId: true },
  });
  for (const m of stale) {
    await db.match.update({ where: { id: m.id }, data: { status: "expired" } });
    const iv = await db.interview.findUnique({ where: { id: m.interviewId } });
    if (iv && !iv.interviewerId && iv.status === "scheduled") await matchNow(iv.id);
  }
}

/** Throws if the interviewer already has an interview overlapping [start, start+duration). */
export async function assertInterviewerFree(tx: Prisma.TransactionClient, interviewerId: string, start: Date, duration: number, ignoreInterviewId?: string) {
  const end = new Date(start.getTime() + duration * 60_000);
  const others = await tx.interview.findMany({
    where: {
      interviewerId,
      id: ignoreInterviewId ? { not: ignoreInterviewId } : undefined,
      status: { in: ["scheduled", "waiting", "active"] },
      scheduledAt: { lt: end, gte: new Date(start.getTime() - 180 * 60_000) },
    },
    select: { scheduledAt: true, duration: true },
  });
  const clash = others.some((o) => o.scheduledAt && o.scheduledAt.getTime() + o.duration * 60_000 > start.getTime());
  if (clash) throw conflict("That interviewer is already booked at this time. Please pick another slot.");
}

export async function acceptInterview(interviewId: string, interviewerId: string, via: "match" | "claim") {
  const result = await db.$transaction(async (tx) => {
    const iv = await tx.interview.findUnique({ where: { id: interviewId } });
    if (!iv) throw notFound("Interview not found.");
    if (iv.mode !== "human") throw forbidden();
    if (iv.interviewerId) throw conflict("Another interviewer already took this interview.");
    if (!["scheduled", "waiting"].includes(iv.status)) throw conflict("This interview is no longer open.");
    if (iv.studentId === interviewerId) throw forbidden();
    const start = iv.scheduledAt && iv.scheduledAt > new Date() ? iv.scheduledAt : new Date();
    await assertInterviewerFree(tx, interviewerId, start, iv.duration, iv.id);
    // Conditional update guards against two interviewers accepting simultaneously.
    const updated = await tx.interview.updateMany({
      where: { id: iv.id, interviewerId: null },
      data: { interviewerId, matchStatus: "matched", scheduledAt: start },
    });
    if (updated.count !== 1) throw conflict("Another interviewer already took this interview.");
    await tx.match.updateMany({ where: { interviewId, interviewerId, status: "pending" }, data: { status: "accepted", respondedAt: new Date() } });
    await tx.match.updateMany({ where: { interviewId, interviewerId: { not: interviewerId }, status: "pending" }, data: { status: "cancelled" } });
    if (via === "claim") {
      const exists = await tx.match.findFirst({ where: { interviewId, interviewerId } });
      if (!exists) await tx.match.create({ data: { interviewId, interviewerId, score: 0, status: "accepted", respondedAt: new Date(), reasons: JSON.stringify(["Claimed from open requests"]) } });
    }
    return iv;
  });
  await notify(
    result.studentId,
    "interviewer_matched",
    "Interviewer matched",
    `We found an interviewer for your ${result.targetRole} interview. Head to the waiting room when you're ready.`,
    `/interviews/${interviewId}`,
  );
  await track("interviewer_accepted", interviewerId, { via });
  return result;
}

export async function declineMatch(matchId: string, interviewerId: string) {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match || match.interviewerId !== interviewerId) throw notFound("Request not found.");
  if (match.status !== "pending") throw conflict("This request is no longer pending.");
  await db.match.update({ where: { id: matchId }, data: { status: "declined", respondedAt: new Date() } });
  await matchNow(match.interviewId);
}

/**
 * Bookable slots for a new human interview. Interviewer identity is withheld
 * until booking (random matching), students see only type, industry and fit.
 */
export async function availableSlots(c: MatchCriteria, days = 14) {
  const ranked = await rankInterviewers(c);
  if (!ranked.length) return [];
  const byId = new Map(ranked.map((r) => [r.userId, r]));
  const slots = await db.availability.findMany({
    where: {
      interviewerId: { in: ranked.map((r) => r.userId) },
      interviewId: null,
      startsAt: { gte: new Date(Date.now() + 30 * 60_000), lte: new Date(Date.now() + days * 86400_000) },
    },
    orderBy: { startsAt: "asc" },
    take: 200,
  });
  return slots
    .filter((s) => (s.endsAt.getTime() - s.startsAt.getTime()) / 60_000 >= c.duration)
    .map((s) => {
      const r = byId.get(s.interviewerId)!;
      return {
        id: s.id,
        startsAt: s.startsAt.toISOString(),
        endsAt: s.endsAt.toISOString(),
        interviewerType: r.interviewerType,
        industry: r.industry,
        fit: Math.round(Math.min(100, r.score)),
        reasons: r.reasons.slice(0, 3),
      };
    });
}

/** Book an availability slot inside the interview-creation transaction. */
export async function bookSlot(tx: Prisma.TransactionClient, slotId: string, interviewId: string, studentId: string, duration: number) {
  const slot = await tx.availability.findUnique({ where: { id: slotId }, include: { interviewer: true } });
  if (!slot || slot.interviewId) throw conflict("That time slot was just taken. Please pick another.");
  if (slot.interviewerId === studentId) throw forbidden();
  if (slot.interviewer.accountStatus !== "active") throw conflict("That interviewer is unavailable. Please pick another slot.");
  if (slot.startsAt < new Date()) throw conflict("That slot is in the past.");
  if ((slot.endsAt.getTime() - slot.startsAt.getTime()) / 60_000 < duration) throw conflict("That slot is too short for this interview length.");
  await assertInterviewerFree(tx, slot.interviewerId, slot.startsAt, duration);
  const claimed = await tx.availability.updateMany({ where: { id: slotId, interviewId: null }, data: { interviewId } });
  if (claimed.count !== 1) throw conflict("That time slot was just taken. Please pick another.");
  await tx.interview.update({
    where: { id: interviewId },
    data: { interviewerId: slot.interviewerId, matchStatus: "matched", scheduledAt: slot.startsAt },
  });
  await tx.match.create({
    data: { interviewId, interviewerId: slot.interviewerId, score: 0, status: "accepted", respondedAt: new Date(), reasons: JSON.stringify(["Booked availability slot"]) },
  });
  return slot;
}
