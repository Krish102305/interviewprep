import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export type NotificationType =
  | "interview_scheduled"
  | "interviewer_matched"
  | "interview_request"
  | "interview_reminder"
  | "interview_completed"
  | "feedback_ready"
  | "feedback_received"
  | "points_earned"
  | "badge_earned"
  | "conduct_warning"
  | "strike_received"
  | "appeal_update"
  | "account_suspended"
  | "account_restored"
  | "interview_cancelled"
  | "report_update";

/** Types important enough to also go out by email (when email is configured). */
const EMAIL_TYPES = new Set<NotificationType>([
  "interview_scheduled",
  "interviewer_matched",
  "interview_request",
  "feedback_ready",
  "strike_received",
  "account_suspended",
  "account_restored",
  "appeal_update",
  "interview_cancelled",
]);

export async function notify(
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
) {
  const n = await db.notification.create({ data: { userId, type, title, body, link } });
  if (EMAIL_TYPES.has(type)) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (user) {
      const url = link ? `${process.env.APP_URL ?? "http://localhost:3000"}${link}` : "";
      void sendEmail(user.email, `Interview Connect: ${title}`, `${body}${url ? `\n\n${url}` : ""}`);
    }
  }
  return n;
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, readAt: null } });
}

/** Lazily create "starting soon" reminders for interviews within the next hour. */
export async function ensureReminders(userId: string) {
  const soon = new Date(Date.now() + 60 * 60_000);
  const upcoming = await db.interview.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { gte: new Date(), lte: soon },
      OR: [{ studentId: userId }, { interviewerId: userId }],
    },
    select: { id: true, targetRole: true, scheduledAt: true },
  });
  for (const iv of upcoming) {
    const link = `/interviews/${iv.id}`;
    const exists = await db.notification.findFirst({ where: { userId, type: "interview_reminder", link } });
    if (!exists)
      await notify(userId, "interview_reminder", "Interview starting soon", `Your ${iv.targetRole} interview starts within the hour. Do a quick camera and mic check before joining.`, link);
  }
}
