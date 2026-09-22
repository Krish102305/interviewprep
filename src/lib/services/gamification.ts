import { db } from "@/lib/db";
import { notify } from "./notifications";
import { track } from "./analytics";

export const POINTS = {
  onboarding: 50,
  resumeUpload: 25,
  aiInterview: 100,
  humanInterview: 150,
  streakBonus: 25,
  improvement: 50,
  conductInterview: 150,
  qualityFeedback: 50,
  rating: 10,
} as const;

export const BADGES = [
  { key: "first_interview", name: "First Interview", description: "Completed your first practice interview.", icon: "sparkles" },
  { key: "five_interviews", name: "5 Interviews", description: "Completed five practice interviews.", icon: "layers" },
  { key: "ten_interviews", name: "10 Interviews", description: "Completed ten practice interviews.", icon: "trophy" },
  { key: "feedback_pro", name: "Feedback Pro", description: "Gave five detailed feedback write-ups as an interviewer.", icon: "message" },
  { key: "interview_streak", name: "Interview Streak", description: "Practiced three days in a row.", icon: "flame" },
  { key: "big_improvement", name: "Big Improvement", description: "Improved your score by 10+ points over your first interview.", icon: "trending" },
  { key: "top_interviewer", name: "Top Interviewer", description: "Averaged 4.5+ stars across five or more rated interviews.", icon: "star" },
  { key: "all_rounder", name: "All-Rounder", description: "Completed behavioral, technical and full interviews.", icon: "compass" },
] as const;

export const LEVELS = [
  { level: 1, min: 0, title: "Newcomer" },
  { level: 2, min: 200, title: "Prepared" },
  { level: 3, min: 500, title: "Composed" },
  { level: 4, min: 900, title: "Polished" },
  { level: 5, min: 1400, title: "Confident" },
  { level: 6, min: 2000, title: "Seasoned" },
  { level: 7, min: 2800, title: "Standout" },
  { level: 8, min: 3800, title: "Interview Ready" },
] as const;

export function levelFor(points: number) {
  let current: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (points >= l.min) current = l;
  const next = LEVELS.find((l) => l.min > points);
  const progress = next ? Math.round(((points - current.min) / (next.min - current.min)) * 100) : 100;
  return { ...current, next: next ?? null, progress, toNext: next ? next.min - points : 0 };
}

export async function totalPoints(userId: string) {
  const agg = await db.pointsEntry.aggregate({ where: { userId }, _sum: { amount: true } });
  return agg._sum.amount ?? 0;
}

export async function awardPoints(userId: string, amount: number, reason: string, interviewId?: string, silent = false) {
  if (amount === 0) return;
  // Idempotency: one award per (user, reason, interview).
  if (interviewId) {
    const existing = await db.pointsEntry.findFirst({ where: { userId, reason, interviewId } });
    if (existing) return;
  }
  await db.pointsEntry.create({ data: { userId, amount, reason, interviewId } });
  await track("points_earned", userId, { amount });
  if (!silent) await notify(userId, "points_earned", `+${amount} points`, reason, "/profile");
}

export async function ensureBadgeCatalog() {
  for (const b of BADGES) {
    await db.badge.upsert({ where: { key: b.key }, create: b, update: { name: b.name, description: b.description, icon: b.icon } });
  }
}

export async function awardBadge(userId: string, key: (typeof BADGES)[number]["key"]) {
  const badge = await db.badge.findUnique({ where: { key } });
  if (!badge) return false;
  const existing = await db.userBadge.findUnique({ where: { userId_badgeId: { userId, badgeId: badge.id } } });
  if (existing) return false;
  await db.userBadge.create({ data: { userId, badgeId: badge.id } });
  await notify(userId, "badge_earned", `Badge earned: ${badge.name}`, badge.description, "/profile");
  await track("badge_earned", userId, { badge: key });
  return true;
}

const dayKey = (d: Date) => d.toISOString().slice(0, 10);

/** Update the practice streak for a student who just completed an interview. */
export async function updateStreak(userId: string, when = new Date()) {
  const sp = await db.studentProfile.findUnique({ where: { userId } });
  if (!sp) return 0;
  const today = dayKey(when);
  const last = sp.lastPracticeDate ? dayKey(sp.lastPracticeDate) : null;
  if (last === today) return sp.currentStreak;
  const yesterday = dayKey(new Date(when.getTime() - 86400_000));
  const streak = last === yesterday ? sp.currentStreak + 1 : 1;
  await db.studentProfile.update({
    where: { userId },
    data: { currentStreak: streak, longestStreak: Math.max(streak, sp.longestStreak), lastPracticeDate: when },
  });
  return streak;
}

