import { describe, expect, it } from "vitest";
import { analyzeAnswer, excerpt, quoteAppearsIn } from "@/lib/ai/analysis";
import { generateFromBank, interviewStructure, jobSkills, resumeHighlights } from "@/lib/ai/questions";
import { gradeRetryWithRubric, gradeWithRubric, type QAPair } from "@/lib/ai/grading";
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

describe("house style", () => {
  it("strips em dashes from AI output, deeply", async () => {
    const { withoutEmDashes } = await import("@/lib/ai/client");
    expect(withoutEmDashes({ a: "Got it — thanks.", b: ["x—y", "1–2 minutes"] })).toEqual({ a: "Got it, thanks.", b: ["x, y", "1–2 minutes"] });
  });
});

describe("practice a question again", () => {
  const qa: QAPair = { questionId: "q1", question: "Tell me about a time you led a team.", category: "behavioral", whatItTests: "Leadership", gradingCriteria: [], keywords: [], isFollowUp: false, answer: STRONG_STAR };
  const base = { type: "behavioral" as const, targetRole: "Analyst", roleCategory: "finance", difficulty: "intermediate", originalFeedback: null };
  it("scores a stronger retry higher and explains what improved", () => {
    const weakScore = gradeWithRubric({ ...base, mode: "ai", qa: [{ ...qa, answer: WEAK }] }).questionFeedback[0].score;
    const r = gradeRetryWithRubric({ ...base, qa, originalAnswer: WEAK, originalScore: weakScore });
    expect(r.score).toBeGreaterThan(weakScore);
    expect(r.improved.length).toBeGreaterThan(0);
    expect(r.feedback).toMatch(/improvement/i);
    expect(r.star).toEqual({ situation: true, task: true, action: true, result: true });
  });
  it("uses the same scale as the interview grader", () => {
    const interviewScore = gradeWithRubric({ ...base, mode: "ai", qa: [qa] }).questionFeedback[0].score;
    expect(gradeRetryWithRubric({ ...base, qa, originalAnswer: STRONG_STAR, originalScore: interviewScore }).score).toBe(interviewScore);
  });
});

