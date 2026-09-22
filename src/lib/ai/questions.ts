import { z } from "zod";
import { QUESTIONS_PER_DURATION, roleCategoryLabel, type Difficulty, type InterviewType, type RoleCategory } from "@/lib/constants";
import { AiUnavailableError, generateStructured, isAiConfigured } from "./client";
import {
  BEHAVIORAL_BANK,
  CANDIDATE_QUESTIONS,
  INTRO_QUESTIONS,
  MOTIVATION_QUESTIONS,
  SKILL_LEXICON,
  TECHNICAL_BANK,
  type BankQuestion,
} from "./question-bank";

export type InterviewContext = {
  mode: "ai" | "human";
  type: InterviewType;
  targetRole: string;
  roleCategory: RoleCategory;
  company?: string | null;
  jobDescription?: string | null;
  resumeText?: string | null;
  difficulty: Difficulty;
  duration: number;
  experienceLevel?: string | null;
  school?: string | null;
  major?: string | null;
  targetIndustry?: string | null;
};

export type GeneratedQuestion = {
  text: string;
  category: string;
  difficulty: string;
  whatItTests: string;
  competencies: string[];
  followUps: string[];
  gradingCriteria: string[];
  keywords: string[];
};

// ---------------------------------------------------------------------------
// Structure: how many questions of each kind, by interview type
// ---------------------------------------------------------------------------

export function interviewStructure(type: InterviewType, duration: number) {
  const n = QUESTIONS_PER_DURATION[duration] ?? 6;
  if (type === "behavioral") return { intro: 0, motivation: 1, behavioral: n - 1, technical: 0, candidateQuestions: 0, total: n };
  if (type === "technical") return { intro: 0, motivation: 0, behavioral: 0, technical: n, candidateQuestions: 0, total: n };
  // Full interview: intro → motivation → behavioral → role/technical → candidate questions
  const core = n - 3;
  const behavioral = Math.max(1, Math.floor(core * 0.45));
  return { intro: 1, motivation: 1, behavioral, technical: core - behavioral, candidateQuestions: 1, total: n };
}

// ---------------------------------------------------------------------------
// Personalisation helpers (shared by both engines)
// ---------------------------------------------------------------------------

const ACTION_VERBS = /\b(led|built|developed|designed|launched|managed|created|founded|organized|analyzed|implemented|improved|increased|reduced|grew|drove|coordinated|established|spearheaded|researched)\b/i;

/** Pick concrete accomplishment lines from resume text (real content, not invented). */
export function resumeHighlights(resumeText?: string | null, max = 3): string[] {
  if (!resumeText) return [];
  const lines = resumeText
    .split(/\n|•|●|▪|•/)
    .map((l) => l.replace(/\s+/g, " ").trim().replace(/^[-–*]\s*/, ""))
    .filter((l) => l.length >= 35 && l.length <= 180 && ACTION_VERBS.test(l));
  // Prefer lines with numbers (quantified accomplishments).
  lines.sort((a, b) => Number(/\d/.test(b)) - Number(/\d/.test(a)));
  return Array.from(new Set(lines)).slice(0, max);
}

export function jobSkills(jobDescription?: string | null, max = 4): string[] {
  if (!jobDescription) return [];
  const text = jobDescription.toLowerCase();
  return SKILL_LEXICON.filter((s) => new RegExp(`(^|[^a-z])${s.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}([^a-z]|$)`).test(text)).slice(0, max);
}

function fill(text: string, ctx: InterviewContext) {
  return text
    .replaceAll("{role}", ctx.targetRole)
    .replaceAll("{atCompany}", ctx.company ? ` at ${ctx.company}` : "")
    .replaceAll("{companyOrTeam}", ctx.company || "this team");
}

