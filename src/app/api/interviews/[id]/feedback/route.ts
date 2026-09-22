import { after } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { interviewerFeedbackSchema } from "@/lib/validation";
import { conflict, forbidden } from "@/lib/errors";
import { loadForUser } from "@/lib/services/interviews";
import { runGrading } from "@/lib/services/grading";
import { awardPoints, checkInterviewerBadges, isQualityFeedback, POINTS } from "@/lib/services/gamification";
import { notify } from "@/lib/services/notifications";
import { track } from "@/lib/services/analytics";

const schema = interviewerFeedbackSchema.extend({ skip: z.boolean().default(false) });

/** Optional interviewer feedback. It informs the AI report but never sets the score. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireApiUser({ roles: ["interviewer"] });
  const body = await readJson(req, schema);
  const { iv, role } = await loadForUser(params.id, user);
  if (role !== "interviewer") throw forbidden();
  if (!["completed", "reported"].includes(iv.status)) throw conflict("Feedback can be added after the interview ends.");
  const existing = await db.interviewFeedback.findUnique({ where: { interviewId: iv.id } });
  if (existing) throw conflict("Feedback was already submitted.");
  if (!body.skip && (body.strengths || body.improvements || body.notes)) {
    await db.interviewFeedback.create({ data: { interviewId: iv.id, interviewerId: user.id, strengths: body.strengths || null, improvements: body.improvements || null, notes: body.notes || null } });
    await track("feedback_submitted", user.id);
    if (isQualityFeedback(body)) await awardPoints(user.id, POINTS.qualityFeedback, "Gave detailed interview feedback", iv.id);
    await checkInterviewerBadges(user.id);
    await notify(iv.studentId, "feedback_received", "Your interviewer left feedback", "It's included in your AI interview report.", `/interviews/${iv.id}/results`);
  }
  after(() => runGrading(iv.id));
  return { ok: true };
});
