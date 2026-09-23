import { after } from "next/server";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { createInterviewSchema } from "@/lib/validation";
import { createInterview, generateQuestionsFor } from "@/lib/services/interviews";

export const POST = route(
  async (req) => {
    const user = await requireApiUser({ roles: ["student"] });
    const input = await readJson(req, createInterviewSchema);
    const interview = await createInterview(user, input);
    // Question generation can take a while with a real model, do it after responding.
    after(() => generateQuestionsFor(interview.id));
    const next = input.mode === "ai" && input.timing === "now" ? `/interviews/${interview.id}/room` : `/interviews/${interview.id}`;
    return { id: interview.id, redirect: next };
  },
  { rateLimit: { key: "create-interview", limit: 30, windowSec: 3600 } },
);
