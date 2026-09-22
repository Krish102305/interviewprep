import { z } from "zod";
import { analyzeAnswer } from "./analysis";
import { AiUnavailableError, generateStructured, isAiConfigured } from "./client";

export type QuestionForFollowUp = {
  text: string;
  category: string;
  whatItTests: string;
  followUps: string[];
  gradingCriteria: string[];
  keywords: string[];
};

export type TurnContext = { targetRole: string; company?: string | null; type: string; difficulty: string };

const ACKS = ["Thank you.", "Okay, thanks for walking me through that.", "Got it — thank you.", "Understood.", "Thanks, that's helpful context."];
const ack = () => ACKS[Math.floor(Math.random() * ACKS.length)];

// ---------------------------------------------------------------------------
// Development engine
// ---------------------------------------------------------------------------

/** Rule-based follow-up grounded in what's missing from the actual answer. */
export function ruleBasedFollowUp(question: QuestionForFollowUp, answer: string, alreadyAsked: string[] = []) {
  const a = analyzeAnswer(answer, question.keywords);
  const behavioralLike = ["behavioral", "intro"].includes(question.category);
  const candidates: { text: string; rationale: string }[] = [];

  if (behavioralLike) {
    if (!a.star.result)
      candidates.push({ text: "What was the outcome? If you can, put a number or concrete result on it.", rationale: "No clear result (STAR 'R')." });
    if (a.weStatements > a.iStatements + 1 || !a.star.action)
      candidates.push({ text: "What did you personally do — as opposed to the team?", rationale: "Individual actions were unclear (STAR 'A')." });
    if (!a.star.situation)
      candidates.push({ text: "Can you set the scene a little — where were you and what was at stake?", rationale: "Missing context (STAR 'S')." });
  } else {
    if (a.keywordCoverage < 0.3)
      candidates.push({ text: question.followUps[0] ?? "Can you go one level deeper on how that works?", rationale: "Key concepts were not covered." });
    if (a.reasoningMarkers < 2)
      candidates.push({ text: "Walk me through your reasoning — why that approach over the alternatives?", rationale: "Reasoning was not explained." });
  }
  // Specific gaps first; a generic "more detail" probe only if nothing specific is missing.
  if (a.words < 45) candidates.push({ text: "Could you walk me through that in a bit more detail?", rationale: "The answer was brief." });
  for (const f of question.followUps) candidates.push({ text: f, rationale: `Suggested probe for: ${question.whatItTests}.` });
  candidates.push({ text: "What would you do differently if you faced that again?", rationale: "Tests reflection." });

  const used = new Set(alreadyAsked.map((s) => s.toLowerCase()));
  return candidates.find((c) => !used.has(c.text.toLowerCase())) ?? candidates[candidates.length - 1];
}

function ruleBasedNeedsFollowUp(question: QuestionForFollowUp, answer: string) {
  const a = analyzeAnswer(answer, question.keywords);
  if (a.nonAnswer) return false; // don't badger a candidate who is stuck — move on
  if (["candidate_questions", "closing"].includes(question.category)) return false;
  if (a.words < 45) return true;
  if (["behavioral", "intro"].includes(question.category)) return !a.star.result || !a.star.action;
  return a.keywordCoverage < 0.3 || a.reasoningMarkers < 2;
}

// ---------------------------------------------------------------------------
// AI engine
// ---------------------------------------------------------------------------

const TURN_SYSTEM = `You are a professional, realistic job interviewer on Interview Connect. You are mid-interview. Decide whether to ask ONE follow-up question on the candidate's latest answer or move on to the next planned question.

Ask a follow-up only when it adds real interview value: the answer was vague, missing a result, missing personal actions, skipped the reasoning, or contained something worth probing. Otherwise move on. Keep the follow-up to one natural spoken sentence, grounded in what the candidate actually said.

The acknowledgement is a brief, neutral interviewer phrase ("Thanks.", "Got it.") — real interviewers do not praise or critique answers mid-interview, and never reveal scores.`;

const TurnSchema = z.object({
  action: z.enum(["follow_up", "next"]),
  follow_up: z.string().nullable(),
  acknowledgement: z.string(),
});

