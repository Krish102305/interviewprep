import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { profileUpdateSchema } from "@/lib/validation";
import { safeTz } from "@/lib/format";

/** Basic profile fields. Role, status, points and strikes are never writable here. */
export const PATCH = route(async (req) => {
  const user = await requireApiUser({ allowRestricted: true });
  const d = await readJson(req, profileUpdateSchema);
  const data = { firstName: d.firstName, lastName: d.lastName, location: d.location || null, bio: d.bio || null, ...(safeTz(d.timezone) ? { timezone: d.timezone } : {}) };
  await db.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...data }, update: data });
  return { ok: true };
});
