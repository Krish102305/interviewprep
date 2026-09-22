import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { conflict, forbidden } from "@/lib/errors";
import { loadForUser } from "@/lib/services/interviews";
import { notify } from "@/lib/services/notifications";
import { track } from "@/lib/services/analytics";

/**
 * The participant who showed up can record a no-show 10 minutes after the start
 * time. No-shows are tracked separately — never an automatic strike.
 */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { iv, role } = await loadForUser(params.id, user);
  if (role === "admin" || iv.mode !== "human" || !iv.interviewerId) throw forbidden();
  if (!["scheduled", "waiting"].includes(iv.status)) throw conflict("This interview is not waiting to start.");
  if (!iv.scheduledAt || Date.now() - iv.scheduledAt.getTime() < 10 * 60_000) throw conflict("You can mark a no-show 10 minutes after the scheduled start.");
  const other = role === "candidate" ? iv.interviewerId : iv.studentId;
  const otherSession = await db.interviewSession.findUnique({ where: { interviewId_userId: { interviewId: iv.id, userId: other } } });
  if (otherSession?.ready) throw conflict("The other participant is already in the waiting room.");
  await db.interview.update({ where: { id: iv.id }, data: { status: "no_show", noShowUserIds: JSON.stringify([other]) } });
  await db.availability.updateMany({ where: { interviewId: iv.id }, data: { interviewId: null } });
  await track("interview_no_show", user.id, { reportedBy: role });
  await notify(other, "interview_cancelled", "Missed interview recorded", "You didn't join a scheduled interview. No-shows are tracked separately from conduct strikes, but repeated no-shows may be reviewed.", `/interviews/${iv.id}`);
  return { ok: true };
});
