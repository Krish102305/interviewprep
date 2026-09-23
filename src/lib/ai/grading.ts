import { z } from "zod";
import { CATEGORIES_BY_TYPE, SCORE_CATEGORIES, roleCategoryLabel, type InterviewType, type ScoreCategoryKey } from "@/lib/constants";
import { clamp } from "@/lib/format";
import { analyzeAnswer, excerpt, quoteAppearsIn, type AnswerAnalysis } from "./analysis";
import { AI_MODEL, AiUnavailableError, generateStructured, isAiConfigured } from "./client";

export type QAPair = {
  questionId: string;
  question: string;
  category: string;
  whatItTests: string;
  gradingCriteria: string[];
  keywords: string[];
  isFollowUp: boolean;
  answer: string;
};

export type GradingInput = {
  type: InterviewType;
  mode: "ai" | "human";
  targetRole: string;
  roleCategory: string;
  company?: string | null;
  jobDescription?: string | null;
  difficulty: string;
  qa: QAPair[];
  interviewerFeedback?: { strengths?: string | null; improvements?: string | null; notes?: string | null } | null;
  interviewerNotes?: string[];
};

export type QuestionFeedback = {
  questionId: string;
  question: string;
  answerExcerpt: string | null;
  score: number;
  feedback: string;
  star?: { situation: boolean; task: boolean; action: boolean; result: boolean } | null;
};

export type EvaluationResult = {
  engine: "ai" | "fallback";
  model: string | null;
  overallScore: number;
  scores: Partial<Record<ScoreCategoryKey, number | null>>;
  summary: string;
  strengths: string[];
  improvements: string[];
  questionFeedback: QuestionFeedback[];
  interviewerFeedbackSummary: string | null;
};

const BEHAVIORAL_CATS = new Set(["behavioral", "intro"]);
const shortQ = (q: string) => (q.length > 70 ? `${q.slice(0, 67).trim()}…` : q);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ---------------------------------------------------------------------------
// Development engine, transparent rubric over the real transcript
// ---------------------------------------------------------------------------

function lengthAdj(words: number) {
  if (words < 15) return -30;
  if (words < 40) return -12;
  if (words < 80) return 2;
  if (words <= 320) return 10;
  return -4; // rambling
}

function scoreAnswer(p: QAPair, a: AnswerAnalysis & { answer_questionMarks?: number }) {
  if (!p.answer.trim()) return 0;
  if (a.nonAnswer) return 12;
  let s = 50 + lengthAdj(a.words);
  if (BEHAVIORAL_CATS.has(p.category)) {
    s += a.starCount * 6 + (a.hasNumbers ? 6 : 0) + (a.iStatements > a.weStatements ? 4 : 0);
  } else if (p.category === "candidate_questions") {
    s += (a.answer_questionMarks ?? 0) > 0 ? 20 : 5;
  } else {
    s += Math.round(a.keywordCoverage * 32) + Math.min(4, a.reasoningMarkers) * 3;
  }
  if (a.fillerRate > 0.1) s -= 15;
  else if (a.fillerRate > 0.05) s -= 8;
  s -= Math.min(12, a.hedgeCount * 3);
  if (a.profanity) s -= 20;
  return Math.round(clamp(s));
}

type Analysed = QAPair & { a: AnswerAnalysis & { answer_questionMarks?: number }; score: number };

function starFeedback(p: Analysed) {
  const missing = (["situation", "task", "action", "result"] as const).filter((k) => !p.a.star[k]);
  if (!missing.length) return "Your answer covered the full STAR arc: situation, task, action and result.";
  const have = (["situation", "task", "action", "result"] as const).filter((k) => p.a.star[k]);
  const haveText = have.length ? `You clearly explained the ${have.join(" and ")}` : "The answer didn't establish a clear STAR structure";
  return `${haveText}, but the ${missing.join(" and ")} ${missing.length > 1 ? "were" : "was"} not specific.`;
}

