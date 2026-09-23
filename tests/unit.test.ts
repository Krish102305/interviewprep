import { describe, expect, it } from "vitest";
import { analyzeAnswer, excerpt, quoteAppearsIn } from "@/lib/ai/analysis";
import { generateFromBank, interviewStructure, jobSkills, resumeHighlights } from "@/lib/ai/questions";
import { gradeWithRubric, type QAPair } from "@/lib/ai/grading";
import { ruleBasedFollowUp, transition } from "@/lib/ai/followups";
import { BACKCHANNELS, voiceIdFor } from "@/lib/voice/tts";
import { pickRandom } from "@/lib/services/matching";
import { levelFor } from "@/lib/services/gamification";
import { standing } from "@/lib/services/conduct";
import { CATEGORIES_BY_TYPE, INTERVIEW_TYPES, ROLE_CATEGORIES, inferRoleCategory } from "@/lib/constants";
import { createInterviewSchema, signupSchema } from "@/lib/validation";

const STRONG_STAR =
  "When I was treasurer of the finance club, our membership had dropped by half. My goal was to rebuild engagement before recruiting season. I surveyed 60 members and I decided to launch a mock superday series with two alumni. As a result, attendance grew from 15 to 48 and 9 members landed internships. I learned to start with what people need.";
const WEAK = "Um, we basically had some issues and like we worked on it and it kind of worked out I guess.";

describe("answer analysis", () => {
  it("detects STAR components and specifics", () => {
    const a = analyzeAnswer(STRONG_STAR);
    expect(a.star).toEqual({ situation: true, task: true, action: true, result: true });
    expect(a.hasNumbers).toBe(true);
  });
  it("flags filler and hedging in weak answers", () => {
    const a = analyzeAnswer(WEAK);
    expect(a.fillerCount).toBeGreaterThanOrEqual(3);
    expect(a.star.result).toBe(false);
  });
  it("excerpts are verbatim and fabricated quotes are rejected", () => {
    const e = excerpt(STRONG_STAR);
    expect(quoteAppearsIn(e, STRONG_STAR)).toBe(true);
    expect(quoteAppearsIn("I single-handedly tripled revenue at Google", STRONG_STAR)).toBe(false);
  });
});

describe("question generation (development engine)", () => {
  for (const type of INTERVIEW_TYPES)
    for (const cat of ROLE_CATEGORIES)
      it(`${type} × ${cat.value} produces a full plan with hidden metadata`, () => {
        const qs = generateFromBank({ mode: "ai", type, targetRole: `${cat.label} Intern`, roleCategory: cat.value, difficulty: "intermediate", duration: 30 });
        expect(qs).toHaveLength(interviewStructure(type, 30).total);
        for (const q of qs) {
          expect(q.text.length).toBeGreaterThan(10);
          expect(q.text).not.toMatch(/\{role\}|\{atCompany\}/);
          expect(q.whatItTests).toBeTruthy();
          expect(q.gradingCriteria.length).toBeGreaterThan(0);
        }
        if (type === "full") {
          expect(qs[0].category).toBe("intro");
          expect(qs.at(-1)!.category).toBe("candidate_questions");
        }
      });

  it("personalises from resume and job description", () => {
    const resume = "EXPERIENCE\n• Built an automated variance tracker that cut review time by 30% across 4 teams";
    expect(resumeHighlights(resume)[0]).toContain("variance tracker");
    expect(jobSkills("We need strong SQL and financial modeling skills")).toEqual(expect.arrayContaining(["sql", "financial modeling"]));
    const qs = generateFromBank({ mode: "human", type: "full", targetRole: "IB Analyst", roleCategory: "investment_banking", difficulty: "advanced", duration: 60, resumeText: resume, jobDescription: "Requires financial modeling", company: "Evercore" });
    expect(qs.some((q) => q.text.includes("variance tracker"))).toBe(true);
    expect(qs.some((q) => q.text.includes("financial modeling"))).toBe(true);
    expect(qs.some((q) => q.text.includes("Evercore"))).toBe(true);
  });
});

