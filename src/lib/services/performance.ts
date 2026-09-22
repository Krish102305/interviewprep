import { db } from "@/lib/db";
import { LABELS, SCORE_CATEGORIES, type ScoreCategoryKey } from "@/lib/constants";
import { parseJsonObject } from "@/lib/json";

const avg = (xs: (number | null | undefined)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

export type Recommendation = { title: string; detail: string; mode: "ai" | "human"; type: "behavioral" | "technical" | "full"; focus?: string };

/** Graded interviews for a student, oldest first. */
export async function gradedHistory(userId: string) {
  return db.interview.findMany({
    where: { studentId: userId, status: { in: ["completed", "reported"] }, gradingStatus: "completed", evaluation: { isNot: null } },
    orderBy: { completedAt: "asc" },
    include: { evaluation: true, interviewer: { select: { profile: true } } },
  });
}

export async function getPerformance(userId: string) {
  const history = await gradedHistory(userId);
  const timeline = history.map((iv) => ({
    id: iv.id,
    date: (iv.completedAt ?? iv.createdAt).toISOString(),
    role: iv.targetRole,
    mode: iv.mode,
    type: iv.type,
    overall: iv.evaluation!.overallScore,
    communication: iv.evaluation!.communication,
    confidence: iv.evaluation!.confidence,
    problemSolving: iv.evaluation!.problemSolving,
    professionalism: iv.evaluation!.professionalism,
    technical: iv.evaluation!.technicalKnowledge,
    behavioral: iv.evaluation!.behavioral,
    answerStructure: iv.evaluation!.answerStructure,
    roleKnowledge: iv.evaluation!.roleKnowledge,
  }));
  const overall = timeline.map((t) => t.overall);
  const catKey = (k: ScoreCategoryKey) => (k === "technicalKnowledge" ? "technical" : k) as keyof (typeof timeline)[number];
  const categoryAverages = SCORE_CATEGORIES.map((c) => ({
    key: c.key,
    label: c.label,
    value: avg(timeline.map((t) => t[catKey(c.key)] as number | null)),
  }));
  return {
    timeline,
    summary: {
      count: timeline.length,
      first: timeline[0]?.overall ?? null,
      latest: timeline.at(-1)?.overall ?? null,
      highest: overall.length ? Math.max(...overall) : null,
      average: avg(overall),
      aiCount: timeline.filter((t) => t.mode === "ai").length,
      humanCount: timeline.filter((t) => t.mode === "human").length,
    },
    byMode: {
      ai: avg(timeline.filter((t) => t.mode === "ai").map((t) => t.overall)),
      human: avg(timeline.filter((t) => t.mode === "human").map((t) => t.overall)),
    },
    byType: {
      behavioral: avg(timeline.filter((t) => t.type === "behavioral").map((t) => t.overall)),
      technical: avg(timeline.filter((t) => t.type === "technical").map((t) => t.overall)),
      full: avg(timeline.filter((t) => t.type === "full").map((t) => t.overall)),
    },
    categoryAverages,
  };
}

/**
 * What to practice next — derived from the student's actual history plus the
 * interview that was just graded (spec §33).
 */
export async function recommendNext(
  userId: string,
  latest?: { id: string; type: string; mode: string; scores: Partial<Record<ScoreCategoryKey, number | null>>; overall: number },
): Promise<Recommendation> {
  const history = (await gradedHistory(userId)).filter((h) => h.id !== latest?.id);
  const byType = (t: string) => avg(history.filter((h) => h.type === t).map((h) => h.overallScore));
  const typeCounts = { behavioral: 0, technical: 0, full: 0 } as Record<string, number>;
  for (const h of history) typeCounts[h.type] = (typeCounts[h.type] ?? 0) + 1;
  if (latest) typeCounts[latest.type] = (typeCounts[latest.type] ?? 0) + 1;
  const humanCount = history.filter((h) => h.mode === "human").length + (latest?.mode === "human" ? 1 : 0);

  if (!latest && !history.length)
    return { title: "Start with a behavioral AI interview", detail: "It's the fastest way to get a baseline score across communication, confidence and structure.", mode: "ai", type: "behavioral" };

  const scores = latest?.scores ?? {};
  const scored = SCORE_CATEGORIES.map((c) => ({ ...c, v: scores[c.key] })).filter((c): c is typeof c & { v: number } => typeof c.v === "number");
  const weakest = [...scored].sort((a, b) => a.v - b.v)[0];

  // Trend check against previous interviews of the same type.
  const prevSame = latest ? history.filter((h) => h.type === latest.type).at(-1) : null;
  if (latest && prevSame?.evaluation) {
    const prevComm = prevSame.evaluation.communication;
    const prevTech = prevSame.evaluation.technicalKnowledge;
    const nowComm = scores.communication;
    const nowTech = scores.technicalKnowledge;
    if (prevTech != null && nowTech != null && prevComm != null && nowComm != null && nowTech > prevTech && nowComm < prevComm - 3)
      return {
        title: "Balance technical depth with clear communication",
        detail: `Your technical score improved (${prevTech} → ${nowTech}), but communication dipped (${prevComm} → ${nowComm}). Try another full interview and narrate your reasoning out loud.`,
        mode: "ai",
        type: "full",
        focus: "communication",
      };
  }

  if (latest && latest.overall >= 80) {
    const untried = (["behavioral", "technical", "full"] as const).find((t) => !typeCounts[t]);
    if (untried)
      return {
        title: `Try a ${LABELS.type[untried].toLowerCase()} next`,
        detail: `Your ${LABELS.type[latest.type].toLowerCase()} performance is strong (${latest.overall}/100). Stretch into a ${LABELS.type[untried].toLowerCase()} to round out your preparation.`,
        mode: "ai",
        type: untried,
      };
    if (!humanCount)
      return {
        title: "Add real interview pressure",
        detail: "You're scoring well with the AI interviewer. Book a human interview to practice with someone unpredictable.",
        mode: "human",
        type: latest.type as Recommendation["type"],
      };
  }

  if (weakest && weakest.v < 75) {
    const focusMap: Partial<Record<ScoreCategoryKey, Omit<Recommendation, "detail"> & { detail: string }>> = {
      answerStructure: { title: "Practice STAR-structured stories", detail: "Your answer structure held your score back. Run a behavioral interview and end every story with a specific result.", mode: "ai", type: "behavioral", focus: "structure" },
      behavioral: { title: "Practice behavioral questions focused on leadership", detail: "Behavioral performance was your weakest area. Prepare 4–5 stories (leadership, conflict, failure, initiative) and rehearse them.", mode: "ai", type: "behavioral", focus: "leadership" },
      technicalKnowledge: { title: "Drill role-specific technical questions", detail: "Technical knowledge was your lowest category. A technical interview at the same difficulty will target the gaps.", mode: "ai", type: "technical" },
      roleKnowledge: { title: "Deepen your role knowledge", detail: "Research the role's day-to-day and practice a technical interview with the job description attached.", mode: "ai", type: "technical" },
      communication: { title: "Work on concise communication", detail: "Communication was your lowest category. Aim for 1–2 minute answers with a clear beginning, middle and end — a full interview is great practice.", mode: "ai", type: "full", focus: "communication" },
      confidence: { title: "Build confidence under pressure", detail: "Confidence was your weakest score. Practicing with a real person is the best way to get comfortable — try a human interview.", mode: "human", type: (latest?.type as Recommendation["type"]) ?? "behavioral" },
      problemSolving: { title: "Practice thinking out loud", detail: "Problem solving scored lowest. Narrate your approach step by step in a technical interview.", mode: "ai", type: "technical" },
      professionalism: { title: "Polish your interview presence", detail: "Professionalism scored lowest — keep answers focused and complete. A human interview will give you real-world feedback.", mode: "human", type: "full" },
    };
    const rec = focusMap[weakest.key];
    if (rec) return { ...rec, detail: `${rec.detail} (${weakest.label}: ${weakest.v}/100)` };
  }

  const bt = byType("behavioral");
  const tt = byType("technical");
  if (bt != null && tt != null && Math.abs(bt - tt) >= 8) {
    const weaker = bt < tt ? "behavioral" : "technical";
    return { title: `Focus on ${weaker} interviews`, detail: `Your ${weaker} average (${Math.min(bt, tt)}) trails your ${weaker === "behavioral" ? "technical" : "behavioral"} average (${Math.max(bt, tt)}).`, mode: "ai", type: weaker };
  }
  return { title: "Keep the momentum with a full interview", detail: "A full interview combines everything you've practiced — the closest thing to the real day.", mode: humanCount ? "ai" : "human", type: "full" };
}

export function parseRecommendation(value: string | null | undefined): Recommendation | null {
  const r = parseJsonObject<Partial<Recommendation>>(value);
  return r.title ? (r as Recommendation) : null;
}
