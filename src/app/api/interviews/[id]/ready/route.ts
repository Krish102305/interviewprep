import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { markReady } from "@/lib/services/room";

const schema = z.object({
  deviceCheck: z.object({ camera: z.boolean(), mic: z.boolean(), network: z.string().max(20), speech: z.boolean().optional() }),
  recordingConsent: z.boolean().default(false),
});

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireApiUser();
  const body = await readJson(req, schema);
  await markReady(params.id, user, body.deviceCheck, body.recordingConsent);
  return { ok: true };
});
