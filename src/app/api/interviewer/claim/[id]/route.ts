import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { forbidden, notFound } from "@/lib/errors";
import { parseJsonArray } from "@/lib/json";
import { acceptInterview } from "@/lib/services/matching";

/** Claim an open (unmatched) human interview request from the pool. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser({ roles: ["interviewer"] });
  const [iv, profile] = await Promise.all([
    db.interview.findUnique({ where: { id: params.id } }),
    db.interviewerProfile.findUnique({ where: { userId: user.id } }),
  ]);
  if (!iv || iv.mode !== "human") throw notFound("Interview not found.");
  if (!profile) throw forbidden("Complete your interviewer profile first.");
  const pref = iv.interviewerPreference;
  if (pref === "student" && profile.interviewerType !== "student") throw forbidden("This candidate asked for a student interviewer.");
  if (pref === "professional" && profile.interviewerType === "student") throw forbidden("This candidate asked for a professional interviewer.");
  if (!parseJsonArray(profile.interviewTypes).includes(iv.type)) throw forbidden("This interview type isn't in your interviewer preferences.");
  await acceptInterview(iv.id, user.id, "claim");
  return { ok: true, interviewId: iv.id };
});
