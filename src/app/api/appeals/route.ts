import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { appealSchema } from "@/lib/validation";
import { submitAppeal } from "@/lib/services/conduct";

/** Any user (including banned users) can appeal their own active strikes. */
export const POST = route(
  async (req) => {
    const user = await requireApiUser({ allowRestricted: true });
    const d = await readJson(req, appealSchema);
    const appeal = await submitAppeal(user.id, d.strikeId, d.reason, d.description);
    return { ok: true, appealId: appeal.id };
  },
  { rateLimit: { key: "appeal", limit: 10, windowSec: 86400 } },
);