export function gradeWithRubric(input: GradingInput): EvaluationResult {
  const answered: Analysed[] = input.qa.map((p) => {
    const a = analyzeAnswer(p.answer, p.keywords) as Analysed["a"];
    a.answer_questionMarks = (p.answer.match(/\?/g) ?? []).length + (/(what|how|could you|can you|do you)\b/i.test(p.answer) ? 1 : 0);
    return { ...p, a, score: scoreAnswer(p, a) };
  });
  const withText = answered.filter((p) => p.answer.trim());
  const behavioral = withText.filter((p) => BEHAVIORAL_CATS.has(p.category));
  const technical = withText.filter((p) => !BEHAVIORAL_CATS.has(p.category) && p.category !== "candidate_questions");

  const communication = avg(withText.map((p) => clamp(72 + lengthAdj(p.a.words) - (p.a.fillerRate > 0.05 ? 12 : 0) - (p.a.sentences < 2 ? 8 : 0))));
  const confidence = avg(withText.map((p) => clamp(78 - p.a.hedgeCount * 6 - (p.a.fillerRate > 0.06 ? 10 : 0) + (p.a.iStatements >= 2 ? 6 : 0) + (p.a.words < 25 ? -18 : 0))));
  const answerStructure = avg(
    withText.map((p) => (BEHAVIORAL_CATS.has(p.category) ? clamp(40 + p.a.starCount * 14) : clamp(50 + Math.min(4, p.a.reasoningMarkers) * 11))),
  );
  const technicalKnowledge = technical.length ? avg(technical.map((p) => clamp(35 + p.a.keywordCoverage * 60 + (p.a.nonAnswer ? -20 : 0)))) : null;
  const problemSolving = avg(withText.map((p) => clamp(48 + Math.min(5, p.a.reasoningMarkers) * 8 + (p.a.hasNumbers ? 6 : 0))));
  const roleKnowledge = technical.length || withText.length ? avg(withText.map((p) => clamp(45 + p.a.keywordCoverage * 45 + (p.a.words >= 60 ? 6 : 0)))) : null;
  const professionalism = clamp(90 - (withText.some((p) => p.a.profanity) ? 30 : 0) - answered.filter((p) => !p.answer.trim() || p.a.nonAnswer).length * 6);
  const behavioralScore = behavioral.length ? avg(behavioral.map((p) => p.score)) : null;

  const all: Record<ScoreCategoryKey, number | null> = {
    communication,
    confidence,
    answerStructure,
    technicalKnowledge,
    problemSolving,
    roleKnowledge,
    professionalism,
    behavioral: behavioralScore,
  };
  const applicable = CATEGORIES_BY_TYPE[input.type];
  const scores: Partial<Record<ScoreCategoryKey, number | null>> = {};
  for (const k of applicable) scores[k] = all[k] == null ? null : Math.round(all[k]!);

  const catAvg = avg(applicable.map((k) => scores[k]).filter((v): v is number => v != null));
  const qAvg = avg(answered.map((p) => p.score));
  const overallScore = Math.round(clamp(0.5 * catAvg + 0.5 * qAvg));

  // ---- Explanations grounded in the actual answers --------------------------
  const strengths: string[] = [];
  const improvements: string[] = [];
  const best = [...withText].sort((x, y) => y.score - x.score)[0];
  const weakest = [...withText].sort((x, y) => x.score - y.score)[0];

  const fullStar = behavioral.filter((p) => p.a.starCount >= 3);
  if (fullStar.length)
    strengths.push(`Well-structured stories: ${fullStar.length} of ${behavioral.length} behavioral answers covered most of the STAR arc. In "${shortQ(fullStar[0].question)}" you said: "${excerpt(fullStar[0].answer)}"`);
  const quantified = withText.filter((p) => p.a.hasNumbers);
  if (quantified.length)
    strengths.push(`You backed claims with concrete numbers in ${quantified.length} answer${quantified.length > 1 ? "s" : ""}, e.g. "${excerpt(quantified[0].answer)}"`);
  const coveredTech = technical.filter((p) => p.a.keywordCoverage >= 0.4);
  if (coveredTech.length)
    strengths.push(`Solid technical coverage on "${shortQ(coveredTech[0].question)}". You addressed ${coveredTech[0].a.keywordHits.slice(0, 4).join(", ")}.`);
  if (withText.length && avg(withText.map((p) => p.a.fillerRate)) < 0.02) strengths.push("Clean, direct delivery with very few filler words.");
  if (best && !strengths.length) strengths.push(`Your strongest answer was to "${shortQ(best.question)}": "${excerpt(best.answer)}"`);

  const noResult = behavioral.filter((p) => !p.a.star.result);
  if (noResult.length)
    improvements.push(`${starFeedback(noResult[0])} (in "${shortQ(noResult[0].question)}"). Close every story with a specific, ideally measurable, result.`);
  const weAnswers = behavioral.filter((p) => p.a.weStatements > p.a.iStatements + 1);
  if (weAnswers.length)
    improvements.push(`In ${weAnswers.length} answer${weAnswers.length > 1 ? "s" : ""} you mostly said "we". Interviewers need to hear what *you* did. Use "I" for your own actions.`);
  const brief = withText.filter((p) => p.a.words < 40);
  if (brief.length) improvements.push(`${brief.length} answer${brief.length > 1 ? "s were" : " was"} under 40 words (e.g. "${shortQ(brief[0].question)}"). Aim for 1–2 minutes with context, actions and results.`);
  const missedTech = technical.filter((p) => p.a.keywordCoverage < 0.3 && p.keywords.length);
  if (missedTech.length) {
    const missed = missedTech[0].keywords.filter((k) => !missedTech[0].a.keywordHits.includes(k.toLowerCase())).slice(0, 4);
    improvements.push(`On "${shortQ(missedTech[0].question)}", a strong answer would also cover: ${missed.join(", ")}.`);
  }
  const fillerHeavy = withText.filter((p) => p.a.fillerRate > 0.05);
  if (fillerHeavy.length) improvements.push(`Filler words ("um", "like", "basically") showed up often in ${fillerHeavy.length} answer${fillerHeavy.length > 1 ? "s" : ""}. Pausing silently reads as more confident.`);
  const hedgy = withText.filter((p) => p.a.hedgeCount >= 2);
  if (hedgy.length) improvements.push(`Hedging phrases ("I guess", "probably", "not sure") weakened ${hedgy.length} answer${hedgy.length > 1 ? "s" : ""}. State your reasoning with conviction.`);
  const unanswered = answered.filter((p) => !p.answer.trim());
  if (unanswered.length) improvements.push(`${unanswered.length} question${unanswered.length > 1 ? "s were" : " was"} left unanswered.`);
  if (!improvements.length && weakest) improvements.push(`Your least developed answer was to "${shortQ(weakest.question)}". Rehearse it with a clearer structure.`);

  const questionFeedback: QuestionFeedback[] = answered.map((p) => ({
    questionId: p.questionId,
    question: p.question,
    answerExcerpt: p.answer.trim() ? excerpt(p.answer, 28, p.keywords) : null,
    score: p.score,
    feedback: !p.answer.trim()
      ? "No answer was captured for this question."
      : BEHAVIORAL_CATS.has(p.category)
        ? `${starFeedback(p)}${p.a.hasNumbers ? " Good use of specifics." : " Add a concrete number or outcome."}`
        : p.category === "candidate_questions"
          ? p.score >= 65
            ? "You came prepared with questions for the interviewer."
            : "Prepare 2–3 specific questions about the role, team or success metrics."
          : p.a.keywordCoverage >= 0.4
            ? `Covered key concepts (${p.a.keywordHits.slice(0, 4).join(", ")}).${p.a.reasoningMarkers < 2 ? " Explain your reasoning step by step." : ""}`
            : `Missed key concepts${p.keywords.length ? ` such as ${p.keywords.filter((k) => !p.a.keywordHits.includes(k.toLowerCase())).slice(0, 3).join(", ")}` : ""}. ${p.a.reasoningMarkers < 2 ? "Walk through your approach explicitly." : ""}`.trim(),
    star: BEHAVIORAL_CATS.has(p.category) && p.answer.trim() ? p.a.star : null,
  }));

  const words = Math.round(avg(withText.map((p) => p.a.words)));
  const summary =
    `You answered ${withText.length} of ${answered.length} questions in this ${input.type} interview for ${input.targetRole}` +
    `${withText.length ? `, averaging about ${words} words per answer` : ""}. ` +
    (overallScore >= 80
      ? "Overall this was a strong, interview-ready performance."
      : overallScore >= 65
        ? "The foundation is solid; tightening structure and specificity will lift your score."
        : "There's clear room to grow. Focus on complete, specific answers with measurable results.");

  return {
    engine: "fallback",
    model: null,
    overallScore,
    scores,
    summary,
    strengths: strengths.slice(0, 4),
    improvements: improvements.slice(0, 5),
    questionFeedback,
    interviewerFeedbackSummary: summariseInterviewerFeedback(input.interviewerFeedback),
  };
}

