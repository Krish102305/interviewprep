import { z } from "zod";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { revokeStrike } from "@/lib/services/conduct";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireApiUser({ roles: ["admin"] });
  const d = await readJson(req, z.object({ note: z.string().trim().min(5, "Give a reason (min 5 characters)").max(1000), restoreAccount: z.boolean().default(true) }));
  const remaining = await revokeStrike(params.id, admin.id, "removed", d.note, d.restoreAccount);
  return { ok: true, remaining };
});