function toGenerated(b: BankQuestion, ctx: InterviewContext): GeneratedQuestion {
  return {
    text: fill(b.text, ctx),
    category: b.category,
    difficulty: b.level === "any" ? ctx.difficulty : b.level,
    whatItTests: b.whatItTests,
    competencies: b.competencies,
    followUps: b.followUps.map((f) => fill(f, ctx)),
    gradingCriteria: b.gradingCriteria,
    keywords: b.keywords,
  };
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const LEVEL_RANK: Record<string, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Order bank questions so the ones closest to the requested difficulty come first. */
function byDifficulty(bank: BankQuestion[], difficulty: Difficulty) {
  const target = LEVEL_RANK[difficulty];
  return shuffle(bank)
    .filter((b) => b.level === "any" || Math.abs(LEVEL_RANK[b.level] - target) <= 1)
    .sort((a, b) => {
      const da = a.level === "any" ? 0.5 : Math.abs(LEVEL_RANK[a.level] - target);
      const dbb = b.level === "any" ? 0.5 : Math.abs(LEVEL_RANK[b.level] - target);
      return da - dbb;
    });
}

// ---------------------------------------------------------------------------
// Development engine (no AI key): curated bank + real personalisation
// ---------------------------------------------------------------------------

export function generateFromBank(ctx: InterviewContext): GeneratedQuestion[] {
  const s = interviewStructure(ctx.type, ctx.duration);
  const out: GeneratedQuestion[] = [];
  if (s.intro) out.push(toGenerated(INTRO_QUESTIONS[0], ctx));
  if (s.motivation) out.push(toGenerated(MOTIVATION_QUESTIONS[0], ctx));

  // Behavioral: start with a resume-grounded question when we have one.
  const behavioral: GeneratedQuestion[] = [];
  const highlight = resumeHighlights(ctx.resumeText, 1)[0];
  if (s.behavioral > 0 && highlight) {
    behavioral.push({
      text: `On your resume you mention: "${highlight}". Walk me through that — what was your specific role, and what was the outcome?`,
      category: "behavioral",
      difficulty: ctx.difficulty,
      whatItTests: "Depth and ownership of resume experience",
      competencies: ["ownership", "communication", "impact"],
      followUps: ["What would you do differently if you did it again?", "How did you measure whether it worked?"],
      gradingCriteria: ["Explains personal contribution clearly", "Quantifies the outcome", "Can go deeper than the resume line"],
      keywords: ["I", "role", "result", "impact", "learned", "team", "measured"],
    });
  }
  for (const b of byDifficulty(BEHAVIORAL_BANK, ctx.difficulty)) {
    if (behavioral.length >= s.behavioral) break;
    behavioral.push(toGenerated(b, ctx));
  }
  out.push(...behavioral);

  // Technical: role-specific bank, plus a JD-skill question when the JD names skills.
  const technical: GeneratedQuestion[] = [];
  const skill = jobSkills(ctx.jobDescription, 1)[0];
  if (s.technical > 1 && skill) {
    technical.push({
      text: `This role calls for ${skill}. Tell me about the most substantial thing you've done with ${skill} — what was the problem, your approach, and the result?`,
      category: "role",
      difficulty: ctx.difficulty,
      whatItTests: `Hands-on depth with ${skill} (from the job description)`,
      competencies: [skill, "role knowledge", "problem solving"],
      followUps: [`What was the hardest part of that work with ${skill}?`, "What would you improve about your approach now?"],
      gradingCriteria: ["Concrete, verifiable detail", "Demonstrates real depth, not buzzwords", "Explains reasoning behind choices"],
      keywords: [skill, "approach", "result", "because", "problem"],
    });
  }
  const bank = [...byDifficulty(TECHNICAL_BANK[ctx.roleCategory] ?? [], ctx.difficulty), ...byDifficulty(TECHNICAL_BANK.general, ctx.difficulty)];
  for (const b of bank) {
    if (technical.length >= s.technical) break;
    technical.push(toGenerated(b, ctx));
  }
  out.push(...technical);

  if (s.candidateQuestions) out.push(toGenerated(CANDIDATE_QUESTIONS, ctx));
  return out.slice(0, s.total);
}

// ---------------------------------------------------------------------------
// AI engine
// ---------------------------------------------------------------------------

const GeneratedSchema = z.object({
  questions: z.array(
    z.object({
      question: z.string(),
      category: z.enum(["intro", "behavioral", "technical", "role", "coding", "case", "candidate_questions"]),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]),
      what_it_tests: z.string(),
      competencies: z.array(z.string()),
      follow_up_questions: z.array(z.string()),
      grading_criteria: z.array(z.string()),
      key_concepts: z.array(z.string()),
    }),
  ),
});

