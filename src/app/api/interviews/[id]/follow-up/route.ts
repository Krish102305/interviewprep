import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { generateFollowUpSuggestion } from "@/lib/services/room";

export const POST = route<{ id: string }>(
  async (_req, { params }) => {
    const user = await requireApiUser({ roles: ["interviewer"] });
    return generateFollowUpSuggestion(params.id, user);
  },
  { rateLimit: { key: "follow-up", limit: 60, windowSec: 3600 } },
);
