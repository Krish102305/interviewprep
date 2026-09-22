import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { cancelInterview } from "@/lib/services/interviews";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireApiUser({ allowRestricted: true });
  const { reason } = await readJson(req, z.object({ reason: z.string().trim().max(300).default("") }));
  await cancelInterview(params.id, user, reason);
  return { ok: true };
});
