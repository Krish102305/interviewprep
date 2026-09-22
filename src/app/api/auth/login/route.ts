import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { verifyPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guards";
import { AppError } from "@/lib/errors";
import { track } from "@/lib/services/analytics";

export const POST = route(
  async (req) => {
    const input = await readJson(req, loginSchema);
    const user = await db.user.findUnique({ where: { email: input.email } });
    // Same message for unknown email and wrong password (no account enumeration).
    const ok = user?.passwordHash ? await verifyPassword(input.password, user.passwordHash) : false;
    if (!user || !ok) throw new AppError(401, "Incorrect email or password.");
    await createSession(user.id, req.headers.get("user-agent"));
    await track("login", user.id);
    return { ok: true, redirect: homeFor(user) };
  },
  { rateLimit: { key: "login", limit: 20, windowSec: 900 } },
);
