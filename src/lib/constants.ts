// Canonical enum-like values. The database stores these as strings; every
// write path validates against these lists (see src/lib/validation.ts).

export const ROLES = ["student", "interviewer", "admin"] as const;
export type Role = (typeof ROLES)[number];
/** Roles a visitor may pick at signup. `admin` is never self-assignable. */
export const SIGNUP_ROLES = ["student", "interviewer"] as const;

export const ACCOUNT_STATUSES = ["active", "suspended", "banned"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export const INTERVIEW_MODES = ["ai", "human"] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];

export const INTERVIEW_TYPES = ["behavioral", "technical", "full"] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DURATIONS = [15, 30, 45, 60] as const;

export const INTERVIEW_STATUSES = [
  "scheduled",
  "waiting",
  "active",
  "completed",
  "cancelled",
  "no_show",
  "reported",
] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export const GRADING_STATUSES = ["pending", "processing", "completed", "failed"] as const;
export type GradingStatus = (typeof GRADING_STATUSES)[number];

export const INTERVIEWER_PREFERENCES = ["anyone", "student", "professional"] as const;
export type InterviewerPreference = (typeof INTERVIEWER_PREFERENCES)[number];

export const INTERVIEWER_TYPES = ["student", "professional", "alumni"] as const;

export const EXPERIENCE_LEVELS = [
  { value: "entry", label: "No experience yet" },
  { value: "intern", label: "Internship experience" },
  { value: "junior", label: "0–2 years" },
  { value: "mid", label: "3–5 years" },
  { value: "senior", label: "6+ years" },
] as const;

export const GOALS = [
  { value: "internship", label: "Internship" },
  { value: "full_time", label: "Full-time role" },
  { value: "club", label: "Club interview" },
  { value: "graduate", label: "Graduate program" },
  { value: "other", label: "Other" },
] as const;

/** Role categories drive question banks, interview structure and matching. */
export const ROLE_CATEGORIES = [
  { value: "software_engineering", label: "Software Engineering", industry: "Technology" },
  { value: "product_management", label: "Product Management", industry: "Technology" },
  { value: "data_science", label: "Data Science & Analytics", industry: "Technology" },
  { value: "investment_banking", label: "Investment Banking", industry: "Finance" },
  { value: "finance", label: "Finance & Accounting", industry: "Finance" },
  { value: "consulting", label: "Consulting", industry: "Consulting" },
  { value: "marketing", label: "Marketing", industry: "Marketing" },
  { value: "general", label: "General / Other", industry: "Other" },
] as const;
export type RoleCategory = (typeof ROLE_CATEGORIES)[number]["value"];

export const INDUSTRIES = ["Technology", "Finance", "Consulting", "Marketing", "Healthcare", "Other"] as const;

export const CONDUCT_REPORT_REASONS = [
  { value: "left_interview", label: "Left Interview" },
  { value: "inactivity", label: "Repeated Inactivity" },
  { value: "refused", label: "Refused to Participate" },
  { value: "disrespectful", label: "Disrespectful Behavior" },
  { value: "disruptive", label: "Disruptive Behavior" },
  { value: "platform_abuse", label: "Platform Abuse" },
  { value: "other", label: "Other" },
] as const;
export type ConductReason = (typeof CONDUCT_REPORT_REASONS)[number]["value"];

export const CONDUCT_REPORT_STATUSES = ["pending", "confirmed", "dismissed", "appealed", "overturned"] as const;
export const STRIKE_STATUSES = ["active", "overturned", "removed"] as const;
export const APPEAL_STATUSES = ["pending", "approved", "denied"] as const;

export const MAX_STRIKES = 3;

export const CONDUCT_EVENT_TYPES = [
  "inactivity",
  "tab_hidden",
  "left_early",
  "no_response",
  "warning_issued",
  "warning_acknowledged",
  "abandoned",
] as const;

