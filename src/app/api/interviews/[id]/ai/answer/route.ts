import { after } from "next/server";
import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { answerSchema } from "@/lib/validation";
import { aiAnswer, getRoomState } from "@/lib/services/room";
import { runGrading } from "@/lib/services/grading";

const schema = answerSchema.extend({ questionId: z.string().max(40) });

export const POST = route<{ id: string }>(
  async (req, { params }) => {
    const user = await requireApiUser({ roles: ["student"] });
    const body = await readJson(req, schema);
    await aiAnswer(params.id, user, body);
    const state = await getRoomState(params.id, user);
    if (state.status === "completed") after(() => runGrading(params.id));
    return state;
  },
  { rateLimit: { key: "ai-answer", limit: 120, windowSec: 3600 } },
);
