import { after } from "next/server";
import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { endInterview } from "@/lib/services/room";
import { runGrading } from "@/lib/services/grading";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireApiUser();
  const { reason } = await readJson(req, z.object({ reason: z.string().trim().max(300).optional() }));
  const iv = await endInterview(params.id, user, { reason });
  // AI interviews grade immediately; human interviews wait briefly for interviewer feedback.
  if (iv.mode === "ai") after(() => runGrading(iv.id));
  return { ok: true, status: iv.status, mode: iv.mode };
});
