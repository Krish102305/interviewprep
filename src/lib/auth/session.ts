import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import crypto from "node:crypto";
import { db } from "@/lib/db";

export const SESSION_COOKIE = "ic_session";
const SESSION_DAYS = 30;

const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("hex");

export async function createSession(userId: string, userAgent?: string | null) {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({ data: { tokenHash: sha256(token), userId, expiresAt, userAgent: userAgent?.slice(0, 200) } });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha256(token) } });
  jar.delete(SESSION_COOKIE);
}

/** Revoke every session for a user (used on ban). */
export async function destroyAllSessions(userId: string) {
  await db.session.deleteMany({ where: { userId } });
}

export const userSelect = {
  id: true,
  email: true,
  role: true,
  accountStatus: true,
  onboardedAt: true,
  createdAt: true,
  profile: true,
} as const;

/** The signed-in user for this request (memoised per request), or null. */
export const getSessionUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: sha256(token) },
    include: { user: { select: userSelect } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  // Cheap activity tracking for retention analytics (at most once a minute).
  void db.user
    .updateMany({
      where: { id: session.userId, OR: [{ lastActiveAt: null }, { lastActiveAt: { lt: new Date(Date.now() - 60_000) } }] },
      data: { lastActiveAt: new Date() },
    })
    .catch(() => {});
  return session.user;
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
