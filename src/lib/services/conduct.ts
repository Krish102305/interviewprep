import { db } from "@/lib/db";
import { MAX_STRIKES, conductReasonLabel } from "@/lib/constants";
import { badRequest, conflict, forbidden, notFound } from "@/lib/errors";
import { notify } from "./notifications";
import { track } from "./analytics";

/**
 * The three-strike conduct system.
 *
 *  - Potential signals (inactivity, leaving, ignored warnings) become ConductEvents.
 *  - Interviewers (and the system, for repeated ignored warnings) file ConductReports
 *    which are always `pending` until an admin reviews them.
 *  - Only an admin confirming a report (or an explicit admin action) creates a Strike.
 *  - Technical problems are TechnicalEvents and never feed into any of the above.
 */

export function standing(activeStrikes: number, accountStatus?: string) {
  if (accountStatus === "banned" || activeStrikes >= MAX_STRIKES)
    return { key: "banned", label: "Suspended", tone: "danger", description: "Account suspended after 3 confirmed conduct violations." } as const;
  if (activeStrikes === 2)
    return { key: "final", label: "Final Warning", tone: "danger", description: "One more confirmed violation will suspend your account." } as const;
  if (activeStrikes === 1)
    return { key: "warning", label: "Conduct Warning", tone: "warning", description: "Future confirmed violations can lead to more strikes." } as const;
  return { key: "good", label: "Good Standing", tone: "success", description: "No confirmed conduct strikes." } as const;
}

export const activeStrikeCount = (userId: string) => db.strike.count({ where: { userId, status: "active" } });

export async function logAdminAction(adminId: string, action: string, targetUserId?: string | null, details?: string) {
  await db.adminAction.create({ data: { adminId, action, targetUserId: targetUserId ?? null, details } });
}

export async function recordConductEvent(input: {
  userId: string;
  interviewId?: string | null;
  type: string;
  source?: "system" | "interviewer";
  details?: string;
}) {
  return db.conductEvent.create({
    data: { userId: input.userId, interviewId: input.interviewId ?? null, type: input.type, source: input.source ?? "system", details: input.details },
  });
}

/** Interviewer (or the AI room) issues an in-interview conduct warning. Not a strike. */
export async function issueWarning(userId: string, interviewId: string, source: "system" | "interviewer", details: string) {
  const ev = await recordConductEvent({ userId, interviewId, type: "warning_issued", source, details });
  await notify(
    userId,
    "conduct_warning",
    "Interview conduct warning",
    "You received a conduct warning during an interview. Warnings are not strikes — they're a chance to correct course.",
    `/interviews/${interviewId}`,
  );
  return ev;
}

/**
 * After a warning, if the user ignores repeated warnings in the same interview we
 * escalate to a *pending* report for human review — never an automatic strike.
 */
export async function escalateIfRepeated(userId: string, interviewId: string) {
  const ignored = await db.conductEvent.count({ where: { userId, interviewId, type: "no_response" } });
  if (ignored < 2) return null;
  const existing = await db.conductReport.findFirst({ where: { userId, interviewId, source: "system" } });
  if (existing) return existing;
  const events = await db.conductEvent.findMany({ where: { userId, interviewId }, orderBy: { createdAt: "asc" } });
  const technical = await db.technicalEvent.count({ where: { userId, interviewId } });
  return fileReport({
    userId,
    interviewId,
    reportedById: null,
    source: "system",
    reason: "inactivity",
    description: `Automated signal: ${ignored} conduct warnings went unacknowledged during this interview. Requires human review before any action.`,
    evidence: {
      conductEvents: events.map((e) => ({ type: e.type, at: e.createdAt, details: e.details })),
      technicalEventsLogged: technical,
      note: "Technical events are shown for context; connection problems are not misconduct.",
    },
  });
}

export async function fileReport(input: {
  userId: string;
  interviewId?: string | null;
  reportedById: string | null;
  source: "interviewer" | "system" | "admin" | "participant";
  reason: string;
  description: string;
  evidence?: unknown;
}) {
  if (input.reportedById && input.reportedById === input.userId) throw badRequest("You can't report yourself.");
  const report = await db.conductReport.create({
    data: {
      userId: input.userId,
      interviewId: input.interviewId ?? null,
      reportedById: input.reportedById,
      source: input.source,
      reason: input.reason,
      description: input.description,
      evidence: JSON.stringify(input.evidence ?? {}),
    },
  });
  await track("conduct_report", input.reportedById, { reason: input.reason, source: input.source });
  return report;
}

