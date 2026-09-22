import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { updateConnection } from "@/lib/services/room";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireApiUser();
  const { state } = await readJson(req, z.object({ state: z.enum(["connected", "reconnecting", "disconnected"]) }));
  await updateConnection(params.id, user, state);
  return { ok: true };
});
