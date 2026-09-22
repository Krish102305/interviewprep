/**
 * Demo data for Interview Connect.
 *
 *   npm run db:seed        (run with the react-server condition — see package.json)
 *
 * All demo accounts use the password "demo1234". Past interviews are graded with
 * the platform's rule-based development rubric (engine = "fallback"), exactly as
 * they would be when no AI key is configured — nothing is hand-scored.
 */
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { generateFromBank, type GeneratedQuestion } from "../src/lib/ai/questions";
import { gradeWithRubric } from "../src/lib/ai/grading";
import { BADGES, POINTS } from "../src/lib/services/gamification";
import { inferRoleCategory, type Difficulty, type InterviewType } from "../src/lib/constants";

const db = new PrismaClient();
const DAY = 86400_000;
const now = Date.now();
const ago = (days: number, hours = 0) => new Date(now - days * DAY - hours * 3600_000);
const ahead = (days: number, hour = 15) => {
  const d = new Date(now + days * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const EMAIL = (n: string) => `${n}@demo.interviewconnect.app`;

// ---------------------------------------------------------------------------
// Realistic answer writer (quality 0–1). Produces the text a candidate "said".
// ---------------------------------------------------------------------------
const STORIES = [
  { ctx: "during my internship at a regional bank", situation: "our analyst team was two people short right before quarter-end reporting", task: "I was responsible for getting the variance analysis done on time", action: "I built a shared tracker, split the work by business line and set up two quick check-ins a day", result: "we delivered two days early and the controller adopted the tracker for the next quarter, cutting review time by about 30%", lesson: "that a little structure early saves a lot of stress later" },
  { ctx: "as treasurer of the finance club", situation: "our membership had dropped by almost half after COVID", task: "my goal was to rebuild engagement before recruiting season", action: "I surveyed 60 members, launched a mock superday series and partnered with two alumni", result: "attendance grew from 15 to 48 people per event and 9 members landed internships", lesson: "to start with what people actually need instead of what I assumed" },
  { ctx: "on a class capstone project", situation: "two teammates strongly disagreed on the product direction and the project stalled for a week", task: "I needed to get us aligned before the midpoint review", action: "I met each of them one on one, wrote up both options with the trade-offs and proposed a quick user test to decide", result: "the test settled it in two days, we finished on schedule and earned the top grade in the section", lesson: "that data is a great way to take ego out of a disagreement" },
  { ctx: "while working part-time at a startup", situation: "our onboarding flow was losing a lot of new users", task: "I took ownership of figuring out why", action: "I analyzed the funnel, interviewed eight users and prototyped a shorter sign-up", result: "activation went up 18% in the first month after launch", lesson: "how much you can learn from just talking to users" },
];

function behavioralAnswer(q: GeneratedQuestion, quality: number, i: number) {
  const s = STORIES[i % STORIES.length];
  if (quality < 0.35) return `Um, I think a time like that was ${s.ctx}. We basically had some issues and, like, we worked on it together and it kind of worked out okay in the end I guess.`;
  if (quality < 0.6)
    return `Sure. ${s.ctx[0].toUpperCase()}${s.ctx.slice(1)}, ${s.situation}. We needed to fix it fast, so we worked together as a team and divided up the tasks. We talked a lot and eventually got it done, and the manager was happy with how it turned out.`;
  if (quality < 0.8)
    return `${s.ctx[0].toUpperCase()}${s.ctx.slice(1)}, ${s.situation}. ${s.task[0].toUpperCase()}${s.task.slice(1)}. ${s.action[0].toUpperCase()}${s.action.slice(1)}. In the end ${s.result.split(" and ")[0]}.`;
  return `When I was ${s.ctx.replace(/^(during|while|as|on) /, "")}, ${s.situation}. ${s.task[0].toUpperCase()}${s.task.slice(1)}. First, I decided to ${s.action.replace(/^I /, "")}. I also made sure everyone knew exactly what they owned. As a result, ${s.result}. Looking back, I learned ${s.lesson}, and I've applied that in every team project since.`;
}

function technicalAnswer(q: GeneratedQuestion, quality: number) {
  const kw = q.keywords.filter((k) => k.length > 1);
  const n = Math.max(1, Math.round(kw.length * quality));
  const used = kw.slice(0, n);
  if (quality < 0.35) return `I'm not totally sure, but I think it has something to do with ${used[0] ?? "the numbers"}. I'd probably look it up.`;
  const steps = used.map((k, i) => `${i === 0 ? "First" : i === used.length - 1 ? "Finally" : "Then"}, I'd consider ${k}`).join(". ");
  return `${quality > 0.7 ? "Let me structure this. " : ""}${steps}. ${quality > 0.6 ? "The reason is that each of those drives the result, so I'd make my assumptions explicit and check the trade-off at each step. " : ""}${quality > 0.8 ? "For example, if the inputs changed by 10%, I'd sanity check how sensitive the answer is before concluding." : ""}`.trim();
}

function answerFor(q: GeneratedQuestion, quality: number, i: number, company?: string | null) {
  if (q.category === "intro")
    return quality > 0.6
      ? `I'm a senior studying economics with a minor in computer science. Last summer I interned at a regional bank where I built reporting tools, and on campus I lead our finance club. Those experiences showed me I love solving business problems with data, which is exactly why I'm excited about this role${company ? ` at ${company}` : ""}.`
      : "I'm a student, I study economics and I've done an internship. I'm interested in this job because it seems interesting.";
  if (q.category === "candidate_questions")
    return quality > 0.5 ? "What does success look like for someone in this role after the first six months? And how does the team give feedback to new analysts?" : "No, I think you covered everything.";
  if (["behavioral"].includes(q.category) || /why are you interested/i.test(q.text))
    return /why are you interested/i.test(q.text)
      ? quality > 0.6
        ? `Because the role combines analytical work with real client impact. I've researched ${company ?? "the team"} and the way you invest in analyst training stands out, and my internship experience building models maps directly to the day-to-day work.`
        : "It seems like a good opportunity and I want to learn a lot."
      : behavioralAnswer(q, quality, i);
  return technicalAnswer(q, quality);
}

// ---------------------------------------------------------------------------

async function main() {
  console.log("Resetting demo data…");
  // Order matters for FK constraints in SQLite.
  for (const m of [
    "rtcSignal", "analyticsEvent", "rateLimit", "adminAction", "appeal", "strike", "conductReport", "conductEvent", "technicalEvent", "notification", "userBadge", "badge",
    "pointsEntry", "availability", "match", "interviewerRating", "interviewerNote", "aiEvaluation", "interviewFeedback", "transcriptEntry", "interviewSession", "interviewAnswer",
    "interviewQuestion", "interview", "jobDescription", "resume", "studentProfile", "interviewerProfile", "profile", "oAuthAccount", "session", "user",
  ] as const) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (db as any)[m].deleteMany();
  }

  for (const b of BADGES) await db.badge.create({ data: b });
  const badgeId = async (key: string) => (await db.badge.findUniqueOrThrow({ where: { key } })).id;
  const passwordHash = await bcrypt.hash("demo1234", 10);

  const mkUser = async (o: { key: string; role: string; first: string; last: string; tz?: string; status?: string; createdDaysAgo?: number; bio?: string; location?: string }) =>
    db.user.create({
      data: {
        email: EMAIL(o.key),
        passwordHash,
        role: o.role,
        accountStatus: o.status ?? "active",
        onboardedAt: ago(o.createdDaysAgo ?? 40),
        createdAt: ago(o.createdDaysAgo ?? 40),
        lastActiveAt: ago(Math.random() * 3),
        profile: { create: { firstName: o.first, lastName: o.last, timezone: o.tz ?? "America/New_York", bio: o.bio, location: o.location } },
      },
    });

  // --- Admin ---------------------------------------------------------------
  const admin = await mkUser({ key: "admin", role: "admin", first: "Avery", last: "Admin" });

  // --- Interviewers --------------------------------------------------------
  const interviewers = {
    priya: await mkUser({ key: "priya", role: "interviewer", first: "Priya", last: "Shah", tz: "America/Los_Angeles", bio: "Senior PM who has run 200+ product interviews. I love helping students tell sharper stories.", location: "San Francisco, CA" }),
    marcus: await mkUser({ key: "marcus", role: "interviewer", first: "Marcus", last: "Johnson", bio: "Former IB associate, now in private equity. Happy to grill you on technicals.", location: "New York, NY" }),
    elena: await mkUser({ key: "elena", role: "interviewer", first: "Elena", last: "Garcia", tz: "America/Chicago", bio: "Engagement manager. Cases, market sizing and structured thinking.", location: "Chicago, IL" }),
    chris: await mkUser({ key: "chris", role: "interviewer", first: "Chris", last: "Lee", bio: "Senior at Michigan, finance club VP. Peer mock interviews for recruiting season.", location: "Ann Arbor, MI" }),
    devon: await mkUser({ key: "devon", role: "interviewer", first: "Devon", last: "Wright", tz: "America/Denver", bio: "CS senior who's done 3 SWE internships.", location: "Boulder, CO" }),
  };
  const ip = [
    { u: interviewers.priya, t: "professional", title: "Senior Product Manager", company: "Series C fintech", industry: "Technology", years: 8, roles: ["product_management", "software_engineering", "general"], now: true },
    { u: interviewers.marcus, t: "alumni", title: "Private Equity Associate (ex-IB)", company: null, industry: "Finance", years: 6, roles: ["investment_banking", "finance", "general"], now: false },
    { u: interviewers.elena, t: "professional", title: "Engagement Manager", company: "Management consultancy", industry: "Consulting", years: 7, roles: ["consulting", "general", "marketing"], now: false },
    { u: interviewers.chris, t: "student", title: "Finance Club VP, University of Michigan", company: null, industry: "Finance", years: 1, roles: ["finance", "investment_banking", "general", "marketing"], now: true },
    { u: interviewers.devon, t: "student", title: "CS Senior, 3x SWE intern", company: null, industry: "Technology", years: 1, roles: ["software_engineering", "data_science", "general"], now: false },
  ];
  for (const p of ip)
    await db.interviewerProfile.create({
      data: { userId: p.u.id, interviewerType: p.t, title: p.title, company: p.company, industry: p.industry, yearsExperience: p.years, roles: JSON.stringify(p.roles), interviewTypes: JSON.stringify(["behavioral", "technical", "full"]), weeklyLimit: 8, availableNow: p.now, availableNowAt: p.now ? new Date() : null },
    });

  // Availability slots over the next two weeks
  for (const p of ip)
    for (const d of [1, 2, 3, 5, 6, 8, 9, 12])
      await db.availability.create({ data: { interviewerId: p.u.id, startsAt: ahead(d, 10 + (d % 5) * 2), endsAt: new Date(ahead(d, 10 + (d % 5) * 2).getTime() + 60 * 60_000), timezone: "America/New_York" } });

  // --- Students --------------------------------------------------------------
  const studentDefs = [
    { key: "maya", first: "Maya", last: "Rodriguez", school: "University of Michigan", major: "Economics", year: 2026, industry: "Finance", roles: ["Investment Banking Analyst", "Product Manager Intern"], companies: ["Goldman Sachs", "Evercore", "Stripe"], exp: "intern", status: "active" },
    { key: "jordan", first: "Jordan", last: "Kim", school: "Georgia Tech", major: "Computer Science", year: 2027, industry: "Technology", roles: ["Software Engineer Intern"], companies: ["Google", "Datadog"], exp: "intern", status: "active" },
    { key: "alex", first: "Alex", last: "Chen", school: "NYU Stern", major: "Finance", year: 2026, industry: "Finance", roles: ["Equity Research Analyst", "Investment Banking Analyst"], companies: ["J.P. Morgan"], exp: "intern", status: "active" },
    { key: "sam", first: "Sam", last: "Patel", school: "Rutgers University", major: "Business Analytics", year: 2025, industry: "Consulting", roles: ["Consulting Analyst"], companies: ["Deloitte"], exp: "entry", status: "banned" },
    { key: "taylor", first: "Taylor", last: "Brooks", school: "UT Austin", major: "Marketing", year: 2027, industry: "Marketing", roles: ["Marketing Associate", "Brand Management Intern"], companies: ["Procter & Gamble"], exp: "entry", status: "active" },
    { key: "noah", first: "Noah", last: "Williams", school: "UC Berkeley", major: "Data Science", year: 2026, industry: "Technology", roles: ["Data Analyst", "Product Manager Intern"], companies: ["Airbnb"], exp: "junior", status: "active" },
  ];
  const students: Record<string, Awaited<ReturnType<typeof mkUser>>> = {};
  for (const s of studentDefs) {
    const u = await mkUser({ key: s.key, role: "student", first: s.first, last: s.last, status: s.status, createdDaysAgo: 45 });
    students[s.key] = u;
    await db.studentProfile.create({
      data: {
        userId: u.id, school: s.school, major: s.major, graduationYear: s.year, targetIndustry: s.industry, targetRoles: JSON.stringify(s.roles), experienceLevel: s.exp,
        companies: JSON.stringify(s.companies), goals: JSON.stringify(["internship", "full_time"]), interviewPreferences: JSON.stringify(["behavioral", "technical", "full"]),
      },
    });
    await db.pointsEntry.create({ data: { userId: u.id, amount: POINTS.onboarding, reason: "Completed your profile", createdAt: ago(45) } });
  }

  // Maya's resume (real file in private storage + parsed text)
  const resumeText = `MAYA RODRIGUEZ\nUniversity of Michigan — B.A. Economics, minor in Computer Science (2026)\n\nEXPERIENCE\nSummer Analyst, Great Lakes Regional Bank\n• Built an automated variance-analysis tracker in Excel/VBA that cut quarter-end review time by 30%\n• Analyzed loan portfolio performance across 4 business lines and presented findings to the CFO\n\nTreasurer, Michigan Finance Club\n• Led a rebuild of member programming, growing event attendance from 15 to 48 members\n• Organized a 6-week mock superday series with 2 alumni partners\n\nPROJECTS\n• Developed a DCF model for a mid-cap retailer as part of a student investment fund pitch\n\nSKILLS\nExcel, financial modeling, valuation, SQL, Python, PowerPoint`;
  const storageDir = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), "storage"), "resumes");
  await fs.mkdir(storageDir, { recursive: true });
  const resumeFile = `${crypto.randomUUID()}.txt`;
  await fs.writeFile(path.join(storageDir, resumeFile), resumeText, { mode: 0o600 });
  const mayaResume = await db.resume.create({ data: { userId: students.maya.id, fileName: "Maya_Rodriguez_Resume.txt", mimeType: "text/plain", sizeBytes: resumeText.length, storagePath: `resumes/${resumeFile}`, parsedText: resumeText, isDefault: true, createdAt: ago(44) } });
  await db.pointsEntry.create({ data: { userId: students.maya.id, amount: POINTS.resumeUpload, reason: "Uploaded your resume", createdAt: ago(44) } });

  // --- Past interviews -------------------------------------------------------
  type Past = { student: string; mode: "ai" | "human"; type: InterviewType; role: string; company?: string; difficulty: Difficulty; duration: number; daysAgo: number; quality: number; interviewer?: keyof typeof interviewers; feedback?: [string, string]; rating?: [number, number, number, number, string?] };
  const past: Past[] = [
    { student: "maya", mode: "ai", type: "behavioral", role: "Investment Banking Analyst", company: "Evercore", difficulty: "beginner", duration: 30, daysAgo: 34, quality: 0.45 },
    { student: "maya", mode: "ai", type: "technical", role: "Investment Banking Analyst", company: "Evercore", difficulty: "intermediate", duration: 30, daysAgo: 29, quality: 0.5 },
    { student: "maya", mode: "human", type: "behavioral", role: "Investment Banking Analyst", company: "Goldman Sachs", difficulty: "intermediate", duration: 30, daysAgo: 24, quality: 0.62, interviewer: "chris", feedback: ["Good energy and a clear story about the finance club turnaround.", "Quantify the results earlier and slow down when explaining your role."], rating: [5, 4, 5, 4, "Felt like a real first round."] },
    { student: "maya", mode: "ai", type: "full", role: "Product Manager Intern", company: "Stripe", difficulty: "intermediate", duration: 45, daysAgo: 18, quality: 0.68 },
    { student: "maya", mode: "human", type: "technical", role: "Investment Banking Analyst", company: "Goldman Sachs", difficulty: "advanced", duration: 45, daysAgo: 12, quality: 0.74, interviewer: "marcus", feedback: ["Solid walk-through of the three statements and the DCF.", "Accretion/dilution was shaky — drill the all-stock rule of thumb."], rating: [5, 5, 4, 5, "Tough but fair. Exactly what I needed."] },
    { student: "maya", mode: "ai", type: "behavioral", role: "Investment Banking Analyst", company: "Evercore", difficulty: "advanced", duration: 30, daysAgo: 6, quality: 0.86 },
    { student: "maya", mode: "human", type: "full", role: "Product Manager Intern", company: "Stripe", difficulty: "intermediate", duration: 45, daysAgo: 3, quality: 0.9, interviewer: "priya", feedback: ["Excellent structure and very specific metrics in every story.", "On product sense, spend a bit more time on user segments before jumping to solutions."], rating: [5, 5, 5, 5, "Priya's feedback was incredibly specific."] },
    { student: "maya", mode: "ai", type: "technical", role: "Investment Banking Analyst", company: "Evercore", difficulty: "advanced", duration: 30, daysAgo: 1, quality: 0.83 },
    { student: "jordan", mode: "ai", type: "technical", role: "Software Engineer Intern", company: "Google", difficulty: "intermediate", duration: 30, daysAgo: 20, quality: 0.55 },
    { student: "jordan", mode: "human", type: "technical", role: "Software Engineer Intern", company: "Datadog", difficulty: "intermediate", duration: 45, daysAgo: 9, quality: 0.66, interviewer: "devon", feedback: ["Good complexity analysis.", "Talk through edge cases before coding."], rating: [4, 4, 4, 3] },
    { student: "jordan", mode: "ai", type: "behavioral", role: "Software Engineer Intern", company: "Google", difficulty: "beginner", duration: 15, daysAgo: 4, quality: 0.6 },
    { student: "alex", mode: "ai", type: "technical", role: "Equity Research Analyst", difficulty: "intermediate", duration: 30, daysAgo: 22, quality: 0.58 },
    { student: "alex", mode: "human", type: "behavioral", role: "Investment Banking Analyst", company: "J.P. Morgan", difficulty: "intermediate", duration: 30, daysAgo: 15, quality: 0.5, interviewer: "marcus", feedback: ["Knows the material.", "Stay engaged for the full interview."], rating: [2, 3, 3, 3] },
    { student: "taylor", mode: "ai", type: "behavioral", role: "Marketing Associate", company: "Procter & Gamble", difficulty: "beginner", duration: 15, daysAgo: 10, quality: 0.55 },
    { student: "taylor", mode: "human", type: "full", role: "Brand Management Intern", company: "Procter & Gamble", difficulty: "intermediate", duration: 30, daysAgo: 5, quality: 0.7, interviewer: "elena", feedback: ["Creative campaign ideas with a clear target insight.", "Tie ideas back to measurable KPIs."], rating: [5, 4, 5, 5, "Great practice."] },
    { student: "noah", mode: "ai", type: "full", role: "Data Analyst", company: "Airbnb", difficulty: "intermediate", duration: 30, daysAgo: 8, quality: 0.72 },
    { student: "noah", mode: "human", type: "technical", role: "Product Manager Intern", company: "Airbnb", difficulty: "intermediate", duration: 30, daysAgo: 2, quality: 0.78, interviewer: "priya", feedback: ["Great metrics instincts.", "Prioritization framework could be more explicit."], rating: [5, 5, 4, 5] },
    { student: "sam", mode: "ai", type: "behavioral", role: "Consulting Analyst", company: "Deloitte", difficulty: "beginner", duration: 15, daysAgo: 30, quality: 0.4 },
  ];

  const created: Record<string, string[]> = {};
  for (const [idx, p] of past.entries()) {
    const student = students[p.student];
    const sp = await db.studentProfile.findUniqueOrThrow({ where: { userId: student.id } });
    const roleCategory = inferRoleCategory(p.role, sp.targetIndustry);
    const questions = generateFromBank({
      mode: p.mode, type: p.type, targetRole: p.role, roleCategory, company: p.company, difficulty: p.difficulty, duration: p.duration,
      resumeText: p.student === "maya" ? resumeText : null, jobDescription: null, experienceLevel: sp.experienceLevel,
    });
    const started = ago(p.daysAgo, 2);
    const completed = new Date(started.getTime() + p.duration * 60_000);
    const iv = await db.interview.create({
      data: {
        studentId: student.id, interviewerId: p.interviewer ? interviewers[p.interviewer].id : null, mode: p.mode, type: p.type, targetRole: p.role, roleCategory, company: p.company ?? null,
        resumeId: p.student === "maya" ? mayaResume.id : null, difficulty: p.difficulty, duration: p.duration, status: "completed", matchStatus: p.interviewer ? "matched" : "unmatched",
        questionStatus: "ready", questionEngine: "fallback", gradingStatus: "completed", currentQuestionIndex: questions.length - 1, scheduledAt: started, startedAt: started, completedAt: completed, createdAt: ago(p.daysAgo + 1),
        recordingConsent: true,
      },
    });
    (created[p.student] ??= []).push(iv.id);
    let t = started.getTime();
    const tick = (s: number) => new Date((t += s * 1000));
    if (p.mode === "ai")
      await db.transcriptEntry.create({ data: { interviewId: iv.id, speaker: "interviewer", kind: "intro", text: `Hi ${student.email.split("@")[0].replace(/^./, (c) => c.toUpperCase())}, I'm Ava, and I'll be your interviewer today. Let's begin.`, source: "ai", createdAt: tick(0) } });
    const qa = [];
    for (const [i, q] of questions.entries()) {
      const qRow = await db.interviewQuestion.create({
        data: { interviewId: iv.id, order: i, category: q.category, text: q.text, difficulty: q.difficulty, whatItTests: q.whatItTests, competencies: JSON.stringify(q.competencies), followUps: JSON.stringify(q.followUps), gradingCriteria: JSON.stringify(q.gradingCriteria), keywords: JSON.stringify(q.keywords), askedAt: tick(20), createdAt: iv.createdAt },
      });
      // Quality varies a little per question for realism.
      const qq = Math.max(0.1, Math.min(1, p.quality + ((i * 37 + idx * 11) % 20) / 100 - 0.1));
      const answer = answerFor(q, qq, i + idx, p.company);
      await db.transcriptEntry.create({ data: { interviewId: iv.id, speaker: "interviewer", kind: "question", text: q.text, questionId: qRow.id, source: p.mode === "ai" ? "ai" : "guide", createdAt: tick(5) } });
      await db.interviewAnswer.create({ data: { interviewId: iv.id, questionId: qRow.id, text: answer, source: "speech", durationSec: 60 + answer.length / 8, createdAt: tick(90) } });
      await db.transcriptEntry.create({ data: { interviewId: iv.id, speaker: "candidate", kind: "answer", text: answer, questionId: qRow.id, source: "speech", createdAt: tick(1) } });
      qa.push({ questionId: qRow.id, question: q.text, category: q.category, whatItTests: q.whatItTests, gradingCriteria: q.gradingCriteria, keywords: q.keywords, isFollowUp: false, answer });
    }
    const feedback = p.feedback && p.interviewer ? { strengths: p.feedback[0], improvements: p.feedback[1], notes: null } : null;
    if (feedback && p.interviewer) {
      await db.interviewFeedback.create({ data: { interviewId: iv.id, interviewerId: interviewers[p.interviewer].id, ...feedback, createdAt: completed } });
      await db.interviewerNote.create({ data: { interviewId: iv.id, interviewerId: interviewers[p.interviewer].id, text: p.feedback![1], createdAt: completed } });
    }
    const ev = gradeWithRubric({ type: p.type, mode: p.mode, targetRole: p.role, roleCategory, company: p.company, difficulty: p.difficulty, qa, interviewerFeedback: feedback });
    await db.aiEvaluation.create({
      data: {
        interviewId: iv.id, engine: ev.engine, model: ev.model, overallScore: ev.overallScore,
        communication: ev.scores.communication ?? null, confidence: ev.scores.confidence ?? null, answerStructure: ev.scores.answerStructure ?? null, technicalKnowledge: ev.scores.technicalKnowledge ?? null,
        problemSolving: ev.scores.problemSolving ?? null, roleKnowledge: ev.scores.roleKnowledge ?? null, professionalism: ev.scores.professionalism ?? null, behavioral: ev.scores.behavioral ?? null,
        summary: ev.summary, strengths: JSON.stringify(ev.strengths), improvements: JSON.stringify(ev.improvements), questionFeedback: JSON.stringify(ev.questionFeedback),
        recommendation: JSON.stringify(
          p.quality > 0.8
            ? { title: "Add real interview pressure", detail: "You're scoring well — keep stretching with advanced human interviews.", mode: "human", type: "full" }
            : { title: "Practice STAR-structured stories", detail: "End every story with a specific, measurable result.", mode: "ai", type: "behavioral" },
        ),
        interviewerFeedbackSummary: ev.interviewerFeedbackSummary, createdAt: completed,
      },
    });
    await db.interview.update({ where: { id: iv.id }, data: { overallScore: ev.overallScore } });
    await db.pointsEntry.create({ data: { userId: student.id, amount: p.mode === "human" ? POINTS.humanInterview : POINTS.aiInterview, reason: `Completed a ${p.mode === "human" ? "human" : "AI"} ${p.type} interview`, interviewId: iv.id, createdAt: completed } });
    await db.notification.create({ data: { userId: student.id, type: "feedback_ready", title: "Your interview feedback is ready", body: `You scored ${ev.overallScore}/100 on your ${p.role} interview.`, link: `/interviews/${iv.id}/results`, readAt: p.daysAgo > 2 ? completed : null, createdAt: completed } });
    await db.analyticsEvent.createMany({
      data: [
        { name: "interview_created", userId: student.id, properties: JSON.stringify({ mode: p.mode, type: p.type }), createdAt: iv.createdAt },
        { name: "interview_completed", userId: student.id, properties: JSON.stringify({ mode: p.mode, type: p.type }), createdAt: completed },
        { name: "grading_completed", userId: student.id, properties: JSON.stringify({ engine: "fallback" }), createdAt: completed },
      ],
    });
    if (p.interviewer) {
      const iid = interviewers[p.interviewer].id;
      await db.match.create({ data: { interviewId: iv.id, interviewerId: iid, score: 70, status: "accepted", reasons: JSON.stringify(["Booked availability slot"]), createdAt: iv.createdAt } });
      await db.pointsEntry.create({ data: { userId: iid, amount: POINTS.conductInterview, reason: "Conducted a practice interview", interviewId: iv.id, createdAt: completed } });
      if (p.feedback) await db.pointsEntry.create({ data: { userId: iid, amount: POINTS.qualityFeedback, reason: "Gave detailed interview feedback", interviewId: iv.id, createdAt: completed } });
      if (p.rating) await db.interviewerRating.create({ data: { interviewId: iv.id, studentId: student.id, interviewerId: iid, professionalism: p.rating[0], realism: p.rating[1], communication: p.rating[2], feedbackQuality: p.rating[3], comment: p.rating[4] ?? null, createdAt: completed } });
      await db.analyticsEvent.create({ data: { name: "feedback_submitted", userId: iid, createdAt: completed } });
    }
  }

  // Streaks, badges and bonus points for Maya (earned through her history).
  await db.studentProfile.update({ where: { userId: students.maya.id }, data: { currentStreak: 2, longestStreak: 4, lastPracticeDate: ago(1) } });
  await db.studentProfile.update({ where: { userId: students.noah.id }, data: { currentStreak: 1, longestStreak: 2, lastPracticeDate: ago(2) } });
  await db.pointsEntry.createMany({
    data: [
      { userId: students.maya.id, amount: POINTS.improvement, reason: "Improved on your average score", createdAt: ago(6) },
      { userId: students.maya.id, amount: POINTS.improvement, reason: "Improved on your average score", createdAt: ago(3) },
      { userId: students.maya.id, amount: POINTS.streakBonus, reason: "2-day practice streak", createdAt: ago(1) },
    ],
  });
  for (const [u, keys] of [
    [students.maya, ["first_interview", "five_interviews", "big_improvement", "all_rounder", "interview_streak"]],
    [students.jordan, ["first_interview"]],
    [students.alex, ["first_interview"]],
    [students.taylor, ["first_interview"]],
    [students.noah, ["first_interview"]],
    [students.sam, ["first_interview"]],
    [interviewers.priya, ["top_interviewer"]],
    [interviewers.marcus, ["feedback_pro"]],
  ] as const)
    for (const k of keys) await db.userBadge.create({ data: { userId: u.id, badgeId: await badgeId(k), awardedAt: ago(Math.random() * 20) } });

  // --- Upcoming & open interviews -------------------------------------------
  const slot = await db.availability.findFirstOrThrow({ where: { interviewerId: interviewers.priya.id, interviewId: null }, orderBy: { startsAt: "asc" } });
  const upcoming = await db.interview.create({
    data: {
      studentId: students.maya.id, interviewerId: interviewers.priya.id, mode: "human", type: "behavioral", targetRole: "Product Manager Intern", roleCategory: "product_management", company: "Stripe",
      resumeId: mayaResume.id, difficulty: "advanced", duration: 45, status: "scheduled", matchStatus: "matched", questionStatus: "ready", questionEngine: "fallback", scheduledAt: slot.startsAt,
    },
  });
  await db.availability.update({ where: { id: slot.id }, data: { interviewId: upcoming.id } });
  await db.match.create({ data: { interviewId: upcoming.id, interviewerId: interviewers.priya.id, score: 0, status: "accepted", reasons: JSON.stringify(["Booked availability slot"]) } });
  const upQs = generateFromBank({ mode: "human", type: "behavioral", targetRole: "Product Manager Intern", roleCategory: "product_management", company: "Stripe", difficulty: "advanced", duration: 45, resumeText });
  await db.interviewQuestion.createMany({ data: upQs.map((q, i) => ({ interviewId: upcoming.id, order: i, category: q.category, text: q.text, difficulty: q.difficulty, whatItTests: q.whatItTests, competencies: JSON.stringify(q.competencies), followUps: JSON.stringify(q.followUps), gradingCriteria: JSON.stringify(q.gradingCriteria), keywords: JSON.stringify(q.keywords) })) });
  await db.notification.createMany({
    data: [
      { userId: students.maya.id, type: "interview_scheduled", title: "Interview scheduled", body: "Your Product Manager Intern interview with Priya S. is booked.", link: `/interviews/${upcoming.id}` },
      { userId: interviewers.priya.id, type: "interview_scheduled", title: "New interview booked", body: "A candidate booked your slot for a Product Manager Intern behavioral interview. Your AI guide is ready.", link: `/interviews/${upcoming.id}` },
    ],
  });

  // Jordan asked for an instant human interview → pending request to Priya.
  const jordanReq = await db.interview.create({
    data: { studentId: students.jordan.id, mode: "human", type: "technical", targetRole: "Software Engineer Intern", roleCategory: "software_engineering", company: "Datadog", difficulty: "intermediate", duration: 30, status: "scheduled", matchStatus: "pending", questionStatus: "ready", questionEngine: "fallback", interviewerPreference: "anyone" },
  });
  const jQs = generateFromBank({ mode: "human", type: "technical", targetRole: "Software Engineer Intern", roleCategory: "software_engineering", difficulty: "intermediate", duration: 30 });
  await db.interviewQuestion.createMany({ data: jQs.map((q, i) => ({ interviewId: jordanReq.id, order: i, category: q.category, text: q.text, difficulty: q.difficulty, whatItTests: q.whatItTests, competencies: JSON.stringify(q.competencies), followUps: JSON.stringify(q.followUps), gradingCriteria: JSON.stringify(q.gradingCriteria), keywords: JSON.stringify(q.keywords) })) });
  await db.match.create({ data: { interviewId: jordanReq.id, interviewerId: interviewers.priya.id, score: 78, status: "pending", reasons: JSON.stringify(["Interviews for Software Engineering", "Runs technical interviews", "Technology background"]) } });
  await db.notification.create({ data: { userId: interviewers.priya.id, type: "interview_request", title: "New interview request", body: "A candidate is looking for a Software Engineer Intern interviewer now.", link: "/interviewer" } });

  // Taylor's open request in the pool (student interviewer preferred).
  const taylorReq = await db.interview.create({
    data: { studentId: students.taylor.id, mode: "human", type: "behavioral", targetRole: "Marketing Associate", roleCategory: "marketing", company: "Procter & Gamble", difficulty: "beginner", duration: 30, status: "scheduled", matchStatus: "unmatched", questionStatus: "ready", questionEngine: "fallback", interviewerPreference: "student" },
  });
  const tQs = generateFromBank({ mode: "human", type: "behavioral", targetRole: "Marketing Associate", roleCategory: "marketing", company: "Procter & Gamble", difficulty: "beginner", duration: 30 });
  await db.interviewQuestion.createMany({ data: tQs.map((q, i) => ({ interviewId: taylorReq.id, order: i, category: q.category, text: q.text, difficulty: q.difficulty, whatItTests: q.whatItTests, competencies: JSON.stringify(q.competencies), followUps: JSON.stringify(q.followUps), gradingCriteria: JSON.stringify(q.gradingCriteria), keywords: JSON.stringify(q.keywords) })) });

  // A no-show on record for Alex (tracked separately, not a strike).
  const noShow = await db.interview.create({
    data: { studentId: students.alex.id, interviewerId: interviewers.chris.id, mode: "human", type: "behavioral", targetRole: "Investment Banking Analyst", roleCategory: "investment_banking", difficulty: "intermediate", duration: 30, status: "no_show", matchStatus: "matched", questionStatus: "ready", scheduledAt: ago(7), noShowUserIds: JSON.stringify([students.alex.id]) },
  });
  await db.analyticsEvent.create({ data: { name: "interview_no_show", userId: interviewers.chris.id, createdAt: ago(7) } });

  // --- Conduct: 0 / 1 / 2 / 3 strikes ------------------------------------------
  async function confirmedStrike(userId: string, n: number, reason: string, description: string, interviewId: string | null, reporterId: string | null, daysAgo: number) {
    const report = await db.conductReport.create({
      data: {
        userId, interviewId, reportedById: reporterId, source: reporterId ? "interviewer" : "system", reason, description, status: "confirmed", reviewedById: admin.id, reviewedAt: ago(daysAgo - 0.5), createdAt: ago(daysAgo),
        evidence: JSON.stringify({ conductEvents: [{ type: reason === "left_interview" ? "left_early" : "no_response", source: "system", at: ago(daysAgo), details: description.slice(0, 80) }], technicalEventsLogged: 0 }),
      },
    });
    await db.analyticsEvent.create({ data: { name: "strike_issued", userId, createdAt: ago(daysAgo - 0.5) } });
    return db.strike.create({ data: { userId, strikeNumber: n, interviewId, reportId: report.id, reason, description, evidence: report.evidence, reviewerId: admin.id, createdAt: ago(daysAgo - 0.5) } });
  }

  // Jordan — 1 strike
  await confirmedStrike(students.jordan.id, 1, "left_interview", "Candidate left the interview room for approximately 8 minutes without explanation and did not return.", created.jordan[1], interviewers.devon.id, 9);
  await db.notification.create({ data: { userId: students.jordan.id, type: "strike_received", title: "Interview Conduct Warning — 1 / 3 strikes", body: "You have received your first confirmed conduct strike (Left Interview). Future confirmed violations can result in additional strikes.", link: "/conduct", createdAt: ago(8.5) } });

  // Alex — 2 strikes, appeal pending on #2
  await confirmedStrike(students.alex.id, 1, "inactivity", "Unresponsive for an extended period during an AI interview after two conduct warnings.", created.alex[0], null, 21);
  const alex2 = await confirmedStrike(students.alex.id, 2, "refused", "Candidate repeatedly refused to answer questions and said they were 'just clicking through'.", created.alex[1], interviewers.marcus.id, 14);
  await db.appeal.create({ data: { strikeId: alex2.id, userId: students.alex.id, reason: "I was dealing with a family emergency", description: "I got an urgent call from home during the interview and couldn't focus. I should have said so, but I wasn't intentionally refusing to participate.", submittedAt: ago(12) } });
  await db.conductReport.update({ where: { id: alex2.reportId! }, data: { status: "appealed" } });
  await db.notification.create({ data: { userId: students.alex.id, type: "strike_received", title: "Final Warning — 2 / 3 strikes", body: "You currently have 2 / 3 confirmed strikes. One additional confirmed conduct violation will result in an account ban from Interview Connect interviews.", link: "/conduct", createdAt: ago(13.5) } });

  // Sam — 3 strikes, banned, appeal pending on #3
  await confirmedStrike(students.sam.id, 1, "disrespectful", "Made insulting comments to the interviewer about their background.", null, interviewers.elena.id, 28);
  await confirmedStrike(students.sam.id, 2, "disruptive", "Played loud music and ignored repeated requests to stop.", null, interviewers.chris.id, 20);
  const sam3 = await confirmedStrike(students.sam.id, 3, "platform_abuse", "Created fake interview requests and no-showed to harass interviewers.", null, interviewers.priya.id, 10);
  await db.appeal.create({ data: { strikeId: sam3.id, userId: students.sam.id, reason: "The requests weren't fake", description: "My roommate used my laptop while I was logged in. I understand the first two strikes but the third wasn't me, and I'd like a chance to prove I can be professional.", submittedAt: ago(8) } });
  await db.conductReport.update({ where: { id: sam3.reportId! }, data: { status: "appealed" } });
  await db.adminAction.create({ data: { adminId: admin.id, action: "ban", targetUserId: students.sam.id, details: "3 confirmed conduct violations", createdAt: ago(9.5) } });
  await db.notification.create({ data: { userId: students.sam.id, type: "account_suspended", title: "Account suspended", body: "Your Interview Connect account has been suspended after 3 confirmed conduct violations. You can review your strike history and submit an appeal.", link: "/conduct", createdAt: ago(9.5) } });

  // Devon (interviewer) — 1 strike; plus a pending report for admins to review
  await confirmedStrike(interviewers.devon.id, 1, "left_interview", "Interviewer ended a scheduled interview after 5 minutes without explanation.", null, null, 16);
  await db.conductReport.create({
    data: {
      userId: interviewers.devon.id, interviewId: created.jordan[1], reportedById: students.jordan.id, source: "participant", reason: "disrespectful", status: "pending", createdAt: ago(1),
      description: "The interviewer made dismissive comments about my school and said I'd 'never get into Google' — it felt unprofessional.",
      evidence: JSON.stringify({ conductEvents: [], technicalEvents: [{ type: "connection_lost", details: "Peer connection disconnected", at: ago(9) }] }),
    },
  });
  // System-generated pending report for Taylor (repeated ignored warnings) — shows AI can only flag.
  await db.conductReport.create({
    data: {
      userId: students.taylor.id, interviewId: created.taylor[0], reportedById: null, source: "system", reason: "inactivity", status: "pending", createdAt: ago(0.5),
      description: "Automated signal: 2 conduct warnings went unacknowledged during this interview. Requires human review before any action.",
      evidence: JSON.stringify({ conductEvents: [{ type: "inactivity", source: "system", at: ago(10), details: "No interaction for 3+ minutes during an active question" }, { type: "warning_issued", source: "system", at: ago(10) }, { type: "no_response", source: "system", at: ago(10) }, { type: "no_response", source: "system", at: ago(10) }], technicalEvents: [{ type: "connection_lost", details: "Recovered after ~240s", at: ago(10) }], note: "Technical events are shown for context; connection problems are not misconduct." }),
    },
  });
  await db.technicalEvent.createMany({ data: [{ userId: students.taylor.id, interviewId: created.taylor[0], type: "connection_lost", details: "Recovered after ~240s", createdAt: ago(10) }, { userId: students.jordan.id, interviewId: created.jordan[1], type: "reconnected", details: "Recovered after ~12s", createdAt: ago(9) }] });

  // --- Analytics backfill ----------------------------------------------------------
  const allUsers = await db.user.findMany();
  await db.analyticsEvent.createMany({ data: allUsers.map((u) => ({ name: "signup", userId: u.id, properties: JSON.stringify({ role: u.role }), createdAt: u.createdAt })) });
  await db.analyticsEvent.createMany({ data: allUsers.filter((u) => u.role !== "admin").map((u) => ({ name: "profile_completed", userId: u.id, createdAt: new Date(u.createdAt.getTime() + 600_000) })) });

  console.log("Seeded demo data:");
  console.log("  Admin        admin@demo.interviewconnect.app");
  console.log("  Students     maya (0 strikes), jordan (1), alex (2, appeal pending), sam (3, banned), taylor, noah");
  console.log("  Interviewers priya, marcus, elena, chris (student), devon (student, 1 strike)");
  console.log("  Password     demo1234");
  void noShow;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
