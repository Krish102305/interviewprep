import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { adminUserActionSchema } from "@/lib/validation";
import { conflict, forbidden, notFound } from "@/lib/errors";
import { banUser, issueStrike, logAdminAction, restoreUser, suspendUser } from "@/lib/services/conduct";

export const POST = route<{ id: string }>(async (req, { params }) => {
  const admin = await requireApiUser({ roles: ["admin"] });
  const d = await readJson(req, adminUserActionSchema);
  const target = await db.user.findUnique({ where: { id: params.id } });
  if (!target) throw notFound("User not found.");
  if (target.role === "admin") throw forbidden("Admin accounts can't be moderated here.");
  switch (d.action) {
    case "suspend":
      if (target.accountStatus !== "active") throw conflict("User is not active.");
      await suspendUser(target.id, admin.id, d.reason);
      break;
    case "ban":
      if (target.accountStatus === "banned") throw conflict("User is already banned.");
      await banUser(target.id, admin.id, d.reason);
      break;
    case "unban":
      if (target.accountStatus === "active") throw conflict("User is already active.");
      await restoreUser(target.id, admin.id, d.reason);
      break;
    case "add_strike": {
      const strike = await issueStrike({ userId: target.id, reason: "other", description: d.reason, reviewerId: admin.id });
      await logAdminAction(admin.id, "add_strike", target.id, `Strike ${strike.strikeNumber}: ${d.reason}`);
      break;
    }
  }
  return { ok: true };
});
