import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { ratingSchema } from "@/lib/validation";
import { conflict, forbidden } from "@/lib/errors";
import { loadForUser } from "@/lib/services/interviews";
import { awardPoints, checkInterviewerBadges, POINTS } from "@/lib/services/gamification";
import { track } from "@/lib/services/analytics";

/** Student rates their human interviewer. Has no effect on the student's AI score. */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireApiUser({ roles: ["student"] });
  const body = await readJson(req, ratingSchema);
  const { iv, role } = await loadForUser(params.id, user);
  if (role !== "candidate" || iv.mode !== "human" || !iv.interviewerId) throw forbidden();
  if (!["completed", "reported"].includes(iv.status)) throw conflict("You can rate your interviewer after the interview.");
  if (await db.interviewerRating.findUnique({ where: { interviewId: iv.id } })) throw conflict("You already rated this interview.");
  await db.interviewerRating.create({
    data: { interviewId: iv.id, studentId: user.id, interviewerId: iv.interviewerId, ...body, comment: body.comment || null },
  });
  await awardPoints(user.id, POINTS.rating, "Rated your interviewer", iv.id, true);
  await checkInterviewerBadges(iv.interviewerId);
  await track("rating_submitted", user.id);
  return { ok: true };
});