describe("rubric grading", () => {
  const mk = (answer: string, category = "behavioral"): QAPair => ({ questionId: Math.random().toString(), question: "Tell me about a time you led a team.", category, whatItTests: "Leadership", gradingCriteria: ["STAR"], keywords: ["led", "team", "result"], isFollowUp: false, answer });

  it("scores strong answers above weak ones and only grades applicable categories", () => {
    const strong = gradeWithRubric({ type: "behavioral", mode: "ai", targetRole: "Analyst", roleCategory: "finance", difficulty: "intermediate", qa: [mk(STRONG_STAR), mk(STRONG_STAR)] });
    const weak = gradeWithRubric({ type: "behavioral", mode: "ai", targetRole: "Analyst", roleCategory: "finance", difficulty: "intermediate", qa: [mk(WEAK), mk(WEAK)] });
    expect(strong.overallScore).toBeGreaterThan(weak.overallScore + 15);
    expect(Object.keys(strong.scores).sort()).toEqual([...CATEGORIES_BY_TYPE.behavioral].sort());
    expect(strong.engine).toBe("fallback");
  });
  it("explains weaknesses using the real answer, never invented text", () => {
    const r = gradeWithRubric({ type: "behavioral", mode: "ai", targetRole: "Analyst", roleCategory: "finance", difficulty: "beginner", qa: [mk(WEAK)] });
    expect(r.improvements.join(" ")).toMatch(/result/i);
    for (const q of r.questionFeedback) if (q.answerExcerpt) expect(quoteAppearsIn(q.answerExcerpt, WEAK)).toBe(true);
  });
  it("penalises unanswered questions and summarises interviewer feedback without letting it set the score", () => {
    const base = { type: "behavioral" as const, mode: "human" as const, targetRole: "Analyst", roleCategory: "finance", difficulty: "beginner", qa: [mk(STRONG_STAR), mk("")] };
    const a = gradeWithRubric(base);
    const b = gradeWithRubric({ ...base, interviewerFeedback: { strengths: "Amazing, 100/100!", improvements: "" } });
    expect(a.overallScore).toBe(b.overallScore);
    expect(b.interviewerFeedbackSummary).toContain("Amazing");
    expect(a.improvements.join(" ")).toMatch(/unanswered/);
  });
});

describe("follow-ups", () => {
  it("asks for the missing result on a STAR answer without one", () => {
    const f = ruleBasedFollowUp({ text: "Tell me about a conflict", category: "behavioral", whatItTests: "Conflict", followUps: [], gradingCriteria: [], keywords: [] }, "When I was at my internship we disagreed on the project plan so I talked to my teammate and we compromised on the approach we used after that.");
    expect(f.text).toMatch(/outcome|result/i);
  });
});

describe("matching, levels and conduct standing", () => {
  it("random pick stays within the top candidates", () => {
    const ranked = Array.from({ length: 10 }, (_, i) => ({ id: i, score: 100 - i * 5 }));
    for (let i = 0; i < 50; i++) expect(pickRandom(ranked)!.id).toBeLessThan(5);
    expect(pickRandom(ranked, () => 0)!.id).toBe(0);
  });
  it("levels progress with points", () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(500).level).toBe(3);
    expect(levelFor(99999).next).toBeNull();
  });
  it("maps strikes to standing", () => {
    expect(standing(0).label).toBe("Good Standing");
    expect(standing(1).label).toBe("Conduct Warning");
    expect(standing(2).label).toBe("Final Warning");
    expect(standing(3).key).toBe("banned");
    expect(standing(0, "banned").key).toBe("banned");
  });
  it("infers role categories", () => {
    expect(inferRoleCategory("Investment Banking Analyst")).toBe("investment_banking");
    expect(inferRoleCategory("APM")).toBe("product_management");
    expect(inferRoleCategory("Backend Engineer")).toBe("software_engineering");
    expect(inferRoleCategory("Brand Manager")).toBe("marketing");
  });
});

describe("validation (server-side security)", () => {
  it("never accepts admin as a signup role", () => {
    const r = signupSchema.safeParse({ email: "a@b.co", password: "abcdefg1", firstName: "A", role: "admin" });
    expect(r.success).toBe(false);
  });
  it("requires a slot for scheduled human interviews", () => {
    const r = createInterviewSchema.safeParse({ mode: "human", type: "behavioral", targetRole: "PM", difficulty: "beginner", duration: 30, timing: "schedule" });
    expect(r.success).toBe(false);
  });
  it("rejects unsupported durations", () => {
    const r = createInterviewSchema.safeParse({ mode: "ai", type: "behavioral", targetRole: "PM", difficulty: "beginner", duration: 25, timing: "now" });
    expect(r.success).toBe(false);
  });
});

describe("interviewer voice", () => {
  it("gives each persona its own voice, overridable by env", () => {
    const ids = ["ava", "marcus", "elena"].map(voiceIdFor);
    expect(new Set(ids).size).toBe(3);
    expect(voiceIdFor("unknown")).toBe(voiceIdFor("ava"));
    process.env.ELEVENLABS_VOICE_MARCUS = "custom-voice";
    expect(voiceIdFor("marcus")).toBe("custom-voice");
    delete process.env.ELEVENLABS_VOICE_MARCUS;
  });
  it("only allows a fixed set of short reactions", () => {
    expect(Object.values(BACKCHANNELS).every((p) => p.split(" ").length <= 2)).toBe(true);
  });
  it("transitions are empty or end with a space before the next question", () => {
    for (let i = 0; i < 50; i++) expect(transition()).toMatch(/^$|\S $/);
  });
});
