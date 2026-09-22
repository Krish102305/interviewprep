import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { conductSignalSchema } from "@/lib/validation";
import { recordRoomSignal } from "@/lib/services/room";

/** Potential conduct signals from the room. Never creates a strike. */
export const POST = route<{ id: string }>(
  async (req, { params }) => {
    const user = await requireApiUser();
    const body = await readJson(req, conductSignalSchema);
    return recordRoomSignal(params.id, user, body.type, body.details);
  },
  { rateLimit: { key: "conduct-signal", limit: 120, windowSec: 3600 } },
);