const QUESTION_SYSTEM = `You are the interview design engine for Interview Connect, a platform where college students and early-career job seekers practice realistic job interviews.

You design a complete, customized interview plan. The plan is used either by an AI interviewer or handed to a human interviewer as their interview guide; the candidate never sees the plan in advance.

Principles:
- Questions must sound like a real interviewer at a real company would ask them — natural spoken language, one question at a time, no multi-part lists.
- Customize to the candidate: reference concrete items from their resume and the job description when it adds realism, but never invent facts about the candidate.
- Match the role: e.g. investment banking → accounting, valuation, DCF, M&A; product management → product sense, metrics, prioritization, strategy; software engineering → algorithms, data structures, systems, coding approach; consulting → case structuring, market sizing, quantitative reasoning; marketing → strategy, consumer behavior, analytics.
- Match the difficulty and the candidate's experience level.
- For each question give what it tests, 2 natural follow-ups an interviewer could ask, and 3–4 concrete grading criteria a grader can check against the transcript, and the key concepts/terms a strong answer would cover.`;

function aiPrompt(ctx: InterviewContext) {
  const s = interviewStructure(ctx.type, ctx.duration);
  const structure =
    ctx.type === "behavioral"
      ? `A behavioral interview of exactly ${s.total} questions: 1 motivation question ("why this role/company"), then ${s.behavioral} behavioral questions probing different competencies (leadership, teamwork, conflict, failure, adaptability, decision making, communication). Use at least one question grounded in the resume if a resume is provided.`
      : ctx.type === "technical"
        ? `A technical interview of exactly ${s.total} role-specific questions for a ${roleCategoryLabel(ctx.roleCategory)} role, progressing from fundamentals to harder applied problems/cases.`
        : `A full, realistic interview of exactly ${s.total} questions in this order: 1 "tell me about yourself" intro, 1 motivation question, ${s.behavioral} behavioral questions, ${s.technical} role-specific/technical questions (balance appropriate for a ${roleCategoryLabel(ctx.roleCategory)} role), and finally 1 question inviting the candidate's own questions (category candidate_questions).`;
  return [
    `Design the interview plan.`,
    ``,
    `<structure>${structure}</structure>`,
    `<interview>`,
    `Mode: ${ctx.mode === "ai" ? "conducted by an AI interviewer" : "conducted by a human interviewer using your guide"}`,
    `Target role: ${ctx.targetRole}`,
    `Role category: ${roleCategoryLabel(ctx.roleCategory)}`,
    `Company: ${ctx.company || "not specified"}`,
    `Difficulty: ${ctx.difficulty}`,
    `Duration: ${ctx.duration} minutes`,
    `</interview>`,
    `<candidate>`,
    `Experience level: ${ctx.experienceLevel ?? "unknown"}`,
    `School / major: ${[ctx.school, ctx.major].filter(Boolean).join(", ") || "unknown"}`,
    `Target industry: ${ctx.targetIndustry ?? "unknown"}`,
    `</candidate>`,
    ctx.jobDescription ? `<job_description>\n${ctx.jobDescription}\n</job_description>` : `<job_description>none provided</job_description>`,
    ctx.resumeText ? `<resume>\n${ctx.resumeText}\n</resume>` : `<resume>none provided</resume>`,
  ].join("\n");
}

export async function generateQuestionPlan(ctx: InterviewContext): Promise<{ engine: "ai" | "fallback"; questions: GeneratedQuestion[] }> {
  if (isAiConfigured()) {
    try {
      const result = await generateStructured({ system: QUESTION_SYSTEM, prompt: aiPrompt(ctx), schema: GeneratedSchema, effort: "medium" });
      const expected = interviewStructure(ctx.type, ctx.duration).total;
      const questions = result.questions.slice(0, expected).map((qq) => ({
        text: qq.question,
        category: qq.category,
        difficulty: qq.difficulty,
        whatItTests: qq.what_it_tests,
        competencies: qq.competencies.slice(0, 6),
        followUps: qq.follow_up_questions.slice(0, 3),
        gradingCriteria: qq.grading_criteria.slice(0, 5),
        keywords: qq.key_concepts.slice(0, 12),
      }));
      if (questions.length >= Math.min(3, expected)) return { engine: "ai", questions };
      console.warn("[ai] question plan too short, using development engine");
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) console.error("[ai] question generation failed, using development engine", err);
    }
  }
  return { engine: "fallback", questions: generateFromBank(ctx) };
}
