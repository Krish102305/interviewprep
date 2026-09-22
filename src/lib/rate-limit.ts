import { db } from "@/lib/db";
import { tooMany } from "@/lib/errors";

/** Fixed-window rate limit backed by the database (works across restarts). */
export async function enforceRateLimit(key: string, limit: number, windowSec: number) {
  const now = new Date();
  const existing = await db.rateLimit.findUnique({ where: { key } });
  if (!existing || existing.resetAt < now) {
    await db.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, resetAt: new Date(now.getTime() + windowSec * 1000) },
      update: { count: 1, resetAt: new Date(now.getTime() + windowSec * 1000) },
    });
    return;
  }
  if (existing.count >= limit) throw tooMany();
  await db.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } });
}
