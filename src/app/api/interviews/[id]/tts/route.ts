import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { badRequest, forbidden } from "@/lib/errors";
import { personaFor } from "@/lib/ai/personas";
import { loadForUser } from "@/lib/services/interviews";
import { BACKCHANNELS, isTtsConfigured, synthesize, TtsError, type Backchannel } from "@/lib/voice/tts";

/**
 * The AI interviewer's voice. Only speaks text the interviewer actually said in
 * this interview (by transcript entry id) or a fixed short reaction — never
 * arbitrary text — and only to the candidate in the room.
 *   GET ?entries=id1,id2   → MP3 stream
 *   GET ?phrase=mhm        → MP3 stream
 */
export const GET = route<{ id: string }>(
  async (req, { params }) => {
    const user = await requireApiUser({ roles: ["student"] });
    const { iv, role } = await loadForUser(params.id, user);
    if (role !== "candidate" || iv.mode !== "ai") throw forbidden();
    const url = new URL(req.url);
    if (!isTtsConfigured()) return Response.json({ error: "Voice is not configured.", code: "tts_unavailable" }, { status: 503 });

    let text = "";
    const phrase = url.searchParams.get("phrase");
    if (phrase) {
      if (!(phrase in BACKCHANNELS)) throw badRequest("Unknown phrase.");
      text = BACKCHANNELS[phrase as Backchannel];
    } else {
      const ids = (url.searchParams.get("entries") ?? "").split(",").filter(Boolean).slice(0, 5);
      if (!ids.length) throw badRequest("Nothing to say.");
      const entries = await db.transcriptEntry.findMany({ where: { id: { in: ids }, interviewId: iv.id, speaker: "interviewer" }, orderBy: { createdAt: "asc" } });
      text = entries.map((e) => e.text).join(" ").slice(0, 2500);
    }
    if (!text.trim()) throw badRequest("Nothing to say.");

    try {
      const audio = await synthesize(text, personaFor(iv.roleCategory).key, req.signal);
      return new Response(audio, {
        headers: { "Content-Type": "audio/mpeg", "Cache-Control": phrase ? "private, max-age=86400" : "private, max-age=3600" },
      });
    } catch (err) {
      if (err instanceof TtsError) return Response.json({ error: err.message, code: "tts_failed" }, { status: err.status });
      throw err;
    }
  },
  { rateLimit: { key: "tts", limit: 400, windowSec: 3600 } },
);
