import { z } from "zod";
import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";

export const GET = route(async (req) => {
  const user = await requireApiUser({ allowRestricted: true });
  const limit = Math.min(50, Number(new URL(req.url).searchParams.get("limit") ?? 20) || 20);
  const [items, unread] = await Promise.all([
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: limit }),
    db.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);
  return { items, unread };
});

const markSchema = z.object({ ids: z.array(z.string().max(40)).max(100).optional(), all: z.boolean().optional() });

export const POST = route(async (req) => {
  const user = await requireApiUser({ allowRestricted: true });
  const body = await readJson(req, markSchema);
  await db.notification.updateMany({
    where: { userId: user.id, readAt: null, ...(body.all ? {} : { id: { in: body.ids ?? [] } }) },
    data: { readAt: new Date() },
  });
  return { ok: true };
});
