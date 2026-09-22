import { z } from "zod";
import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { conflict, forbidden } from "@/lib/errors";
import { loadForUser } from "@/lib/services/interviews";

/**
 * WebRTC signaling relay (offer / answer / ICE candidates) between the two
 * participants of a human interview. Media flows peer-to-peer, not via the server.
 */
async function peerOf(interviewId: string, user: { id: string; role: string }) {
  const { iv, role } = await loadForUser(interviewId, user);
  if (role === "admin" || iv.mode !== "human" || !iv.interviewerId) throw forbidden();
  if (!["waiting", "active", "scheduled"].includes(iv.status)) throw conflict("This interview is closed.");
  return role === "candidate" ? iv.interviewerId : iv.studentId;
}

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser();
  await peerOf(params.id, user);
  const signals = await db.rtcSignal.findMany({ where: { interviewId: params.id, toUserId: user.id, consumed: false }, orderBy: { createdAt: "asc" }, take: 100 });
  if (signals.length) await db.rtcSignal.updateMany({ where: { id: { in: signals.map((s) => s.id) } }, data: { consumed: true } });
  return { signals: signals.map((s) => ({ kind: s.kind, payload: JSON.parse(s.payload) })) };
});

const schema = z.object({ kind: z.enum(["description", "candidate", "hello", "bye"]), payload: z.unknown() });

export const POST = route<{ id: string }>(
  async (req, { params }) => {
    const user = await requireApiUser();
    const to = await peerOf(params.id, user);
    const body = await readJson(req, schema);
    const payload = JSON.stringify(body.payload ?? null);
    if (payload.length > 20000) throw conflict("Signal too large.");
    await db.rtcSignal.create({ data: { interviewId: params.id, fromUserId: user.id, toUserId: to, kind: body.kind, payload } });
    return { ok: true };
  },
  { rateLimit: { key: "signal", limit: 3000, windowSec: 3600 } },
);
