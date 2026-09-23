import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { answerSchema } from "@/lib/validation";
import { submitRetry } from "@/lib/services/retry";

/** Grade a new attempt at one question from a graded interview. */
export const POST = route<{ id: string; questionId: string }>(
  async (req, { params }) => {
    const user = await requireApiUser({ roles: ["student"] });
    const body = await readJson(req, answerSchema);
    return submitRetry(params.id, params.questionId, user, body);
  },
  { rateLimit: { key: "retry", limit: 30, windowSec: 3600 } },
);
