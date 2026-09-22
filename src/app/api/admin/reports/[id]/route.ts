import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { adminReviewSchema } from "@/lib/validation";
import { confirmReport, dismissReport } from "@/lib/services/conduct";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireApiUser({ roles: ["admin"] });
  const d = await readJson(req, adminReviewSchema);
  if (d.decision === "confirm") {
    const strike = await confirmReport(params.id, admin.id, d.note);
    return { ok: true, strikeNumber: strike.strikeNumber };
  }
  await dismissReport(params.id, admin.id, d.note);
  return { ok: true };
});