describe("internship listings", async () => {
  const { isInternship, htmlToText, extractTerm, categorize, normalizeGreenhouse, normalizeLever, normalizeAshby, normalizeCommunity, descriptionLookup } = await import("@/lib/jobs/sources");
  const board = (source: "greenhouse" | "lever" | "ashby") => ({ source, slug: "acme", company: "Acme" });

  it("recognizes internships but not 'internal' roles", () => {
    expect(isInternship("Software Engineer Intern")).toBe(true);
    expect(isInternship("2027 Summer Analyst, Investment Banking")).toBe(true);
    expect(isInternship("Co-op, Data Engineering")).toBe(true);
    expect(isInternship("Internal Audit Lead")).toBe(false);
    expect(isInternship("Research Scientist", "Intern")).toBe(true);
  });
  it("turns escaped HTML into clean text without em dashes", () => {
    const t = htmlToText("&lt;p&gt;About us&lt;/p&gt;&lt;ul&gt;&lt;li&gt;Build things &amp;amp; ship&lt;/li&gt;&lt;li&gt;Learn — fast&lt;/li&gt;&lt;/ul&gt;");
    expect(t).toBe("About us\n\n• Build things & ship\n• Learn, fast");
  });
  it("extracts terms and role categories", () => {
    expect(extractTerm("2027 Summer Intern")).toBe("Summer 2027");
    expect(extractTerm("Intern (Fall '26)")).toBe("Fall 2026");
    expect(extractTerm("Intern", ["Summer 2027"])).toBe("Summer 2027");
    expect(categorize("Software Engineer Intern")).toBe("software_engineering");
    expect(categorize("Hardware Engineering Intern")).toBe("general");
    expect(categorize("Intern, Growth", "Product")).toBe("marketing");
    expect(categorize("Research Intern", "AI/ML/Data")).toBe("data_science");
  });
  it("normalizes each source and keeps only internships with https links", () => {
    const gh = normalizeGreenhouse(board("greenhouse"), { jobs: [
      { id: 1, title: "Software Engineer Intern, Summer 2027", absolute_url: "https://boards.greenhouse.io/acme/jobs/1", location: { name: "NYC" }, first_published: "2026-09-01T00:00:00Z" },
      { id: 2, title: "Staff Engineer", absolute_url: "https://boards.greenhouse.io/acme/jobs/2" },
      { id: 3, title: "Data Intern", absolute_url: "javascript:alert(1)" },
    ] });
    expect(gh).toHaveLength(1);
    expect(gh[0]).toMatchObject({ externalId: "acme:1", company: "Acme", term: "Summer 2027", location: "NYC", roleCategory: "software_engineering" });
    const lv = normalizeLever(board("lever"), [{ id: "x", text: "Product Intern", hostedUrl: "https://jobs.lever.co/acme/x", categories: { location: "Remote" }, descriptionPlain: "Do product things", createdAt: 1790000000000 }]);
    expect(lv[0]).toMatchObject({ roleCategory: "product_management", description: "Do product things" });
    const ab = normalizeAshby(board("ashby"), { jobs: [{ id: "y", title: "ML Research", employmentType: "Intern", jobUrl: "https://jobs.ashbyhq.com/acme/y", isListed: true }, { id: "z", title: "Intern", jobUrl: "https://jobs.ashbyhq.com/acme/z", isListed: false }] });
    expect(ab.map((a) => a.externalId)).toEqual(["acme:y"]);
    const cm = normalizeCommunity([
      { id: "a", active: true, is_visible: true, title: "SWE Intern", company_name: "Beta", url: "https://beta.com/a", locations: ["A", "B", "C", "D"], terms: ["Summer 2027"], category: "Software", date_posted: 1790000000 },
      { id: "b", active: false, title: "Old Intern", company_name: "Beta", url: "https://beta.com/b" },
    ]);
    expect(cm).toHaveLength(1);
    expect(cm[0].location).toBe("A; B; C +1 more");
  });
  it("maps postings to the right reader and never to private addresses", async () => {
    const { isPrivateIp, isPublicHost, jobPostingFromHtml } = await import("@/lib/jobs/sources");
    const look = (url: string, source = "simplify", externalId = "1") => descriptionLookup({ source, externalId, url });
    expect(look("https://acme.wd5.myworkdayjobs.com/en-US/Careers/job/NYC/Intern_R1")).toMatchObject({ kind: "workday", api: "https://acme.wd5.myworkdayjobs.com/wday/cxs/acme/Careers/job/NYC/Intern_R1" });
    expect(look("https://job-boards.greenhouse.io/acme/jobs/123")).toMatchObject({ kind: "greenhouse", api: "https://boards-api.greenhouse.io/v1/boards/acme/jobs/123" });
    expect(look("https://acme.com/careers?gh_jid=9", "greenhouse", "acme:9")).toMatchObject({ api: "https://boards-api.greenhouse.io/v1/boards/acme/jobs/9" });
    expect(look("https://jobs.smartrecruiters.com/Acme/7440000-intern")).toMatchObject({ kind: "smartrecruiters", api: "https://api.smartrecruiters.com/v1/companies/Acme/postings/7440000" });
    expect(look("https://abcd.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/12345")).toMatchObject({ kind: "oracle" });
    expect(look("https://careers.example.com/jobs/1")).toMatchObject({ kind: "page" });
    expect(look("http://169.254.169.254/latest/meta-data")).toBeNull(); // not https, raw IP
    expect(look("https://10.0.0.5/jobs")).toBeNull(); // raw IP
    expect(["10.1.2.3", "127.0.0.1", "169.254.169.254", "172.20.0.1", "192.168.1.1", "100.64.0.1", "::1", "fd00::1", "::ffff:10.0.0.1"].every(isPrivateIp)).toBe(true);
    expect(["8.8.8.8", "151.101.1.1", "2606:4700::1111"].some(isPrivateIp)).toBe(false);
    expect(await isPublicHost("localhost")).toBe(false);
    expect(await isPublicHost("db.railway.internal")).toBe(false);
    expect(jobPostingFromHtml('<script type="application/ld+json">{"@type":"JobPosting","title":"Intern","description":"<p>Build things</p>"}</script>')).toBe("<p>Build things</p>");
    expect(jobPostingFromHtml("<html>no data</html>")).toBeNull();
  });
});
