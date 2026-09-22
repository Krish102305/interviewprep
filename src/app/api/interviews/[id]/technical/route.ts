import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { technicalEventSchema } from "@/lib/validation";
import { loadForUser } from "@/lib/services/interviews";

/** Technical problems are logged separately and never count as misconduct. */
export const POST = route<{ id: string }>(
  async (req, { params }) => {
    const user = await requireApiUser();
    const body = await readJson(req, technicalEventSchema);
    const { role } = await loadForUser(params.id, user);
    if (role === "admin") return { ok: true };
    await db.technicalEvent.create({ data: { userId: user.id, interviewId: params.id, type: body.type, details: body.details } });
    return { ok: true };
  },
  { rateLimit: { key: "technical", limit: 200, windowSec: 3600 } },
);