/** Called after an interview is graded: points, streaks and badges for the candidate. */
export async function rewardCandidate(interviewId: string) {
  const iv = await db.interview.findUnique({ where: { id: interviewId } });
  if (!iv || iv.status !== "completed") return;
  const userId = iv.studentId;
  await awardPoints(
    userId,
    iv.mode === "human" ? POINTS.humanInterview : POINTS.aiInterview,
    `Completed a ${iv.mode === "human" ? "human" : "AI"} ${iv.type} interview`,
    interviewId,
  );

  const streak = await updateStreak(userId, iv.completedAt ?? new Date());
  if (streak >= 2) await awardPoints(userId, POINTS.streakBonus, `${streak}-day practice streak`, interviewId);
  if (streak >= 3) await awardBadge(userId, "interview_streak");

  const completed = await db.interview.findMany({
    where: { studentId: userId, status: "completed", overallScore: { not: null } },
    orderBy: { completedAt: "asc" },
    select: { id: true, overallScore: true, type: true },
  });
  const count = await db.interview.count({ where: { studentId: userId, status: "completed" } });
  if (count >= 1) await awardBadge(userId, "first_interview");
  if (count >= 5) await awardBadge(userId, "five_interviews");
  if (count >= 10) await awardBadge(userId, "ten_interviews");
  if (new Set(completed.map((c) => c.type)).size === 3) await awardBadge(userId, "all_rounder");

  if (completed.length >= 2 && iv.overallScore != null) {
    const prior = completed.filter((c) => c.id !== interviewId);
    const priorAvg = prior.reduce((s, c) => s + (c.overallScore ?? 0), 0) / prior.length;
    if (iv.overallScore >= priorAvg + 5) await awardPoints(userId, POINTS.improvement, "Improved on your average score", interviewId);
    const first = completed[0].overallScore ?? 0;
    if (iv.overallScore - first >= 10) await awardBadge(userId, "big_improvement");
  }
}

/** Called when a human interview completes: points + badges for the interviewer. */
export async function rewardInterviewer(interviewId: string) {
  const iv = await db.interview.findUnique({ where: { id: interviewId }, include: { feedback: true } });
  if (!iv?.interviewerId || iv.status !== "completed") return;
  await awardPoints(iv.interviewerId, POINTS.conductInterview, "Conducted a practice interview", interviewId);
  await checkInterviewerBadges(iv.interviewerId);
}

export function isQualityFeedback(f: { strengths?: string | null; improvements?: string | null }) {
  return (f.strengths?.trim().length ?? 0) >= 40 && (f.improvements?.trim().length ?? 0) >= 40;
}

export async function checkInterviewerBadges(interviewerId: string) {
  const feedback = await db.interviewFeedback.findMany({ where: { interviewerId }, select: { strengths: true, improvements: true } });
  if (feedback.filter(isQualityFeedback).length >= 5) await awardBadge(interviewerId, "feedback_pro");
  const ratings = await db.interviewerRating.findMany({ where: { interviewerId, moderationStatus: "visible" } });
  if (ratings.length >= 5) {
    const avg = ratings.reduce((s, r) => s + (r.professionalism + r.realism + r.communication + r.feedbackQuality) / 4, 0) / ratings.length;
    if (avg >= 4.5) await awardBadge(interviewerId, "top_interviewer");
  }
}

export async function leaderboard(role: "student" | "interviewer", limit = 20) {
  const grouped = await db.pointsEntry.groupBy({
    by: ["userId"],
    where: { user: { role, accountStatus: "active" } },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });
  const users = await db.user.findMany({
    where: { id: { in: grouped.map((g) => g.userId) } },
    select: { id: true, profile: true, studentProfile: { select: { school: true, currentStreak: true } }, interviewerProfile: { select: { title: true, interviewerType: true } }, _count: { select: { badges: true } } },
  });
  return grouped.map((g, i) => {
    const u = users.find((x) => x.id === g.userId);
    const points = g._sum.amount ?? 0;
    return { rank: i + 1, userId: g.userId, points, level: levelFor(points), user: u };
  });
}
