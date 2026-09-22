import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { availabilitySchema } from "@/lib/validation";
import { badRequest, conflict } from "@/lib/errors";

export const GET = route(async () => {
  const user = await requireApiUser({ roles: ["interviewer"] });
  const slots = await db.availability.findMany({
    where: { interviewerId: user.id, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { interview: { select: { id: true, targetRole: true, type: true } } },
  });
  return { slots };
});

/** Add a slot (optionally repeated weekly). Overlapping slots are rejected. */
export const POST = route(async (req) => {
  const user = await requireApiUser({ roles: ["interviewer"] });
  const d = await readJson(req, availabilitySchema);
  const start = new Date(d.startsAt);
  if (start < new Date()) throw badRequest("Pick a time in the future.");
  const created = [];
  for (let w = 0; w < d.repeatWeeks; w++) {
    const s = new Date(start.getTime() + w * 7 * 86400_000);
    const e = new Date(s.getTime() + d.durationMinutes * 60_000);
    const overlap = await db.availability.findFirst({ where: { interviewerId: user.id, startsAt: { lt: e }, endsAt: { gt: s } } });
    if (overlap) {
      if (w === 0) throw conflict("This overlaps an existing availability slot.");
      continue;
    }
    created.push(await db.availability.create({ data: { interviewerId: user.id, startsAt: s, endsAt: e, timezone: d.timezone } }));
  }
  return { created: created.length };
});
