import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { askSchema } from "@/lib/validation";
import { interviewerAsk } from "@/lib/services/room";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireApiUser({ roles: ["interviewer"] });
  return interviewerAsk(params.id, user, await readJson(req, askSchema));
});