/** Admin confirms a pending report → creates the next strike (and bans at 3). */
export async function confirmReport(reportId: string, adminId: string, note?: string) {
  const report = await db.conductReport.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("Report not found.");
  if (report.status !== "pending") throw conflict("This report has already been reviewed.");
  await db.conductReport.update({
    where: { id: reportId },
    data: { status: "confirmed", reviewedById: adminId, reviewedAt: new Date(), reviewNote: note || null },
  });
  const strike = await issueStrike({
    userId: report.userId,
    interviewId: report.interviewId,
    reportId: report.id,
    reason: report.reason,
    description: report.description,
    evidence: report.evidence,
    reviewerId: adminId,
  });
  await logAdminAction(adminId, "confirm_report", report.userId, `Report ${reportId} confirmed → strike ${strike.strikeNumber}. ${note ?? ""}`.trim());
  if (report.reportedById)
    await notify(report.reportedById, "report_update", "Your conduct report was reviewed", "Thanks for helping keep interviews professional. An admin confirmed your report.");
  return strike;
}

export async function dismissReport(reportId: string, adminId: string, note?: string) {
  const report = await db.conductReport.findUnique({ where: { id: reportId } });
  if (!report) throw notFound("Report not found.");
  if (report.status !== "pending") throw conflict("This report has already been reviewed.");
  await db.conductReport.update({
    where: { id: reportId },
    data: { status: "dismissed", reviewedById: adminId, reviewedAt: new Date(), reviewNote: note || null },
  });
  await logAdminAction(adminId, "dismiss_report", report.userId, `Report ${reportId} dismissed. ${note ?? ""}`.trim());
  if (report.reportedById)
    await notify(report.reportedById, "report_update", "Your conduct report was reviewed", "An admin reviewed your report and decided no strike was warranted.");
}

export async function issueStrike(input: {
  userId: string;
  interviewId?: string | null;
  reportId?: string | null;
  reason: string;
  description: string;
  evidence?: string;
  reviewerId: string;
}) {
  const target = await db.user.findUnique({ where: { id: input.userId } });
  if (!target) throw notFound("User not found.");
  if (target.role === "admin") throw forbidden("Admins can't receive strikes.");
  const active = await activeStrikeCount(input.userId);
  const strike = await db.strike.create({
    data: {
      userId: input.userId,
      strikeNumber: Math.min(active + 1, MAX_STRIKES),
      interviewId: input.interviewId ?? null,
      reportId: input.reportId ?? null,
      reason: input.reason,
      description: input.description,
      evidence: input.evidence ?? "{}",
      reviewerId: input.reviewerId,
    },
  });
  await track("strike_issued", input.userId, { number: strike.strikeNumber });
  const count = active + 1;
  if (count >= MAX_STRIKES) {
    await banUser(input.userId, input.reviewerId, "3 confirmed conduct violations");
  } else if (count === 2) {
    await notify(
      input.userId,
      "strike_received",
      "Final Warning — 2 / 3 strikes",
      `A conduct report (${conductReasonLabel(input.reason)}) was confirmed. You currently have 2 / 3 confirmed strikes. One additional confirmed conduct violation will result in an account ban from Interview Connect interviews.`,
      "/conduct",
    );
  } else {
    await notify(
      input.userId,
      "strike_received",
      "Interview Conduct Warning — 1 / 3 strikes",
      `You have received your first confirmed conduct strike (${conductReasonLabel(input.reason)}). Future confirmed violations can result in additional strikes. You can appeal from the Conduct page.`,
      "/conduct",
    );
  }
  return strike;
}

/** Ban: block participation and cancel upcoming sessions. The user can still sign in to appeal. */
export async function banUser(userId: string, adminId: string | null, reason: string) {
  await db.user.update({ where: { id: userId }, data: { accountStatus: "banned" } });
  await cancelUpcomingFor(userId, "Participant account suspended");
  await notify(
    userId,
    "account_suspended",
    "Account suspended",
    "Your Interview Connect account has been suspended after 3 confirmed conduct violations. You can review your strike history and submit an appeal.",
    "/conduct",
  );
  if (adminId) await logAdminAction(adminId, "ban", userId, reason);
}

export async function suspendUser(userId: string, adminId: string, reason: string) {
  await db.user.update({ where: { id: userId }, data: { accountStatus: "suspended" } });
  await cancelUpcomingFor(userId, "Participant account suspended");
  await notify(userId, "account_suspended", "Account temporarily suspended", `An administrator suspended your account: ${reason}`, "/conduct");
  await logAdminAction(adminId, "suspend", userId, reason);
}

export async function restoreUser(userId: string, adminId: string, reason: string) {
  await db.user.update({ where: { id: userId }, data: { accountStatus: "active" } });
  await notify(userId, "account_restored", "Account restored", "Your Interview Connect account is active again. Welcome back.", "/dashboard");
  await logAdminAction(adminId, "unban", userId, reason);
}

