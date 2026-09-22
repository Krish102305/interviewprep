import { z } from "zod";
import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";

export const POST = route(async (req) => {
  const user = await requireApiUser({ roles: ["interviewer"] });
  const { on } = await readJson(req, z.object({ on: z.boolean() }));
  await db.interviewerProfile.update({ where: { userId: user.id }, data: { availableNow: on, availableNowAt: on ? new Date() : null } });
  return { ok: true, on };
});