export const TECHNICAL_EVENT_TYPES = [
  "connection_lost",
  "reconnected",
  "camera_error",
  "mic_error",
  "media_denied",
  "ice_failed",
  "speech_unavailable",
] as const;

/** Main (non-follow-up) questions per interview duration. */
export const QUESTIONS_PER_DURATION: Record<number, number> = { 15: 4, 30: 6, 45: 8, 60: 10 };
/** Max AI follow-ups per main question, by duration. */
export const FOLLOW_UPS_PER_QUESTION: Record<number, number> = { 15: 0, 30: 1, 45: 1, 60: 2 };

export const SCORE_CATEGORIES = [
  { key: "communication", label: "Communication" },
  { key: "confidence", label: "Confidence" },
  { key: "answerStructure", label: "Answer Structure" },
  { key: "technicalKnowledge", label: "Technical Knowledge" },
  { key: "problemSolving", label: "Problem Solving" },
  { key: "roleKnowledge", label: "Role Knowledge" },
  { key: "professionalism", label: "Professionalism" },
  { key: "behavioral", label: "Behavioral Performance" },
] as const;
export type ScoreCategoryKey = (typeof SCORE_CATEGORIES)[number]["key"];

/** Which categories are graded for each interview type (spec §26). */
export const CATEGORIES_BY_TYPE: Record<InterviewType, ScoreCategoryKey[]> = {
  behavioral: ["communication", "confidence", "answerStructure", "behavioral", "problemSolving", "professionalism"],
  technical: ["technicalKnowledge", "problemSolving", "roleKnowledge", "communication", "professionalism"],
  full: [
    "communication",
    "confidence",
    "answerStructure",
    "technicalKnowledge",
    "problemSolving",
    "roleKnowledge",
    "professionalism",
    "behavioral",
  ],
};

export const LABELS = {
  mode: { ai: "AI Interview", human: "Human Interview" } as Record<string, string>,
  type: { behavioral: "Behavioral", technical: "Technical", full: "Full Interview" } as Record<string, string>,
  difficulty: { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" } as Record<string, string>,
  status: {
    scheduled: "Scheduled",
    waiting: "Waiting room",
    active: "In progress",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No-show",
    reported: "Under review",
  } as Record<string, string>,
  grading: {
    pending: "Awaiting grading",
    processing: "Grading…",
    completed: "Graded",
    failed: "Grading failed",
  } as Record<string, string>,
  interviewerType: { student: "Student", professional: "Professional", alumni: "Alumni" } as Record<string, string>,
  preference: { anyone: "Anyone", student: "Another student", professional: "Professional" } as Record<string, string>,
};

export function roleCategoryLabel(value: string) {
  return ROLE_CATEGORIES.find((c) => c.value === value)?.label ?? "General";
}

export function conductReasonLabel(value: string) {
  return CONDUCT_REPORT_REASONS.find((c) => c.value === value)?.label ?? value;
}

/** Best-effort mapping of a free-text target role to a role category. */
export function inferRoleCategory(role: string, industry?: string | null): RoleCategory {
  const r = `${role} ${industry ?? ""}`.toLowerCase();
  const rules: [RoleCategory, RegExp][] = [
    ["investment_banking", /investment bank|\bib\b|m&a|capital markets|leveraged finance|restructuring/],
    ["product_management", /product manag|\bpm\b|\bapm\b|product owner|product lead/],
    ["data_science", /data scien|data analy|machine learning|\bml\b|analytics engineer|business analyst|quant/],
    ["software_engineering", /software|engineer|developer|swe|backend|frontend|full.?stack|devops|sre|mobile|programmer/],
    ["consulting", /consult|strategy analyst|case|advisory/],
    ["finance", /financ|account|audit|equity research|private equity|asset manag|treasury|fp&a|tax|credit|wealth/],
    ["marketing", /marketing|brand|growth|seo|content|social media|communications|advertis/],
  ];
  for (const [cat, re] of rules) if (re.test(r)) return cat;
  return "general";
}
