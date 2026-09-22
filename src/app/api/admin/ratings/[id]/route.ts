import { z } from "zod";
import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { notFound } from "@/lib/errors";
import { logAdminAction } from "@/lib/services/conduct";

/** Moderate abusive interviewer ratings (hidden ratings don't count toward averages). */
export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireApiUser({ roles: ["admin"] });
  const { status } = await readJson(req, z.object({ status: z.enum(["visible", "hidden"]) }));
  const rating = await db.interviewerRating.findUnique({ where: { id: params.id } });
  if (!rating) throw notFound();
  await db.interviewerRating.update({ where: { id: rating.id }, data: { moderationStatus: status } });
  await logAdminAction(admin.id, `rating_${status}`, rating.studentId, `Rating ${rating.id} on interviewer ${rating.interviewerId}`);
  return { ok: true };
});