async function cancelUpcomingFor(userId: string, reason: string) {
  const upcoming = await db.interview.findMany({
    where: { status: { in: ["scheduled", "waiting"] }, OR: [{ studentId: userId }, { interviewerId: userId }] },
  });
  for (const iv of upcoming) {
    if (iv.studentId === userId) {
      await db.interview.update({ where: { id: iv.id }, data: { status: "cancelled", cancelledAt: new Date(), cancelReason: reason } });
      await db.availability.updateMany({ where: { interviewId: iv.id }, data: { interviewId: null } });
      if (iv.interviewerId)
        await notify(iv.interviewerId, "interview_cancelled", "Interview cancelled", `An upcoming ${iv.targetRole} interview was cancelled.`, "/interviewer");
    } else {
      // Interviewer removed: free the candidate's interview so it can be re-matched.
      await db.interview.update({ where: { id: iv.id }, data: { interviewerId: null, matchStatus: "unmatched", status: "scheduled" } });
      await db.availability.updateMany({ where: { interviewId: iv.id }, data: { interviewId: null } });
      await db.match.updateMany({ where: { interviewId: iv.id, status: { in: ["pending", "accepted"] } }, data: { status: "cancelled" } });
      await notify(
        iv.studentId,
        "interview_cancelled",
        "Your interviewer is no longer available",
        "We've put your interview back into matching — you'll be notified when a new interviewer is found.",
        `/interviews/${iv.id}`,
      );
    }
  }
}

/** Overturn (appeal approved) or remove (admin) a strike and restore the account if appropriate. */
export async function revokeStrike(strikeId: string, adminId: string, status: "overturned" | "removed", note: string, restoreAccount = true) {
  const strike = await db.strike.findUnique({ where: { id: strikeId }, include: { user: true } });
  if (!strike) throw notFound("Strike not found.");
  if (strike.status !== "active") throw conflict("This strike is no longer active.");
  await db.strike.update({ where: { id: strikeId }, data: { status } });
  if (strike.reportId) await db.conductReport.update({ where: { id: strike.reportId }, data: { status: "overturned" } });
  await logAdminAction(adminId, status === "removed" ? "remove_strike" : "overturn_strike", strike.userId, note);
  const remaining = await activeStrikeCount(strike.userId);
  if (strike.user.accountStatus === "banned" && remaining < MAX_STRIKES && restoreAccount) {
    await restoreUser(strike.userId, adminId, `Strike ${status}; ${remaining} active strike(s) remain.`);
  } else {
    await notify(strike.userId, "appeal_update", "A conduct strike was removed", `One of your strikes was ${status}. You now have ${remaining} / ${MAX_STRIKES} active strikes.`, "/conduct");
  }
  return remaining;
}

export async function submitAppeal(userId: string, strikeId: string, reason: string, description: string) {
  const strike = await db.strike.findUnique({ where: { id: strikeId } });
  if (!strike || strike.userId !== userId) throw notFound("Strike not found.");
  if (strike.status !== "active") throw conflict("Only active strikes can be appealed.");
  const pending = await db.appeal.findFirst({ where: { strikeId, status: "pending" } });
  if (pending) throw conflict("You already have a pending appeal for this strike.");
  const appeal = await db.appeal.create({ data: { strikeId, userId, reason, description } });
  if (strike.reportId) await db.conductReport.update({ where: { id: strike.reportId }, data: { status: "appealed" } });
  await track("appeal_submitted", userId);
  await notify(userId, "appeal_update", "Appeal submitted", "An administrator will review your appeal. We'll notify you of the decision.", "/conduct");
  return appeal;
}

export async function reviewAppeal(appealId: string, adminId: string, decision: "approve" | "deny", note: string, restoreAccount = true) {
  const appeal = await db.appeal.findUnique({ where: { id: appealId }, include: { strike: true } });
  if (!appeal) throw notFound("Appeal not found.");
  if (appeal.status !== "pending") throw conflict("This appeal has already been reviewed.");
  await db.appeal.update({
    where: { id: appealId },
    data: { status: decision === "approve" ? "approved" : "denied", reviewedById: adminId, reviewedAt: new Date(), reviewNote: note || null },
  });
  await logAdminAction(adminId, `appeal_${decision}`, appeal.userId, note);
  if (decision === "approve") {
    await revokeStrike(appeal.strikeId, adminId, "overturned", `Appeal ${appealId} approved. ${note}`.trim(), restoreAccount);
    await notify(appeal.userId, "appeal_update", "Appeal approved", "Your appeal was approved and the strike was overturned.", "/conduct");
  } else {
    if (appeal.strike.reportId) await db.conductReport.update({ where: { id: appeal.strike.reportId }, data: { status: "confirmed" } });
    await notify(appeal.userId, "appeal_update", "Appeal denied", note ? `Your appeal was reviewed and denied: ${note}` : "Your appeal was reviewed and denied.", "/conduct");
  }
}
