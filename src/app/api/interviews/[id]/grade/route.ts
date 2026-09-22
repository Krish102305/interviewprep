import { after } from "next/server";
import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { forbidden } from "@/lib/errors";
import { loadForUser } from "@/lib/services/interviews";
import { gradeIfFeedbackWindowPassed, runGrading } from "@/lib/services/grading";

/** Retry failed grading, or trigger grading once the feedback window has passed. */
export const POST = route<{ id: string }>(
  async (_req, { params }) => {
    const user = await requireApiUser();
    const { iv, role } = await loadForUser(params.id, user);
    if (role === "interviewer") throw forbidden();
    if (iv.gradingStatus === "failed") after(() => runGrading(iv.id));
    else if (iv.gradingStatus === "pending") after(() => gradeIfFeedbackWindowPassed(iv.id));
    else if (iv.gradingStatus === "processing") after(() => runGrading(iv.id)); // recovers stale jobs only
    return { ok: true };
  },
  { rateLimit: { key: "grade", limit: 30, windowSec: 3600 } },
);
