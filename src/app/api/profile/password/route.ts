import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { badRequest } from "@/lib/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyAllSessions } from "@/lib/auth/session";
import { changePasswordSchema } from "@/lib/validation";

/** Change your password. Signs out every other device and keeps this one signed in. */
export const POST = route(
  async (req) => {
    const user = await requireApiUser({ allowRestricted: true });
    const body = await readJson(req, changePasswordSchema);
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    // Google-only accounts have no password yet and may set one.
    if (row.passwordHash && !(await verifyPassword(body.currentPassword, row.passwordHash))) throw badRequest("Your current password is incorrect.");
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword) } });
    await destroyAllSessions(user.id);
    await createSession(user.id, req.headers.get("user-agent"));
    return { ok: true };
  },
  { rateLimit: { key: "change-password", limit: 10, windowSec: 3600 } },
);
