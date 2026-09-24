/**
 * End-to-end API tests against the real production server (`next start`) and a
 * freshly seeded SQLite database. Requires `npm run build` first.
 *
 *   npm run test:e2e
 */
import { spawn, execSync, type ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PrismaClient } from "@prisma/client";

const PORT = 3107;
const BASE = `http://127.0.0.1:${PORT}`;
const ROOT = path.resolve(__dirname, "..");
// Set E2E_DATABASE_URL=postgresql://… to run the suite against Postgres (the
// database must exist and be empty); defaults to a throwaway SQLite file.
const DB_URL = process.env.E2E_DATABASE_URL || "file:./e2e.db";
const IS_SQLITE = DB_URL.startsWith("file:");
const ENV = {
  ...process.env,
  DATABASE_URL: DB_URL,
  STORAGE_DIR: path.join(ROOT, "storage-e2e"),
  ANTHROPIC_API_KEY: "", // exercise the labelled development engine deterministically
  ANTHROPIC_AUTH_TOKEN: "",
  ELEVENLABS_API_KEY: "", // browser-voice fallback path
  JOBS_SYNC: "off", // no network in tests; listings are inserted directly
  APP_URL: BASE,
  NODE_ENV: "production",
  NEXT_TELEMETRY_DISABLED: "1",
} as NodeJS.ProcessEnv;
const EMAIL = (n: string) => `${n}@demo.interviewconnect.app`;

let server: ChildProcess;
let db: PrismaClient;

class Client {
  cookie = "";
  async req<T = any>(method: string, url: string, body?: unknown, form?: FormData): Promise<{ status: number; data: T }> {
    const res = await fetch(BASE + url, {
      method,
      headers: { ...(this.cookie ? { cookie: this.cookie } : {}), ...(body !== undefined ? { "Content-Type": "application/json" } : {}) },
      body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
      redirect: "manual",
    });
    const set = res.headers.get("set-cookie");
    if (set) {
      const m = set.match(/ic_session=([^;]*)/);
      if (m) this.cookie = `ic_session=${m[1]}`;
    }
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* non-JSON */
    }
    return { status: res.status, data };
  }
  get = <T = any>(u: string) => this.req<T>("GET", u);
  page = async (u: string) => {
    const res = await fetch(BASE + u, { headers: this.cookie ? { cookie: this.cookie } : {}, redirect: "manual" });
    return { status: res.status, html: await res.text() };
  };
  post = <T = any>(u: string, b: unknown = {}) => this.req<T>("POST", u, b);
  async login(email: string, password = "demo1234") {
    const r = await this.post("/api/auth/login", { email, password });
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    return this;
  }
}

