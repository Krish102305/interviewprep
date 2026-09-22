import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { adminAppealSchema } from "@/lib/validation";
import { reviewAppeal } from "@/lib/services/conduct";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireApiUser({ roles: ["admin"] });
  const d = await readJson(req, adminAppealSchema);
  await reviewAppeal(params.id, admin.id, d.decision, d.note, d.restoreAccount);
  return { ok: true };
});
