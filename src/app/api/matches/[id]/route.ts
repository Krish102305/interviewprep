import { z } from "zod";
import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { conflict, notFound } from "@/lib/errors";
import { acceptInterview, declineMatch } from "@/lib/services/matching";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireApiUser({ roles: ["interviewer"] });
  const { action } = await readJson(req, z.object({ action: z.enum(["accept", "decline"]) }));
  const match = await db.match.findUnique({ where: { id: params.id } });
  if (!match || match.interviewerId !== user.id) throw notFound("Request not found.");
  if (action === "decline") {
    await declineMatch(match.id, user.id);
    return { ok: true };
  }
  if (match.status !== "pending") throw conflict("This request is no longer available.");
  const iv = await acceptInterview(match.interviewId, user.id, "match");
  return { ok: true, interviewId: iv.id };
});
