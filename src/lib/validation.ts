import { z } from "zod";
import {
  CONDUCT_REPORT_REASONS,
  DIFFICULTIES,
  DURATIONS,
  GOALS,
  INTERVIEWER_PREFERENCES,
  INTERVIEWER_TYPES,
  INTERVIEW_MODES,
  INTERVIEW_TYPES,
  ROLE_CATEGORIES,
  SIGNUP_ROLES,
  EXPERIENCE_LEVELS,
  TECHNICAL_EVENT_TYPES,
} from "./constants";

const trimmed = (max: number) => z.string().trim().max(max);
const requiredText = (label: string, max = 120) => z.string().trim().min(1, `${label} is required`).max(max);
const stringList = (maxItems: number, maxLen = 80) => z.array(trimmed(maxLen).min(1)).max(maxItems);
const enumOf = <T extends readonly string[]>(values: T) => z.enum(values as unknown as [T[number], ...T[number][]]);
const valuesOf = <T extends readonly { value: string }[]>(items: T) => items.map((i) => i.value) as unknown as [string, ...string[]];

export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(200)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
  firstName: requiredText("First name", 60),
  lastName: trimmed(60).default(""),
  // Only student/interviewer are accepted, admin can never be requested.
  role: enumOf(SIGNUP_ROLES),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required").max(200),
});

export const studentOnboardingSchema = z.object({
  firstName: requiredText("First name", 60),
  lastName: trimmed(60).default(""),
  school: requiredText("School", 120),
  major: requiredText("Major", 120),
  graduationYear: z.coerce.number().int().min(1990).max(2040),
  location: trimmed(120).optional().default(""),
  timezone: trimmed(64).optional(),
  targetIndustry: requiredText("Target industry", 60),
  targetRoles: stringList(5).min(1, "Add at least one target role"),
  experienceLevel: z.enum(valuesOf(EXPERIENCE_LEVELS)),
  companies: stringList(10).default([]),
  goals: z.array(z.enum(valuesOf(GOALS))).min(1, "Pick at least one goal"),
  interviewPreferences: z.array(enumOf(INTERVIEW_TYPES)).min(1, "Pick at least one interview type"),
});

export const interviewerOnboardingSchema = z.object({
  firstName: requiredText("First name", 60),
  lastName: trimmed(60).default(""),
  location: trimmed(120).optional().default(""),
  timezone: trimmed(64).optional(),
  interviewerType: enumOf(INTERVIEWER_TYPES),
  title: requiredText("Professional title", 120),
  company: trimmed(120).optional().default(""),
  school: trimmed(120).optional().default(""),
  industry: requiredText("Industry", 60),
  yearsExperience: z.coerce.number().int().min(0).max(60),
  roles: z.array(z.enum(valuesOf(ROLE_CATEGORIES))).min(1, "Pick at least one role you can interview for"),
  interviewTypes: z.array(enumOf(INTERVIEW_TYPES)).min(1, "Pick at least one interview type"),
  weeklyLimit: z.coerce.number().int().min(1).max(40).default(5),
  bio: trimmed(600).optional().default(""),
});

export const createInterviewSchema = z
  .object({
    mode: enumOf(INTERVIEW_MODES),
    type: enumOf(INTERVIEW_TYPES),
    targetRole: requiredText("Target role", 120),
    company: trimmed(120).optional().default(""),
    jobDescription: trimmed(20000).optional().default(""),
    resumeId: z.string().max(40).nullish(),
    difficulty: enumOf(DIFFICULTIES),
    duration: z.coerce.number().refine((d) => (DURATIONS as readonly number[]).includes(d), "Pick a supported duration"),
    interviewerPreference: enumOf(INTERVIEWER_PREFERENCES).default("anyone"),
    /** now = start immediately (AI) / match me now (human); schedule = pick a time */
    timing: z.enum(["now", "schedule"]),
    scheduledAt: z.string().datetime({ offset: true }).nullish(),
    availabilityId: z.string().max(40).nullish(),
  })
  .superRefine((v, ctx) => {
    if (v.timing === "schedule" && v.mode === "ai" && !v.scheduledAt)
      ctx.addIssue({ code: "custom", message: "Pick a date and time", path: ["scheduledAt"] });
    if (v.timing === "schedule" && v.mode === "human" && !v.availabilityId)
      ctx.addIssue({ code: "custom", message: "Pick an available time slot", path: ["availabilityId"] });
  });

export const answerSchema = z.object({
  text: z.string().trim().min(1, "Your answer is empty").max(8000),
  source: z.enum(["speech", "typed"]).default("typed"),
  durationSec: z.coerce.number().int().min(0).max(7200).optional(),
});

export const transcriptSegmentSchema = z.object({
  text: z.string().trim().min(1).max(4000),
  source: z.enum(["speech", "typed"]).default("speech"),
});

export const askSchema = z.union([
  z.object({ questionId: z.string().max(40) }),
  z.object({ customText: z.string().trim().min(3).max(1000), parentQuestionId: z.string().max(40).nullish() }),
]);

export const noteSchema = z.object({ text: requiredText("Note", 2000), questionId: z.string().max(40).nullish() });

export const reportSchema = z.object({
  reason: z.enum(valuesOf(CONDUCT_REPORT_REASONS)),
  description: z.string().trim().min(20, "Please describe what happened (at least 20 characters)").max(2000),
});

export const conductSignalSchema = z.object({
  type: z.enum(["inactivity", "tab_hidden", "no_response", "warning_acknowledged", "left_early"]),
  details: trimmed(500).optional(),
});

export const technicalEventSchema = z.object({
  type: enumOf(TECHNICAL_EVENT_TYPES),
  details: trimmed(500).optional(),
});

export const interviewerFeedbackSchema = z.object({
  strengths: trimmed(3000).optional().default(""),
  improvements: trimmed(3000).optional().default(""),
  notes: trimmed(3000).optional().default(""),
});

const rating = z.coerce.number().int().min(1).max(5);
export const ratingSchema = z.object({
  professionalism: rating,
  realism: rating,
  communication: rating,
  feedbackQuality: rating,
  comment: trimmed(1000).optional().default(""),
});

export const availabilitySchema = z.object({
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.coerce.number().int().min(15).max(180),
  repeatWeeks: z.coerce.number().int().min(1).max(8).default(1),
  timezone: trimmed(64).default("UTC"),
});

export const appealSchema = z.object({
  strikeId: z.string().max(40),
  reason: requiredText("Reason", 160),
  description: z.string().trim().min(30, "Please explain in at least 30 characters").max(4000),
});

export const adminReviewSchema = z.object({
  decision: z.enum(["confirm", "dismiss"]),
  note: trimmed(1000).optional().default(""),
});

export const adminAppealSchema = z.object({
  decision: z.enum(["approve", "deny"]),
  note: trimmed(1000).optional().default(""),
  restoreAccount: z.boolean().default(true),
});

export const adminUserActionSchema = z.object({
  action: z.enum(["suspend", "ban", "unban", "add_strike"]),
  reason: z.string().trim().min(5, "Give a reason (min 5 characters)").max(1000),
});

export const profileUpdateSchema = z.object({
  firstName: requiredText("First name", 60),
  lastName: trimmed(60).default(""),
  location: trimmed(120).optional().default(""),
  timezone: trimmed(64).optional(),
  bio: trimmed(600).optional().default(""),
});
