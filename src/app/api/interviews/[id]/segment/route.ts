import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { transcriptSegmentSchema } from "@/lib/validation";
import { addCandidateSegment } from "@/lib/services/room";

export const POST = route<{ id: string }>(
  async (req, { params }) => {
    const user = await requireApiUser({ roles: ["student"] });
    await addCandidateSegment(params.id, user, await readJson(req, transcriptSegmentSchema));
    return { ok: true };
  },
  { rateLimit: { key: "segment", limit: 600, windowSec: 3600 } },
);
