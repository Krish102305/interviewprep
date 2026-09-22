import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { sendConductWarning } from "@/lib/services/room";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireApiUser({ roles: ["interviewer"] });
  const { details } = await readJson(req, z.object({ details: z.string().trim().max(500).default("") }));
  await sendConductWarning(params.id, user, details);
  return { ok: true };
});