function trimTo(s: string, n = 220) {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function summariseInterviewerFeedback(f: GradingInput["interviewerFeedback"]) {
  if (!f) return null;
  const parts: string[] = [];
  if (f.strengths?.trim()) parts.push(`Your interviewer noted what went well: "${trimTo(f.strengths)}"`);
  if (f.improvements?.trim()) parts.push(`They suggested improving: "${trimTo(f.improvements)}"`);
  return parts.length ? parts.join(" ") : null;
}

// ---------------------------------------------------------------------------
// AI engine
// ---------------------------------------------------------------------------

const nullableScore = z.number().int().min(0).max(100).nullable();
const EvaluationSchema = z.object({
  overall_score: z.number().int().min(0).max(100),
  category_scores: z.object({
    communication: nullableScore,
    confidence: nullableScore,
    answer_structure: nullableScore,
    technical_knowledge: nullableScore,
    problem_solving: nullableScore,
    role_knowledge: nullableScore,
    professionalism: nullableScore,
    behavioral: nullableScore,
  }),
  summary: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  question_feedback: z.array(
    z.object({
      question_id: z.string(),
      score: z.number().int().min(0).max(100),
      feedback: z.string(),
      answer_quote: z.string().nullable(),
      star: z.object({ situation: z.boolean(), task: z.boolean(), action: z.boolean(), result: z.boolean() }).nullable(),
    }),
  ),
  interviewer_feedback_summary: z.string().nullable(),
});

const GRADING_SYSTEM = `You are the standardized grading engine for Interview Connect. Every practice interview, whether conducted by an AI or by a human interviewer, is graded by you so scores are consistent across the platform.

Grade strictly from the transcript. Scoring scale (0–100) for every category:
90–100 exceptional, would stand out at a top firm · 75–89 strong, interview-ready · 60–74 developing, noticeable gaps · 40–59 weak · below 40 missing or off-target.

Rubric by interview type:
- Behavioral: relevance, specificity, communication, STAR structure (identify missing or weak Situation/Task/Action/Result), leadership, teamwork, problem solving, reflection, authenticity.
- Technical: correctness, reasoning, technical/role knowledge, problem solving, accuracy, ability to explain the approach. Coding: correctness, complexity, edge cases, explanation. Finance: financial knowledge, calculations, reasoning, accuracy, business understanding. Adapt to the role.
- Full: all relevant categories; weigh behavioral and role-specific performance by how the interview was balanced.

Rules:
- Only score categories listed as applicable; return null for the others.
- Explain scores using the candidate's actual responses. Any quote you give (answer_quote, or quotes inside strengths/improvements) must be copied verbatim from the transcript. Never fabricate examples.
- Unanswered questions lower the score; do not penalize nervousness, pauses, accents, disabilities, or technical glitches. Judge the content and communication.
- Human interviewer feedback (if any) is qualitative context. Summarize it for the candidate in interviewer_feedback_summary, but it never overrides your standardized evaluation.
- Strengths and improvements: 2–4 each, specific and actionable. The summary is 2–3 sentences addressed to the candidate ("you").`;

export async function gradeInterview(input: GradingInput): Promise<EvaluationResult> {
  if (!isAiConfigured()) return gradeWithRubric(input);
  const applicable = CATEGORIES_BY_TYPE[input.type];
  const labels = Object.fromEntries(SCORE_CATEGORIES.map((c) => [c.key, c.label]));
  try {
    const r = await generateStructured({
      system: GRADING_SYSTEM,
      effort: "medium",
      maxTokens: 16000,
      schema: EvaluationSchema,
      prompt: [
        `<interview type="${input.type}" mode="${input.mode}" difficulty="${input.difficulty}">`,
        `Target role: ${input.targetRole} (${roleCategoryLabel(input.roleCategory)})${input.company ? ` at ${input.company}` : ""}`,
        `Applicable categories: ${applicable.map((k) => labels[k]).join(", ")}`,
        `</interview>`,
        input.jobDescription ? `<job_description>\n${input.jobDescription}\n</job_description>` : "",
        `<transcript>`,
        ...input.qa.map(
          (p) =>
            `<exchange question_id="${p.questionId}" category="${p.category}"${p.isFollowUp ? ' follow_up="true"' : ""}>\n<question tests="${p.whatItTests}">${p.question}</question>\n<criteria>${p.gradingCriteria.join("; ")}</criteria>\n<answer>${p.answer.trim() || "(no answer captured)"}</answer>\n</exchange>`,
        ),
        `</transcript>`,
        input.interviewerFeedback
          ? `<human_interviewer_feedback>\nStrengths: ${input.interviewerFeedback.strengths || "-"}\nImprovements: ${input.interviewerFeedback.improvements || "-"}\nNotes: ${input.interviewerFeedback.notes || "-"}\n</human_interviewer_feedback>`
          : "",
        input.interviewerNotes?.length ? `<interviewer_private_notes>\n${input.interviewerNotes.join("\n")}\n</interviewer_private_notes>` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    });

    const cs = r.category_scores;
    const mapped: Record<ScoreCategoryKey, number | null> = {
      communication: cs.communication,
      confidence: cs.confidence,
      answerStructure: cs.answer_structure,
      technicalKnowledge: cs.technical_knowledge,
      problemSolving: cs.problem_solving,
      roleKnowledge: cs.role_knowledge,
      professionalism: cs.professionalism,
      behavioral: cs.behavioral,
    };
    const scores: Partial<Record<ScoreCategoryKey, number | null>> = {};
    for (const k of applicable) scores[k] = mapped[k];

    const byId = new Map(input.qa.map((p) => [p.questionId, p]));
    const questionFeedback: QuestionFeedback[] = r.question_feedback
      .filter((f) => byId.has(f.question_id))
      .map((f) => {
        const p = byId.get(f.question_id)!;
        // Drop any quote that does not actually appear in the candidate's answer.
        const quote = f.answer_quote && quoteAppearsIn(f.answer_quote, p.answer) ? f.answer_quote : p.answer.trim() ? excerpt(p.answer) : null;
        return { questionId: p.questionId, question: p.question, answerExcerpt: quote, score: f.score, feedback: f.feedback, star: f.star };
      });

    return {
      engine: "ai",
      model: AI_MODEL,
      overallScore: r.overall_score,
      scores,
      summary: r.summary,
      strengths: r.strengths.slice(0, 5),
      improvements: r.improvements.slice(0, 5),
      questionFeedback,
      interviewerFeedbackSummary: r.interviewer_feedback_summary ?? summariseInterviewerFeedback(input.interviewerFeedback),
    };
  } catch (err) {
    if (!(err instanceof AiUnavailableError)) console.error("[ai] grading failed", err);
    throw err;
  }
}