export async function decideNextTurn(opts: {
  ctx: TurnContext;
  question: QuestionForFollowUp;
  answer: string;
  followUpsSoFar: string[];
  maxFollowUps: number;
}): Promise<{ action: "follow_up" | "next"; followUp: string | null; acknowledgement: string; engine: "ai" | "fallback" }> {
  if (opts.followUpsSoFar.length >= opts.maxFollowUps || ["candidate_questions", "closing"].includes(opts.question.category))
    return { action: "next", followUp: null, acknowledgement: ack(), engine: isAiConfigured() ? "ai" : "fallback" };

  if (isAiConfigured()) {
    try {
      const r = await generateStructured({
        system: TURN_SYSTEM,
        effort: "low",
        maxTokens: 2000,
        schema: TurnSchema,
        prompt: [
          `<interview>Role: ${opts.ctx.targetRole}${opts.ctx.company ? ` at ${opts.ctx.company}` : ""}. Type: ${opts.ctx.type}. Difficulty: ${opts.ctx.difficulty}.</interview>`,
          `<question tests="${opts.question.whatItTests}">${opts.question.text}</question>`,
          `<grading_criteria>${opts.question.gradingCriteria.join("; ")}</grading_criteria>`,
          opts.followUpsSoFar.length ? `<follow_ups_already_asked>${opts.followUpsSoFar.join(" | ")}</follow_ups_already_asked>` : "",
          `<candidate_answer>${opts.answer}</candidate_answer>`,
        ].join("\n"),
      });
      if (r.action === "follow_up" && r.follow_up?.trim())
        return { action: "follow_up", followUp: r.follow_up.trim(), acknowledgement: r.acknowledgement || ack(), engine: "ai" };
      return { action: "next", followUp: null, acknowledgement: r.acknowledgement || ack(), engine: "ai" };
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) console.error("[ai] turn decision failed, using development engine", err);
    }
  }
  if (ruleBasedNeedsFollowUp(opts.question, opts.answer)) {
    const f = ruleBasedFollowUp(opts.question, opts.answer, opts.followUpsSoFar);
    return { action: "follow_up", followUp: f.text, acknowledgement: ack(), engine: "fallback" };
  }
  return { action: "next", followUp: null, acknowledgement: ack(), engine: "fallback" };
}

const SuggestSchema = z.object({ follow_up: z.string(), rationale: z.string() });

/** "Generate Follow-Up" for human interviewers — always returns a suggestion. */
export async function suggestFollowUp(opts: { ctx: TurnContext; question: QuestionForFollowUp; answer: string; alreadyAsked: string[] }) {
  if (isAiConfigured() && opts.answer.trim()) {
    try {
      const r = await generateStructured({
        system:
          "You help a human interviewer on Interview Connect. Suggest ONE natural follow-up question grounded in the candidate's actual answer that probes the weakest or most interesting part of it, plus a one-sentence rationale for the interviewer.",
        effort: "low",
        maxTokens: 1500,
        schema: SuggestSchema,
        prompt: [
          `<interview>Role: ${opts.ctx.targetRole}. Type: ${opts.ctx.type}.</interview>`,
          `<question tests="${opts.question.whatItTests}">${opts.question.text}</question>`,
          opts.alreadyAsked.length ? `<already_asked>${opts.alreadyAsked.join(" | ")}</already_asked>` : "",
          `<candidate_answer>${opts.answer}</candidate_answer>`,
        ].join("\n"),
      });
      return { text: r.follow_up, rationale: r.rationale, engine: "ai" as const };
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) console.error("[ai] follow-up suggestion failed", err);
    }
  }
  if (!opts.answer.trim()) {
    const text = opts.question.followUps.find((f) => !opts.alreadyAsked.includes(f)) ?? "Could you expand on that?";
    return { text, rationale: "No answer captured yet — this is the plan's suggested probe.", engine: "fallback" as const };
  }
  const f = ruleBasedFollowUp(opts.question, opts.answer, opts.alreadyAsked);
  return { text: f.text, rationale: f.rationale, engine: "fallback" as const };
}

const ReplySchema = z.object({ reply: z.string() });

/** The AI interviewer responds to the candidate's own questions at the end. */
export async function replyToCandidateQuestions(opts: { ctx: TurnContext; answer: string }) {
  if (isAiConfigured()) {
    try {
      const r = await generateStructured({
        system:
          "You are a realistic interviewer wrapping up an Interview Connect practice interview. Briefly and warmly respond to the candidate's questions in 2–4 sentences. You are a practice interviewer, not an employee of the company: do not invent specific facts about the company (salaries, team names, internal details); speak generally about what such roles typically involve and suggest they ask the real recruiter for specifics.",
        effort: "low",
        maxTokens: 1500,
        schema: ReplySchema,
        prompt: `<interview>Role: ${opts.ctx.targetRole}${opts.ctx.company ? ` at ${opts.ctx.company}` : ""}</interview>\n<candidate_questions>${opts.answer}</candidate_questions>`,
      });
      return r.reply;
    } catch (err) {
      if (!(err instanceof AiUnavailableError)) console.error("[ai] candidate reply failed", err);
    }
  }
  return "Those are thoughtful questions — asking them shows you've prepared. Since this is a practice interview, note them down for your real interviewer; they're exactly the kind of questions that leave a good impression.";
}
