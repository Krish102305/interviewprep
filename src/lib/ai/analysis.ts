/**
 * Transparent, deterministic answer analysis. Used by the development grading
 * engine and the fallback follow-up generator. It only reads what the candidate
 * actually said, it never invents content.
 */

const FILLERS = ["um", "uh", "erm", "like", "you know", "basically", "kind of", "sort of", "i mean", "literally", "actually"];
const HEDGES = ["i think maybe", "i guess", "not sure", "i don't know", "probably", "i'm not really", "hopefully", "kind of", "i feel like"];
const PROFANITY = /\b(fuck|shit|damn|bitch|asshole|crap)\b/i;

const STAR = {
  situation: /\b(when i was|at my|during|in my (role|internship|job|class|club)|the situation|we were|our team was|last (year|summer|semester)|there was a|project)\b/i,
  task: /\b(my (goal|job|task|role|responsibility) was|i was responsible|i needed to|i had to|the goal was|we needed to|tasked with|objective)\b/i,
  action: /\b(i (decided|led|built|created|organized|reached out|talked|scheduled|proposed|designed|analyzed|wrote|set up|started|took|spoke|met|asked|focused|implemented|delegated|coordinated|developed|researched|prioritized|volunteered|suggested|made|worked))\b/i,
  result: /\b(as a result|result(ed)?|outcome|in the end|ultimately|which led to|increase[ds]?|decrease[ds]?|reduc(ed|ing)|improv(ed|ing)|grew|saved|won|achieved|learned|delivered|launched|finished|completed)\b|\d+\s?%|\$\s?\d/i,
};

const REASONING = /\b(because|therefore|so that|which means|trade-?off|assum(e|ing|ption)|first|second|then|finally|approach|alternatively|on the other hand|if .* then|given that|the reason)\b/gi;

export type AnswerAnalysis = {
  words: number;
  sentences: number;
  fillerCount: number;
  fillerRate: number;
  hedgeCount: number;
  hasNumbers: boolean;
  star: { situation: boolean; task: boolean; action: boolean; result: boolean };
  starCount: number;
  iStatements: number;
  weStatements: number;
  reasoningMarkers: number;
  keywordHits: string[];
  keywordCoverage: number;
  profanity: boolean;
  nonAnswer: boolean;
};

const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

function countPhrase(text: string, phrase: string) {
  const re = new RegExp(`(^|[^a-z])${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z]|$)`, "g");
  return (text.match(re) ?? []).length;
}

export function analyzeAnswer(answer: string, keywords: string[] = []): AnswerAnalysis {
  const text = normalize(answer);
  const words = text.split(/\s+/).filter(Boolean).length;
  const sentences = Math.max(1, answer.split(/[.!?]+/).filter((s) => s.trim().length > 3).length);
  const fillerCount = FILLERS.reduce((n, f) => n + countPhrase(text, f), 0);
  const hedgeCount = HEDGES.reduce((n, h) => n + countPhrase(text, h), 0);
  const star = {
    situation: STAR.situation.test(answer),
    task: STAR.task.test(answer),
    action: STAR.action.test(answer),
    result: STAR.result.test(answer),
  };
  const kw = keywords.map((k) => k.toLowerCase().trim()).filter((k) => k.length > 1 && k !== "i");
  const keywordHits = kw.filter((k) => text.includes(k));
  return {
    words,
    sentences,
    fillerCount,
    fillerRate: words ? fillerCount / words : 0,
    hedgeCount,
    hasNumbers: /\d/.test(answer),
    star,
    starCount: Object.values(star).filter(Boolean).length,
    iStatements: countPhrase(text, "i"),
    weStatements: countPhrase(text, "we"),
    reasoningMarkers: (answer.match(REASONING) ?? []).length,
    keywordHits,
    keywordCoverage: kw.length ? keywordHits.length / kw.length : 0.5,
    profanity: PROFANITY.test(answer),
    nonAnswer: words < 8 || /^(i don'?t know|no idea|pass|skip|n\/a)\.?$/i.test(answer.trim()),
  };
}

/** A short, verbatim excerpt from the answer, the most concrete sentence available. */
export function excerpt(answer: string, maxWords = 28, keywords: string[] = []) {
  const sentences = answer
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 5);
  const kw = keywords.map((k) => k.toLowerCase()).filter((k) => k.length > 2);
  const pick =
    (kw.length ? sentences.find((s) => kw.some((k) => s.toLowerCase().includes(k))) : undefined) ??
    sentences.find((s) => /\d|result|led|built|decided|because/i.test(s)) ??
    sentences[0] ??
    answer.trim();
  const words = pick.split(/\s+/);
  return words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}…` : pick;
}

/** Normalised containment check, used to reject fabricated AI quotes. */
export function quoteAppearsIn(quote: string, source: string) {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const q = clean(quote.replace(/…$/, ""));
  if (q.length < 8) return false;
  return clean(source).includes(q);
}
