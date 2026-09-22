import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { signupSchema } from "@/lib/validation";
import { hashPassword } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { conflict } from "@/lib/errors";
import { track } from "@/lib/services/analytics";

export const POST = route(
  async (req) => {
    const input = await readJson(req, signupSchema);
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) throw conflict("An account with that email already exists. Try signing in.");
    const user = await db.user.create({
      data: {
        email: input.email,
        passwordHash: await hashPassword(input.password),
        role: input.role, // validated to student | interviewer — never admin
        profile: { create: { firstName: input.firstName, lastName: input.lastName } },
      },
    });
    await createSession(user.id, req.headers.get("user-agent"));
    await track("signup", user.id, { role: user.role, method: "password" });
    return { ok: true, redirect: "/onboarding" };
  },
  { rateLimit: { key: "signup", limit: 20, windowSec: 3600 } },
);
