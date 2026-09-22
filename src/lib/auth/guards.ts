import "server-only";
import { redirect } from "next/navigation";
import { getSessionUser, type SessionUser } from "./session";
import { forbidden, unauthorized } from "@/lib/errors";
import type { Role } from "@/lib/constants";

/** Where each role lands after signing in. */
export function homeFor(user: Pick<SessionUser, "role" | "onboardedAt" | "accountStatus">) {
  if (user.accountStatus !== "active") return "/conduct";
  if (user.role === "admin") return "/admin";
  if (!user.onboardedAt) return "/onboarding";
  return user.role === "interviewer" ? "/interviewer" : "/dashboard";
}

type PageOpts = { roles?: Role[]; allowRestricted?: boolean; allowUnonboarded?: boolean };

/** Page guard: redirects instead of throwing. */
export async function requirePageUser(opts: PageOpts = {}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.accountStatus !== "active" && !opts.allowRestricted) redirect("/conduct");
  if (!user.onboardedAt && user.role !== "admin" && !opts.allowUnonboarded) redirect("/onboarding");
  if (opts.roles && !opts.roles.includes(user.role as Role)) redirect(homeFor(user));
  return user;
}

type ApiOpts = { roles?: Role[]; allowRestricted?: boolean };

/** API guard: throws AppError (401/403). Roles always come from the DB, never the client. */
export async function requireApiUser(opts: ApiOpts = {}) {
  const user = await getSessionUser();
  if (!user) throw unauthorized();
  if (user.accountStatus === "banned" && !opts.allowRestricted)
    throw forbidden("Your account is suspended after 3 confirmed conduct violations. You can submit an appeal from the Conduct page.");
  if (user.accountStatus === "suspended" && !opts.allowRestricted)
    throw forbidden("Your account is temporarily suspended. Contact support or check the Conduct page.");
  if (opts.roles && !opts.roles.includes(user.role as Role)) throw forbidden();
  return user;
}
