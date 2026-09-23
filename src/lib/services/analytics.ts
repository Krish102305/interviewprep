import { db } from "@/lib/db";

/**
 * Product analytics. Only event names, ids and enum-like properties are stored:
 * never free text, resumes or transcripts.
 */
export type AnalyticsName =
  | "signup"
  | "login"
  | "profile_completed"
  | "resume_uploaded"
  | "interview_created"
  | "interview_booked"
  | "interview_started"
  | "interview_completed"
  | "interview_cancelled"
  | "interview_no_show"
  | "feedback_submitted"
  | "rating_submitted"
  | "interviewer_accepted"
  | "points_earned"
  | "badge_earned"
  | "conduct_report"
  | "strike_issued"
  | "appeal_submitted"
  | "grading_completed"
  | "grading_failed";

export async function track(name: AnalyticsName, userId?: string | null, properties: Record<string, string | number | boolean | null> = {}) {
  try {
    await db.analyticsEvent.create({ data: { name, userId: userId ?? null, properties: JSON.stringify(properties) } });
  } catch (err) {
    console.error("[analytics] failed", err);
  }
}