async function until<T>(fn: () => Promise<T>, ok: (v: T) => boolean, label: string, timeoutMs = 20000) {
  const start = Date.now();
  let last: T;
  while (Date.now() - start < timeoutMs) {
    last = await fn();
    if (ok(last)) return last;
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${label}: ${JSON.stringify(last!)?.slice(0, 400)}`);
}

async function newStudent(key: string) {
  const c = new Client();
  const s = await c.post("/api/auth/signup", { email: `${key}@test.dev`, password: "testpass1", firstName: key, lastName: "Tester", role: "student" });
  expect(s.status, JSON.stringify(s.data)).toBe(200);
  const o = await c.post("/api/onboarding", {
    firstName: key, lastName: "Tester", school: "State University", major: "Economics", graduationYear: 2027, targetIndustry: "Technology",
    targetRoles: ["Product Manager Intern"], experienceLevel: "intern", companies: [], goals: ["internship"], interviewPreferences: ["behavioral"], timezone: "America/New_York",
  });
  expect(o.status, JSON.stringify(o.data)).toBe(200);
  return c;
}

const GOOD_ANSWER =
  "When I was leading a class project, our team missed an early deadline. My goal was to get us back on track. I decided to split the work, set up daily check-ins and I personally rebuilt the analysis model because it was the bottleneck. As a result we delivered 3 days early and earned the top grade. I learned that clear ownership matters.";

beforeAll(async () => {
  if (!fs.existsSync(path.join(ROOT, ".next", "BUILD_ID"))) throw new Error("Run `npm run build` before the e2e tests.");
  if (IS_SQLITE) {
    // Fresh, throwaway test database owned by this suite.
    fs.rmSync(path.join(ROOT, "prisma", "e2e.db"), { force: true });
    fs.rmSync(path.join(ROOT, "prisma", "e2e.db-journal"), { force: true });
  }
  execSync("node scripts/db.mjs db push --skip-generate", { cwd: ROOT, env: ENV, stdio: "ignore" });
  execSync("npx tsx --conditions=react-server prisma/seed.ts", { cwd: ROOT, env: ENV, stdio: "ignore" });
  process.env.DATABASE_URL = ENV.DATABASE_URL!;
  const { PrismaClient } = await import("@prisma/client");
  db = new PrismaClient({ datasources: { db: { url: IS_SQLITE ? "file:" + path.join(ROOT, "prisma", "e2e.db") : DB_URL } } });
  server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: ROOT, env: ENV, stdio: "ignore" });
  await until(() => fetch(`${BASE}/api/rtc-config`).then((r) => r.status).catch(() => 0), (s) => s === 401, "server start", 60000);
});

afterAll(async () => {
  server?.kill();
  await db?.$disconnect();
  fs.rmSync(ENV.STORAGE_DIR!, { recursive: true, force: true });
});

describe("authentication & roles", () => {
  it("changes a password: needs the current one, signs out other devices", async () => {
    const c = await newStudent("pw-change");
    const other = new Client();
    expect((await other.post("/api/auth/login", { email: "pw-change@test.dev", password: "testpass1" })).status).toBe(200);
    expect((await c.post("/api/profile/password", { currentPassword: "nope", newPassword: "newpass22" })).status).toBe(400);
    expect((await c.post("/api/profile/password", { currentPassword: "testpass1", newPassword: "short" })).status).toBe(400);
    expect((await c.post("/api/profile/password", { currentPassword: "testpass1", newPassword: "newpass22" })).status).toBe(200);
    expect((await c.get("/api/notifications")).status).toBe(200); // this device stays signed in
    expect((await other.get("/api/notifications")).status).toBe(401); // other devices are signed out
    expect((await new Client().post("/api/auth/login", { email: "pw-change@test.dev", password: "testpass1" })).status).toBe(401);
    expect((await new Client().post("/api/auth/login", { email: "pw-change@test.dev", password: "newpass22" })).status).toBe(200);
  });

  it("rejects admin self-signup and bad credentials", async () => {
    const c = new Client();
    expect((await c.post("/api/auth/signup", { email: "x@test.dev", password: "abcdefg1", firstName: "X", role: "admin" })).status).toBe(400);
    expect((await c.post("/api/auth/login", { email: EMAIL("maya"), password: "wrong" })).status).toBe(401);
  });
  it("protects APIs and admin routes server-side", async () => {
    expect((await new Client().get("/api/notifications")).status).toBe(401);
    const maya = await new Client().login(EMAIL("maya"));
    expect((await maya.post("/api/admin/users/whatever", { action: "ban", reason: "trying it" })).status).toBe(403);
    const priya = await new Client().login(EMAIL("priya"));
    expect((await priya.post("/api/interviews", { mode: "ai", type: "behavioral", targetRole: "PM", difficulty: "beginner", duration: 15, timing: "now" })).status).toBe(403);
  });
});

describe("onboarding & resume upload", () => {
  it("uploads and parses a resume, rejects spoofed files", async () => {
    const c = await newStudent("resume");
    const form = new FormData();
    form.append("file", new Blob(["EXPERIENCE\n• Built a pricing dashboard that increased conversion by 12% across 3 markets"], { type: "text/plain" }), "resume.txt");
    const r = await c.req("POST", "/api/resumes", undefined, form);
    expect(r.status, JSON.stringify(r.data)).toBe(200);
    expect(r.data.resume.parsed).toBe(true);
    const bad = new FormData();
    bad.append("file", new Blob(["not really a pdf"], { type: "application/pdf" }), "evil.pdf");
    expect((await c.req("POST", "/api/resumes", undefined, bad)).status).toBe(400);
    // Another user cannot download it.
    const other = await new Client().login(EMAIL("jordan"));
    expect((await other.get(`/api/resumes/${r.data.resume.id}`)).status).toBe(404);
  });
});

describe("AI interviews: behavioral, technical and full", () => {
  for (const type of ["behavioral", "technical", "full"] as const) {
    it(`${type}: one question at a time, follow-ups, completion and AI grading`, async () => {
      const c = await newStudent(`ai-${type}`);
      const created = await c.post("/api/interviews", { mode: "ai", type, targetRole: "Product Manager Intern", company: "Stripe", jobDescription: "We want SQL and user research skills.", difficulty: "intermediate", duration: 15, timing: "now" });
      expect(created.status, JSON.stringify(created.data)).toBe(200);
      const id = created.data.id;
      await until(() => c.get(`/api/interviews/${id}/state`), (r) => r.data.questionStatus === "ready", "question generation");
      const started = await c.post(`/api/interviews/${id}/ai/start`);
      expect(started.status).toBe(200);
      let state = started.data;
      expect(state.guide).toBeUndefined(); // candidate never receives the plan
      expect(state.activeQuestion.whatItTests).toBeUndefined();
      const plan = await db.interviewQuestion.findMany({ where: { interviewId: id, isFollowUp: false }, orderBy: { order: "asc" } });
      expect(JSON.stringify(state)).not.toContain(plan[1].text); // future questions hidden
      if (type === "behavioral") {
        // Voice: falls back to the browser voice without a key, and only the candidate can use the endpoint.
        expect(state.interviewer.naturalVoice).toBe(false);
        const entry = state.transcript.find((t: { speaker: string }) => t.speaker === "interviewer");
        expect((await c.get(`/api/interviews/${id}/tts?entries=${entry.id}`)).status).toBe(503);
        const other = await newStudent("ai-tts-other");
        expect((await other.get(`/api/interviews/${id}/tts?phrase=mhm`)).status).toBe(404);
        expect((await new Client().get(`/api/interviews/${id}/tts?phrase=mhm`)).status).toBe(401);
      }
      let followUps = 0;
      for (let i = 0; i < 30 && state.status === "active"; i++) {
        const r = await c.post(`/api/interviews/${id}/ai/answer`, { questionId: state.activeQuestion.id, text: i % 2 ? GOOD_ANSWER : "We did it together and it went fine.", source: "typed" });
        expect(r.status, JSON.stringify(r.data)).toBe(200);
        state = r.data;
        if (state.activeQuestion?.isFollowUp) followUps++;
      }
      expect(state.status).toBe("completed");
      const iv = await until(() => db.interview.findUniqueOrThrow({ where: { id }, include: { evaluation: true } }), (v) => v.gradingStatus === "completed", "grading");
      expect(iv.evaluation?.engine).toBe("fallback");
      expect(iv.overallScore).toBeGreaterThan(0);
      const transcript = await db.transcriptEntry.count({ where: { interviewId: id, speaker: "candidate" } });
      expect(transcript).toBeGreaterThanOrEqual(plan.length);
      const points = await db.pointsEntry.findMany({ where: { interviewId: id } });
      expect(points.some((p) => p.amount === 100)).toBe(true);
      expect(await db.userBadge.count({ where: { user: { email: `ai-${type}@test.dev` }, badge: { key: "first_interview" } } })).toBe(1);
      if (type === "behavioral") {
        // Practice a question again: graded on the same scale, compared with the original, owner only.
        const ev = await db.aiEvaluation.findUniqueOrThrow({ where: { interviewId: id } });
        const firstQ = JSON.parse(ev.questionFeedback)[0];
        const retry = await c.post(`/api/interviews/${id}/questions/${firstQ.questionId}/retry`, { text: GOOD_ANSWER, source: "typed" });
        expect(retry.status, JSON.stringify(retry.data)).toBe(200);
        expect(retry.data.originalScore).toBe(firstQ.score);
        expect(typeof retry.data.score).toBe("number");
        expect(retry.data.engine).toBe("fallback");
        expect(await db.questionRetry.count({ where: { interviewId: id } })).toBe(1);
        const stranger = await newStudent("ai-retry-other");
        expect((await stranger.post(`/api/interviews/${id}/questions/${firstQ.questionId}/retry`, { text: GOOD_ANSWER })).status).toBe(404);
        expect((await c.post(`/api/interviews/${id}/questions/not-a-question/retry`, { text: GOOD_ANSWER })).status).toBe(404);
        expect((await c.post(`/api/interviews/${id}/questions/${firstQ.questionId}/retry`, { text: "" })).status).toBe(400);
        const page = await c.req("GET", `/interviews/${id}/practice/${firstQ.questionId}`);
        expect(page.status).toBe(200);
      }
      // Double-submit of an old question is rejected.
      expect((await c.post(`/api/interviews/${id}/ai/answer`, { questionId: plan[0].id, text: "again" })).status).toBe(409);
      void followUps;
    });
  }
});

describe("internship listings", () => {
  it("browses real listings and pre-fills the interview setup from one", async () => {
    const job = await db.jobListing.create({
      data: {
        source: "greenhouse", externalId: "acme:1", company: "Acme Robotics", title: "Software Engineer Intern - Summer 2027", location: "New York, NY",
        url: "https://boards.greenhouse.io/acme/jobs/1", term: "Summer 2027", roleCategory: "software_engineering",
        searchText: "acme robotics software engineer intern - summer 2027 new york, ny", description: "Build robot fleet tooling in TypeScript and Go.", descriptionStatus: "ok", postedAt: new Date(),
      },
    });
    await db.jobListing.create({ data: { source: "simplify", externalId: "zz", company: "Closed Co", title: "Old Intern", url: "https://closed.example/1", searchText: "closed co old intern", active: false } });
    const c = await newStudent("jobs-browser");
    const list = await c.page("/jobs?category=all&q=robotics");
    expect(list.status).toBe(200);
    expect(list.html).toContain("Software Engineer Intern - Summer 2027");
    expect(list.html).not.toContain("Old Intern");
    const detail = await c.page(`/jobs/${job.id}`);
    expect(detail.html).toContain("Build robot fleet tooling");
    const setup = await c.page(`/interviews/new?job=${job.id}`);
    expect(setup.html).toContain("Practicing for");
    expect(setup.html).toContain("Acme Robotics");
    expect(setup.html).toContain("Build robot fleet tooling"); // description prefilled
    expect((await new Client().page("/jobs")).status).toBe(307); // signed-out visitors are sent to sign in
  });
});

describe("human interview end-to-end", () => {
  let studentId: string;
  let interviewId: string;
  const student = new Client();
  const priya = new Client();

  it("books a slot and prevents double booking", async () => {
    Object.assign(student, await newStudent("human"));
    await priya.login(EMAIL("priya"));
    const slots = await student.get("/api/interviews/slots?type=behavioral&targetRole=Product%20Manager%20Intern&difficulty=intermediate&duration=30&preference=anyone");
    expect(slots.status).toBe(200);
    const priyaSlots = await db.availability.findMany({ where: { interviewer: { email: EMAIL("priya") }, interviewId: null } });
    const slot = slots.data.slots.find((s: { id: string }) => priyaSlots.some((p) => p.id === s.id));
    expect(slot, "a Priya slot is offered").toBeTruthy();
    expect(JSON.stringify(slots.data)).not.toContain("Priya"); // identity withheld until booking
    const body = { mode: "human", type: "behavioral", targetRole: "Product Manager Intern", difficulty: "intermediate", duration: 30, timing: "schedule", availabilityId: slot.id, interviewerPreference: "anyone" };
    const booked = await student.post("/api/interviews", body);
    expect(booked.status, JSON.stringify(booked.data)).toBe(200);
    interviewId = booked.data.id;
    const rival = await newStudent("rival");
    expect((await rival.post("/api/interviews", body)).status).toBe(409);
    studentId = (await db.user.findUniqueOrThrow({ where: { email: "human@test.dev" } })).id;
  });

  it("gives the interviewer the guide and the candidate nothing in advance", async () => {
    await until(() => priya.get(`/api/interviews/${interviewId}/state`), (r) => r.data.questionStatus === "ready", "guide");
    const iState = (await priya.get(`/api/interviews/${interviewId}/state`)).data;
    expect(iState.guide.length).toBeGreaterThan(0);
    expect(iState.guide[0].whatItTests).toBeTruthy();
    const sState = (await student.get(`/api/interviews/${interviewId}/state`)).data;
    expect(sState.guide).toBeUndefined();
    for (const q of iState.guide) expect(JSON.stringify(sState)).not.toContain(q.text);
    const outsider = await new Client().login(EMAIL("noah"));
    expect((await outsider.get(`/api/interviews/${interviewId}/state`)).status).toBe(404);
  });

  it("starts only when both participants are ready", async () => {
    const dc = { deviceCheck: { camera: true, mic: true, network: "good" }, recordingConsent: true };
    expect((await student.post(`/api/interviews/${interviewId}/ready`, dc)).status).toBe(200);
    expect((await student.get(`/api/interviews/${interviewId}/state`)).data.status).toBe("waiting");
    expect((await priya.post(`/api/interviews/${interviewId}/ready`, dc)).status).toBe(200);
    expect((await student.get(`/api/interviews/${interviewId}/state`)).data.status).toBe("active");
  });

  it("runs the interviewer controls", async () => {
    const guide = (await priya.get(`/api/interviews/${interviewId}/state`)).data.guide;
    expect((await student.post(`/api/interviews/${interviewId}/ask`, { questionId: guide[0].id })).status).toBe(403);
    expect((await priya.post(`/api/interviews/${interviewId}/ask`, { questionId: guide[0].id })).status).toBe(200);
    const s = (await student.get(`/api/interviews/${interviewId}/state`)).data;
    expect(s.activeQuestion.text).toBe(guide[0].text);
    expect(JSON.stringify(s)).not.toContain(guide[1].text);
    expect((await student.post(`/api/interviews/${interviewId}/segment`, { text: GOOD_ANSWER, source: "speech" })).status).toBe(200);
    const fu = await priya.post(`/api/interviews/${interviewId}/follow-up`);
    expect(fu.status).toBe(200);
    expect(fu.data.text.length).toBeGreaterThan(5);
    expect((await priya.post(`/api/interviews/${interviewId}/ask`, { customText: fu.data.text, parentQuestionId: guide[0].id })).status).toBe(200);
    expect((await student.post(`/api/interviews/${interviewId}/segment`, { text: "The result was a 20% lift in retention.", source: "typed" })).status).toBe(200);
    expect((await priya.post(`/api/interviews/${interviewId}/notes`, { text: "Strong structure." })).status).toBe(200);
    expect((await student.get(`/api/interviews/${interviewId}/notes`)).status).toBe(403);
    expect((await priya.post(`/api/interviews/${interviewId}/pause`)).data.paused).toBe(true);
    expect((await priya.post(`/api/interviews/${interviewId}/pause`)).data.paused).toBe(false);
    expect((await priya.post(`/api/interviews/${interviewId}/ask`, { questionId: guide[1].id })).status).toBe(200);
    expect((await student.post(`/api/interviews/${interviewId}/segment`, { text: GOOD_ANSWER, source: "speech" })).status).toBe(200);
  });

  it("handles warnings, technical events and reports without automatic strikes", async () => {
    await priya.post(`/api/interviews/${interviewId}/warning`, { details: "Please focus." });
    expect((await student.get(`/api/interviews/${interviewId}/state`)).data.pendingWarning).toBeTruthy();
    await student.post(`/api/interviews/${interviewId}/conduct`, { type: "warning_acknowledged" });
    expect((await student.get(`/api/interviews/${interviewId}/state`)).data.pendingWarning).toBeNull();
    await student.post(`/api/interviews/${interviewId}/technical`, { type: "connection_lost", details: "wifi" });
    expect(await db.technicalEvent.count({ where: { interviewId } })).toBe(1);
    expect(await db.conductEvent.count({ where: { interviewId, type: "connection_lost" } })).toBe(0);
    expect((await priya.post(`/api/interviews/${interviewId}/report`, { reason: "inactivity", description: "short" })).status).toBe(400);
    expect((await priya.post(`/api/interviews/${interviewId}/report`, { reason: "inactivity", description: "Candidate stopped responding for about five minutes without explanation." })).status).toBe(200);
    expect(await db.conductReport.count({ where: { interviewId, status: "pending" } })).toBe(1);
    expect(await db.strike.count({ where: { userId: studentId } })).toBe(0);
  });

  it("ends, waits for optional feedback, grades with AI and accepts one rating", async () => {
    expect((await priya.post(`/api/interviews/${interviewId}/end`)).status).toBe(200);
    let iv = await db.interview.findUniqueOrThrow({ where: { id: interviewId } });
    expect(["completed", "reported"]).toContain(iv.status);
    expect(iv.gradingStatus).toBe("pending");
    expect((await priya.post(`/api/interviews/${interviewId}/feedback`, { strengths: "Clear, well structured stories with numbers.", improvements: "Slow down and pause before answering." })).status).toBe(200);
    iv = await until(() => db.interview.findUniqueOrThrow({ where: { id: interviewId } }), (v) => v.gradingStatus === "completed", "human grading");
    const ev = await db.aiEvaluation.findUniqueOrThrow({ where: { interviewId } });
    expect(ev.interviewerFeedbackSummary).toContain("Clear, well structured");
    const rating = { professionalism: 5, realism: 4, communication: 5, feedbackQuality: 5 };
    expect((await priya.post(`/api/interviews/${interviewId}/rating`, rating)).status).toBe(403);
    expect((await student.post(`/api/interviews/${interviewId}/rating`, rating)).status).toBe(200);
    expect((await student.post(`/api/interviews/${interviewId}/rating`, rating)).status).toBe(409);
  });
});

describe("instant matching", () => {
  it("proposes to an interviewer who can accept; others cannot double-claim", async () => {
    const c = await newStudent("instant");
    const r = await c.post("/api/interviews", { mode: "human", type: "technical", targetRole: "Software Engineer Intern", difficulty: "intermediate", duration: 30, timing: "now", interviewerPreference: "anyone" });
    expect(r.status).toBe(200);
    const match = await db.match.findFirstOrThrow({ where: { interviewId: r.data.id, status: "pending" }, include: { interviewer: true } });
    const interviewer = await new Client().login(match.interviewer.email);
    const acc = await interviewer.post(`/api/matches/${match.id}`, { action: "accept" });
    expect(acc.status, JSON.stringify(acc.data)).toBe(200);
    const other = await new Client().login(match.interviewer.email === EMAIL("devon") ? EMAIL("priya") : EMAIL("devon"));
    expect((await other.post(`/api/interviewer/claim/${r.data.id}`)).status).toBe(409);
    expect((await db.interview.findUniqueOrThrow({ where: { id: r.data.id } })).matchStatus).toBe("matched");
  });
});

describe("three-strike conduct system", () => {
  it("confirms reports into strikes, bans at 3, allows appeal and restores", async () => {
    const admin = await new Client().login(EMAIL("admin"));
    const student = await new Client().login("human@test.dev", "testpass1");
    const user = await db.user.findUniqueOrThrow({ where: { email: "human@test.dev" } });
    const report = await db.conductReport.findFirstOrThrow({ where: { userId: user.id, status: "pending" } });
    const c1 = await admin.post(`/api/admin/reports/${report.id}`, { decision: "confirm", note: "Evidence supports it" });
    expect(c1.data.strikeNumber).toBe(1);
    expect((await admin.post(`/api/admin/reports/${report.id}`, { decision: "confirm" })).status).toBe(409);
    // Students/interviewers can't modify strikes.
    const s1 = await db.strike.findFirstOrThrow({ where: { userId: user.id } });
    expect((await student.post(`/api/admin/strikes/${s1.id}`, { note: "remove please" })).status).toBe(403);
    await admin.post(`/api/admin/users/${user.id}`, { action: "add_strike", reason: "Disrupted a second interview" });
    expect((await db.notification.findFirst({ where: { userId: user.id, title: { contains: "Final Warning" } } }))).toBeTruthy();
    await admin.post(`/api/admin/users/${user.id}`, { action: "add_strike", reason: "Harassed an interviewer" });
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).accountStatus).toBe("banned");
    const blocked = await student.post("/api/interviews", { mode: "ai", type: "behavioral", targetRole: "PM", difficulty: "beginner", duration: 15, timing: "now" });
    expect(blocked.status).toBe(403);
    expect((await student.get("/api/notifications")).status).toBe(200); // can still sign in to appeal
    const s3 = await db.strike.findFirstOrThrow({ where: { userId: user.id, strikeNumber: 3 } });
    const appeal = await student.post("/api/appeals", { strikeId: s3.id, reason: "Not me", description: "My account was used by someone else during that session; I can provide details." });
    expect(appeal.status, JSON.stringify(appeal.data)).toBe(200);
    expect((await student.post("/api/appeals", { strikeId: s3.id, reason: "again", description: "Submitting a duplicate appeal for the same strike should fail." })).status).toBe(409);
    expect((await admin.post(`/api/admin/appeals/${appeal.data.appealId}`, { decision: "approve", note: "Credible", restoreAccount: true })).status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: user.id } })).accountStatus).toBe("active");
    expect((await db.strike.findUniqueOrThrow({ where: { id: s3.id } })).status).toBe("overturned");
    expect((await student.post("/api/interviews", { mode: "ai", type: "behavioral", targetRole: "PM", difficulty: "beginner", duration: 15, timing: "now" })).status).toBe(200);
  });
});

describe("scheduling edge cases", () => {
  it("records no-shows without strikes, and cancellations free the slot", async () => {
    const c = await newStudent("noshow");
    const slot = await db.availability.findFirstOrThrow({ where: { interviewId: null, interviewer: { email: EMAIL("elena") } }, orderBy: { startsAt: "asc" } });
    const booked = await c.post("/api/interviews", { mode: "human", type: "full", targetRole: "Consulting Analyst", difficulty: "beginner", duration: 30, timing: "schedule", availabilityId: slot.id });
    expect(booked.status, JSON.stringify(booked.data)).toBe(200);
    expect((await c.post(`/api/interviews/${booked.data.id}/no-show`)).status).toBe(409); // too early
    await db.interview.update({ where: { id: booked.data.id }, data: { scheduledAt: new Date(Date.now() - 15 * 60_000) } });
    expect((await c.post(`/api/interviews/${booked.data.id}/no-show`)).status).toBe(200);
    const elena = await db.user.findUniqueOrThrow({ where: { email: EMAIL("elena") } });
    expect((await db.interview.findUniqueOrThrow({ where: { id: booked.data.id } })).noShowUserIds).toContain(elena.id);
    expect(await db.strike.count({ where: { userId: elena.id } })).toBe(0);

    const slot2 = await db.availability.findFirstOrThrow({ where: { interviewId: null, interviewer: { email: EMAIL("elena") } }, orderBy: { startsAt: "asc" } });
    const b2 = await c.post("/api/interviews", { mode: "human", type: "full", targetRole: "Consulting Analyst", difficulty: "beginner", duration: 30, timing: "schedule", availabilityId: slot2.id });
    expect((await c.post(`/api/interviews/${b2.data.id}/cancel`, { reason: "Exam conflict" })).status).toBe(200);
    expect((await db.availability.findUniqueOrThrow({ where: { id: slot2.id } })).interviewId).toBeNull();
  });
});
