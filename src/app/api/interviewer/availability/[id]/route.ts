import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { conflict, notFound } from "@/lib/errors";

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser({ roles: ["interviewer"] });
  const slot = await db.availability.findFirst({ where: { id: params.id, interviewerId: user.id } });
  if (!slot) throw notFound();
  if (slot.interviewId) throw conflict("This slot is booked. Cancel the interview instead.");
  await db.availability.delete({ where: { id: slot.id } });
  return { ok: true };
});
